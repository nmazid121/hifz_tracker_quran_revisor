#!/usr/bin/env python3
"""
MongoDB Atlas Migration Script for Hifz Tracker
==================================================

This script migrates data from local SQLite databases to MongoDB Atlas
for production deployment.

Usage:
    python mongo_migration.py --setup    # Setup MongoDB Atlas connection
    python mongo_migration.py --migrate  # Migrate all data
    python mongo_migration.py --validate # Validate migration
"""

import os
import sys
import sqlite3
import json
import argparse
from datetime import datetime
from typing import Dict, List, Any, Optional
import traceback

try:
    from pymongo import MongoClient
    from pymongo.errors import ConnectionFailure, DuplicateKeyError
    PYMONGO_AVAILABLE = True
except ImportError:
    PYMONGO_AVAILABLE = False
    print("PyMongo not installed. Run: pip install pymongo")

# Configuration
SQLITE_DBS = {
    'hifz_tracker': 'hifz_tracker.db',
    'qul_layout': '../qul_downloads/qudratullah-indopak-15-lines.db',
    'qul_script': '../qul_downloads/indopak.db'
}

class MongoMigrator:
    def __init__(self):
        self.mongo_client = None
        self.mongo_db = None
        self.connection_string = None
        self.database_name = "hifz_tracker_prod"
        
    def setup_connection(self, connection_string: str, database_name: str = None):
        """Setup MongoDB Atlas connection."""
        if not PYMONGO_AVAILABLE:
            raise ImportError("PyMongo is required. Install with: pip install pymongo")
            
        try:
            self.connection_string = connection_string
            if database_name:
                self.database_name = database_name
                
            self.mongo_client = MongoClient(connection_string)
            self.mongo_db = self.mongo_client[self.database_name]
            
            # Test connection
            self.mongo_client.admin.command('ping')
            print(f"✅ Successfully connected to MongoDB Atlas")
            print(f"   Database: {self.database_name}")
            
            return True
            
        except ConnectionFailure as e:
            print(f"❌ Failed to connect to MongoDB Atlas: {e}")
            return False
        except Exception as e:
            print(f"❌ Error setting up connection: {e}")
            return False
    
    def get_sqlite_connection(self, db_name: str) -> sqlite3.Connection:
        """Get SQLite database connection."""
        db_path = SQLITE_DBS.get(db_name)
        if not db_path:
            raise ValueError(f"Unknown database: {db_name}")
            
        full_path = os.path.join(os.path.dirname(__file__), db_path)
        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Database file not found: {full_path}")
            
        conn = sqlite3.connect(full_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def migrate_recitations(self) -> bool:
        """Migrate recitations from SQLite to MongoDB."""
        try:
            print("📄 Migrating recitations...")
            
            # Get data from SQLite
            conn = self.get_sqlite_connection('hifz_tracker')
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM recitations')
            rows = cursor.fetchall()
            
            if not rows:
                print("   No recitations to migrate")
                return True
            
            # Prepare MongoDB collection
            collection = self.mongo_db.recitations
            
            # Convert and insert data
            documents = []
            for row in rows:
                doc = dict(row)
                
                # Parse JSON mistakes
                if doc['manual_mistakes']:
                    doc['manual_mistakes'] = json.loads(doc['manual_mistakes'])
                else:
                    doc['manual_mistakes'] = []
                
                # Convert datetime strings
                for date_field in ['recitation_date', 'fixed_it_date', 'created_at', 'updated_at']:
                    if doc[date_field]:
                        try:
                            doc[date_field] = datetime.fromisoformat(doc[date_field].replace('Z', '+00:00'))
                        except ValueError:
                            # If parsing fails, keep as string
                            pass
                
                # Use SQLite ID as MongoDB _id to maintain references
                doc['_id'] = doc['id']
                del doc['id']
                
                documents.append(doc)
            
            # Insert in batches
            batch_size = 100
            for i in range(0, len(documents), batch_size):
                batch = documents[i:i + batch_size]
                try:
                    collection.insert_many(batch, ordered=False)
                except DuplicateKeyError:
                    # Handle duplicates by updating existing records
                    for doc in batch:
                        collection.replace_one({'_id': doc['_id']}, doc, upsert=True)
            
            # Create indexes
            collection.create_index([('page_number', 1)])
            collection.create_index([('surah_name', 1)])
            collection.create_index([('juz', 1)])
            collection.create_index([('recitation_date', -1)])
            collection.create_index([('rating', 1)])
            
            print(f"   ✅ Migrated {len(documents)} recitations")
            conn.close()
            return True
            
        except Exception as e:
            print(f"   ❌ Failed to migrate recitations: {e}")
            traceback.print_exc()
            return False
    
    def migrate_qul_pages(self) -> bool:
        """Migrate QUL page layout data to MongoDB."""
        try:
            print("📑 Migrating QUL page layout...")
            
            conn = self.get_sqlite_connection('qul_layout')
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM pages')
            rows = cursor.fetchall()
            
            if not rows:
                print("   No pages to migrate")
                return True
            
            collection = self.mongo_db.quran_pages
            
            # Convert and insert data
            documents = []
            for row in rows:
                doc = dict(row)
                
                # Clean up empty string values
                for field in ['first_word_id', 'last_word_id', 'surah_number', 'ayah_number']:
                    if doc.get(field) == '':
                        doc[field] = None
                
                # Convert numeric fields
                for field in ['first_word_id', 'last_word_id', 'line_number', 'page_number', 'surah_number', 'ayah_number', 'juz']:
                    if doc.get(field) is not None:
                        try:
                            doc[field] = int(doc[field])
                        except (ValueError, TypeError):
                            pass
                
                # Convert boolean
                doc['is_centered'] = bool(doc.get('is_centered', 0))
                
                documents.append(doc)
            
            # Clear existing and insert new
            collection.delete_many({})
            collection.insert_many(documents)
            
            # Create indexes
            collection.create_index([('page_number', 1)])
            collection.create_index([('surah_number', 1)])
            collection.create_index([('line_type', 1)])
            collection.create_index([('juz', 1)])
            
            print(f"   ✅ Migrated {len(documents)} page layout records")
            conn.close()
            return True
            
        except Exception as e:
            print(f"   ❌ Failed to migrate QUL pages: {e}")
            traceback.print_exc()
            return False
    
    def migrate_qul_words(self) -> bool:
        """Migrate QUL word data to MongoDB."""
        try:
            print("📝 Migrating QUL word data...")
            
            conn = self.get_sqlite_connection('qul_script')
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM words')
            rows = cursor.fetchall()
            
            if not rows:
                print("   No words to migrate")
                return True
            
            collection = self.mongo_db.quran_words
            
            # Convert and insert data
            documents = []
            for row in rows:
                doc = dict(row)
                
                # Ensure numeric fields are integers
                for field in ['id', 'surah', 'ayah', 'word']:
                    if doc.get(field) is not None:
                        doc[field] = int(doc[field])
                
                # Use word ID as MongoDB _id
                doc['_id'] = doc['id']
                
                documents.append(doc)
            
            # Clear existing and insert new
            collection.delete_many({})
            
            # Insert in batches (word data can be large)
            batch_size = 1000
            for i in range(0, len(documents), batch_size):
                batch = documents[i:i + batch_size]
                collection.insert_many(batch)
            
            # Create indexes
            collection.create_index([('surah', 1)])
            collection.create_index([('ayah', 1)])
            collection.create_index([('surah', 1), ('ayah', 1)])
            collection.create_index([('id', 1)])  # For fast word lookup
            
            print(f"   ✅ Migrated {len(documents)} words")
            conn.close()
            return True
            
        except Exception as e:
            print(f"   ❌ Failed to migrate QUL words: {e}")
            traceback.print_exc()
            return False
    
    def validate_migration(self) -> bool:
        """Validate that migration was successful."""
        try:
            print("🔍 Validating migration...")
            
            # Check recitations
            recitations_count = self.mongo_db.recitations.count_documents({})
            sqlite_conn = self.get_sqlite_connection('hifz_tracker')
            sqlite_cursor = sqlite_conn.cursor()
            sqlite_cursor.execute('SELECT COUNT(*) FROM recitations')
            sqlite_recitations = sqlite_cursor.fetchone()[0]
            sqlite_conn.close()
            
            print(f"   Recitations: MongoDB={recitations_count}, SQLite={sqlite_recitations}")
            
            # Check pages
            pages_count = self.mongo_db.quran_pages.count_documents({})
            sqlite_conn = self.get_sqlite_connection('qul_layout')
            sqlite_cursor = sqlite_conn.cursor()
            sqlite_cursor.execute('SELECT COUNT(*) FROM pages')
            sqlite_pages = sqlite_cursor.fetchone()[0]
            sqlite_conn.close()
            
            print(f"   Pages: MongoDB={pages_count}, SQLite={sqlite_pages}")
            
            # Check words
            words_count = self.mongo_db.quran_words.count_documents({})
            sqlite_conn = self.get_sqlite_connection('qul_script')
            sqlite_cursor = sqlite_conn.cursor()
            sqlite_cursor.execute('SELECT COUNT(*) FROM words')
            sqlite_words = sqlite_cursor.fetchone()[0]
            sqlite_conn.close()
            
            print(f"   Words: MongoDB={words_count}, SQLite={sqlite_words}")
            
            # Validate indexes
            collections = ['recitations', 'quran_pages', 'quran_words']
            for coll_name in collections:
                indexes = list(self.mongo_db[coll_name].list_indexes())
                print(f"   {coll_name} indexes: {len(indexes)}")
            
            success = (recitations_count == sqlite_recitations and 
                      pages_count == sqlite_pages and 
                      words_count == sqlite_words)
            
            if success:
                print("   ✅ Migration validation successful")
            else:
                print("   ❌ Migration validation failed - counts don't match")
            
            return success
            
        except Exception as e:
            print(f"   ❌ Validation failed: {e}")
            traceback.print_exc()
            return False
    
    def run_full_migration(self) -> bool:
        """Run complete migration process."""
        print("🚀 Starting full migration to MongoDB Atlas...")
        print(f"   Target database: {self.database_name}")
        print("=" * 50)
        
        # Migrate all data
        steps = [
            self.migrate_recitations,
            self.migrate_qul_pages,
            self.migrate_qul_words,
        ]
        
        for step in steps:
            if not step():
                print(f"❌ Migration failed at step: {step.__name__}")
                return False
        
        # Validate
        if not self.validate_migration():
            print("❌ Migration validation failed")
            return False
        
        print("=" * 50)
        print("🎉 Migration completed successfully!")
        print(f"   Database: {self.database_name}")
        print(f"   Connection: {self.connection_string}")
        
        return True

def setup_atlas_connection():
    """Interactive setup for MongoDB Atlas connection."""
    print("MongoDB Atlas Setup")
    print("=" * 30)
    print("Please provide your MongoDB Atlas connection details:")
    print()
    
    connection_string = input("MongoDB Atlas Connection String: ").strip()
    database_name = input("Database Name (default: hifz_tracker_prod): ").strip()
    
    if not database_name:
        database_name = "hifz_tracker_prod"
    
    # Save to .env file
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    env_lines = []
    
    # Read existing .env if it exists
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            env_lines = f.readlines()
    
    # Update or add MongoDB settings
    mongo_uri_found = False
    mongo_db_found = False
    
    for i, line in enumerate(env_lines):
        if line.startswith('MONGODB_URI='):
            env_lines[i] = f'MONGODB_URI={connection_string}\n'
            mongo_uri_found = True
        elif line.startswith('MONGODB_DATABASE='):
            env_lines[i] = f'MONGODB_DATABASE={database_name}\n'
            mongo_db_found = True
    
    if not mongo_uri_found:
        env_lines.append(f'MONGODB_URI={connection_string}\n')
    if not mongo_db_found:
        env_lines.append(f'MONGODB_DATABASE={database_name}\n')
    
    # Write back to .env
    with open(env_path, 'w') as f:
        f.writelines(env_lines)
    
    print(f"✅ Configuration saved to {env_path}")
    
    # Test connection
    migrator = MongoMigrator()
    if migrator.setup_connection(connection_string, database_name):
        print("✅ Connection test successful")
        return migrator
    else:
        print("❌ Connection test failed")
        return None

def load_config():
    """Load configuration from .env file."""
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    config = {}
    
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    config[key] = value
    
    return config

def main():
    parser = argparse.ArgumentParser(description='MongoDB Atlas Migration for Hifz Tracker')
    parser.add_argument('--setup', action='store_true', help='Setup MongoDB Atlas connection')
    parser.add_argument('--migrate', action='store_true', help='Run full migration')
    parser.add_argument('--validate', action='store_true', help='Validate existing migration')
    parser.add_argument('--connection-string', help='MongoDB Atlas connection string')
    parser.add_argument('--database', help='Database name', default='hifz_tracker_prod')
    
    args = parser.parse_args()
    
    if not PYMONGO_AVAILABLE:
        print("❌ PyMongo is required for MongoDB operations")
        print("Install with: pip install pymongo")
        sys.exit(1)
    
    if args.setup:
        migrator = setup_atlas_connection()
        if migrator:
            print("\nSetup complete! You can now run migration with:")
            print("python mongo_migration.py --migrate")
    
    elif args.migrate or args.validate:
        # Load configuration
        if args.connection_string:
            connection_string = args.connection_string
            database_name = args.database
        else:
            config = load_config()
            connection_string = config.get('MONGODB_URI')
            database_name = config.get('MONGODB_DATABASE', 'hifz_tracker_prod')
            
            if not connection_string:
                print("❌ MongoDB connection string not found")
                print("Run with --setup first or provide --connection-string")
                sys.exit(1)
        
        # Setup migrator
        migrator = MongoMigrator()
        if not migrator.setup_connection(connection_string, database_name):
            sys.exit(1)
        
        if args.migrate:
            success = migrator.run_full_migration()
            sys.exit(0 if success else 1)
        elif args.validate:
            success = migrator.validate_migration()
            sys.exit(0 if success else 1)
    
    else:
        parser.print_help()

if __name__ == '__main__':
    main()