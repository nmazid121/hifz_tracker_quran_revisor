#!/usr/bin/env python3
"""
Database migration script for Hifz Tracker.
This script initializes the database schema and can be used for future migrations.
"""

import os
import sys
from datetime import datetime

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(__file__))

from database import init_database, get_db_connection, backup_database

def run_migration():
    """Run the database migration."""
    print("Starting database migration...")
    
    # Check if database already exists
    db_path = os.path.join(os.path.dirname(__file__), 'hifz_tracker.db')
    db_exists = os.path.exists(db_path)
    
    if db_exists:
        # Create backup before migration
        backup_dir = os.path.join(os.path.dirname(__file__), 'backups')
        os.makedirs(backup_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = os.path.join(backup_dir, f'hifz_tracker_backup_{timestamp}.db')
        
        print(f"Creating backup at: {backup_path}")
        if backup_database(backup_path):
            print("Backup created successfully!")
        else:
            print("Warning: Backup failed, but continuing with migration...")
    
    # Initialize database
    print("Initializing database schema...")
    init_database()
    
    # Verify the migration
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if tables exist
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='recitations'
        """)
        
        if cursor.fetchone():
            print("✅ Database migration completed successfully!")
            print("✅ Recitations table created")
            
            # Check indexes
            cursor.execute("PRAGMA index_list(recitations)")
            indexes = cursor.fetchall()
            print(f"✅ Created {len(indexes)} indexes")
            
            # Check triggers
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='trigger' AND name='update_recitations_updated_at'
            """)
            if cursor.fetchone():
                print("✅ Created update trigger")
            
        else:
            print("❌ Migration failed: recitations table not found")
            return False
            
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Migration verification failed: {e}")
        return False

def create_sample_data():
    """Create sample data for testing."""
    from database import create_recitation
    
    print("\nCreating sample data...")
    
    sample_recitations = [
        {
            'page_number': 1,
            'surah_name': 'Al-Fatiha',
            'juz': 1,
            'rating': 'Perfect',
            'manual_mistakes': [],
            'notes': 'Excellent recitation, no mistakes'
        },
        {
            'page_number': 2,
            'surah_name': 'Al-Baqarah',
            'juz': 1,
            'rating': 'Good',
            'manual_mistakes': [15, 23, 45],
            'notes': 'Minor stutter on verse 5, needs practice'
        },
        {
            'page_number': 3,
            'surah_name': 'Al-Baqarah',
            'juz': 1,
            'rating': 'Okay',
            'manual_mistakes': [12, 18, 25, 30, 42],
            'notes': 'Several mistakes, need to review this page'
        }
    ]
    
    for recitation in sample_recitations:
        try:
            recitation_id = create_recitation(**recitation)
            print(f"✅ Created sample recitation {recitation_id}: {recitation['surah_name']} page {recitation['page_number']}")
        except Exception as e:
            print(f"❌ Failed to create sample recitation: {e}")
    
    print("Sample data creation completed!")

if __name__ == '__main__':
    print("=" * 50)
    print("Hifz Tracker Database Migration")
    print("=" * 50)
    
    if run_migration():
        # Ask if user wants to create sample data
        try:
            response = input("\nWould you like to create sample data? (y/n): ").lower().strip()
            if response in ['y', 'yes']:
                create_sample_data()
        except KeyboardInterrupt:
            print("\nMigration completed without sample data.")
        
        print("\nMigration completed successfully!")
        print("You can now start the Flask application.")
    else:
        print("\nMigration failed!")
        sys.exit(1) 