"""
MongoDB Database Module for Hifz Tracker (Production)
====================================================

This module provides MongoDB Atlas database operations for production deployment.
It maintains the same interface as the SQLite database.py module for easy switching.

Environment Variables Required:
    MONGODB_URI - MongoDB Atlas connection string
    MONGODB_DATABASE - Database name (default: hifz_tracker_prod)
"""

import os
import json
from datetime import datetime
from typing import List, Dict, Optional, Any
import traceback

try:
    from pymongo import MongoClient
    from pymongo.errors import ConnectionFailure, DuplicateKeyError
    from bson import ObjectId
    MONGODB_AVAILABLE = True
except ImportError:
    MONGODB_AVAILABLE = False
    print("Warning: PyMongo not available. MongoDB operations will fail.")

class MongoDBConnection:
    _instance = None
    _client = None
    _database = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, 'initialized'):
            self.initialized = True
            self._setup_connection()
    
    def _setup_connection(self):
        """Setup MongoDB connection from environment variables."""
        if not MONGODB_AVAILABLE:
            raise ImportError("PyMongo is required for MongoDB operations. Install with: pip install pymongo")
        
        connection_string = os.getenv('MONGODB_URI')
        database_name = os.getenv('MONGODB_DATABASE', 'hifz_tracker_prod')
        
        if not connection_string:
            raise ValueError("MONGODB_URI environment variable is required")
        
        try:
            self._client = MongoClient(connection_string)
            self._database = self._client[database_name]
            
            # Test connection
            self._client.admin.command('ping')
            print(f"✅ Connected to MongoDB: {database_name}")
            
        except ConnectionFailure as e:
            raise ConnectionFailure(f"Failed to connect to MongoDB: {e}")
    
    @property
    def database(self):
        """Get the database instance."""
        if self._database is None:
            self._setup_connection()
        return self._database
    
    @property
    def client(self):
        """Get the client instance."""
        if self._client is None:
            self._setup_connection()
        return self._client

# Global connection instance
_mongo_conn = None

def get_mongo_connection():
    """Get MongoDB connection singleton."""
    global _mongo_conn
    if _mongo_conn is None:
        _mongo_conn = MongoDBConnection()
    return _mongo_conn

def init_database():
    """Initialize the MongoDB database with proper indexes."""
    try:
        conn = get_mongo_connection()
        db = conn.database
        
        # Create indexes for recitations collection
        recitations = db.recitations
        recitations.create_index([('page_number', 1)])
        recitations.create_index([('surah_name', 1)])
        recitations.create_index([('juz', 1)])
        recitations.create_index([('recitation_date', -1)])
        recitations.create_index([('rating', 1)])
        
        # Create indexes for quran_pages collection
        pages = db.quran_pages
        pages.create_index([('page_number', 1)])
        pages.create_index([('surah_number', 1)])
        pages.create_index([('line_type', 1)])
        pages.create_index([('juz', 1)])
        
        # Create indexes for quran_words collection
        words = db.quran_words
        words.create_index([('surah', 1)])
        words.create_index([('ayah', 1)])
        words.create_index([('surah', 1), ('ayah', 1)])
        words.create_index([('id', 1)])
        
        print("✅ MongoDB indexes created successfully")
        
    except Exception as e:
        print(f"Warning: Failed to create MongoDB indexes: {e}")

def validate_rating(rating: str) -> bool:
    """Validate that the rating is one of the allowed values."""
    valid_ratings = ['Perfect', 'Good', 'Okay', 'Bad', 'Rememorize']
    return rating in valid_ratings

def validate_mistakes(mistakes: List[int]) -> bool:
    """Validate that mistakes is a list of integers (word IDs)."""
    return isinstance(mistakes, list) and all(isinstance(x, int) for x in mistakes)

def create_recitation(
    page_number: int,
    surah_name: str,
    juz: int,
    rating: str,
    manual_mistakes: Optional[List[int]] = None,
    notes: Optional[str] = None
) -> str:
    """Create a new recitation record and return its ID."""
    if not validate_rating(rating):
        raise ValueError(f"Invalid rating: {rating}. Must be one of: Perfect, Good, Okay, Bad, Rememorize")
    
    if manual_mistakes and not validate_mistakes(manual_mistakes):
        raise ValueError("manual_mistakes must be a list of integers")
    
    try:
        conn = get_mongo_connection()
        collection = conn.database.recitations
        
        document = {
            'page_number': page_number,
            'surah_name': surah_name,
            'juz': juz,
            'rating': rating,
            'manual_mistakes': manual_mistakes or [],
            'notes': notes,
            'recitation_date': datetime.utcnow(),
            'fixed_it_date': None,
            'prev_rating': None,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = collection.insert_one(document)
        return str(result.inserted_id)
        
    except Exception as e:
        raise Exception(f"Failed to create recitation: {e}")

def get_recitation(recitation_id: str) -> Optional[Dict[str, Any]]:
    """Get a specific recitation by ID."""
    try:
        conn = get_mongo_connection()
        collection = conn.database.recitations
        
        # Handle both ObjectId and string IDs for backward compatibility
        try:
            if isinstance(recitation_id, str) and len(recitation_id) == 24:
                query_id = ObjectId(recitation_id)
            else:
                query_id = int(recitation_id)  # Legacy integer ID
                query_id = {'_id': query_id}
        except (ValueError, TypeError):
            return None
        
        if isinstance(query_id, dict):
            document = collection.find_one(query_id)
        else:
            document = collection.find_one({'_id': query_id})
        
        if document:
            # Convert ObjectId to string for JSON serialization
            document['id'] = str(document['_id'])
            del document['_id']
            return document
        
        return None
        
    except Exception as e:
        print(f"Error getting recitation: {e}")
        return None

def get_all_recitations(
    page_number: Optional[int] = None,
    surah_name: Optional[str] = None,
    juz: Optional[int] = None,
    rating: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    order_by: str = 'recitation_date DESC'
) -> List[Dict[str, Any]]:
    """Get all recitations with optional filtering and pagination."""
    try:
        conn = get_mongo_connection()
        collection = conn.database.recitations
        
        # Build query filter
        query = {}
        
        if page_number is not None:
            query['page_number'] = page_number
        
        if surah_name is not None:
            # Use regex for partial matching
            query['surah_name'] = {'$regex': surah_name, '$options': 'i'}
        
        if juz is not None:
            query['juz'] = juz
        
        if rating is not None:
            if not validate_rating(rating):
                raise ValueError(f"Invalid rating: {rating}")
            query['rating'] = rating
        
        # Parse sorting
        sort_field, sort_direction = 'recitation_date', -1
        if ' ' in order_by:
            field, direction = order_by.split(' ', 1)
            sort_field = field
            sort_direction = 1 if direction.upper() == 'ASC' else -1
        
        # Execute query with sorting
        cursor = collection.find(query).sort(sort_field, sort_direction)
        
        # Apply pagination
        if offset:
            cursor = cursor.skip(offset)
        if limit:
            cursor = cursor.limit(limit)
        
        # Convert results
        recitations = []
        for doc in cursor:
            doc['id'] = str(doc['_id'])
            del doc['_id']
            recitations.append(doc)
        
        return recitations
        
    except Exception as e:
        print(f"Error getting recitations: {e}")
        return []

def update_recitation(
    recitation_id: str,
    fixed_it_date: Optional[datetime] = None,
    prev_rating: Optional[str] = None,
    notes: Optional[str] = None
) -> bool:
    """Update a recitation record."""
    if prev_rating and not validate_rating(prev_rating):
        raise ValueError(f"Invalid prev_rating: {prev_rating}")
    
    try:
        conn = get_mongo_connection()
        collection = conn.database.recitations
        
        # Build update document
        update_doc = {'updated_at': datetime.utcnow()}
        
        if fixed_it_date is not None:
            update_doc['fixed_it_date'] = fixed_it_date
        
        if prev_rating is not None:
            update_doc['prev_rating'] = prev_rating
        
        if notes is not None:
            update_doc['notes'] = notes
        
        if len(update_doc) == 1:  # Only updated_at
            return False
        
        # Handle both ObjectId and integer IDs
        try:
            if isinstance(recitation_id, str) and len(recitation_id) == 24:
                query_id = ObjectId(recitation_id)
            else:
                query_id = int(recitation_id)
        except (ValueError, TypeError):
            return False
        
        result = collection.update_one(
            {'_id': query_id},
            {'$set': update_doc}
        )
        
        return result.modified_count > 0
        
    except Exception as e:
        print(f"Error updating recitation: {e}")
        return False

def delete_recitation(recitation_id: str) -> bool:
    """Delete a recitation record."""
    try:
        conn = get_mongo_connection()
        collection = conn.database.recitations
        
        # Handle both ObjectId and integer IDs
        try:
            if isinstance(recitation_id, str) and len(recitation_id) == 24:
                query_id = ObjectId(recitation_id)
            else:
                query_id = int(recitation_id)
        except (ValueError, TypeError):
            return False
        
        result = collection.delete_one({'_id': query_id})
        return result.deleted_count > 0
        
    except Exception as e:
        print(f"Error deleting recitation: {e}")
        return False

def get_recitation_stats() -> Dict[str, Any]:
    """Get statistics about recitations."""
    try:
        conn = get_mongo_connection()
        collection = conn.database.recitations
        
        # Total recitations
        total = collection.count_documents({})
        
        # Rating distribution
        pipeline = [
            {'$group': {'_id': '$rating', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        rating_dist = list(collection.aggregate(pipeline))
        rating_distribution = {item['_id']: item['count'] for item in rating_dist}
        
        # Pages covered
        pages_pipeline = [
            {'$group': {'_id': '$page_number'}},
            {'$count': 'pages_covered'}
        ]
        pages_result = list(collection.aggregate(pages_pipeline))
        pages_covered = pages_result[0]['pages_covered'] if pages_result else 0
        
        # Surahs covered
        surahs_pipeline = [
            {'$group': {'_id': '$surah_name'}},
            {'$count': 'surahs_covered'}
        ]
        surahs_result = list(collection.aggregate(surahs_pipeline))
        surahs_covered = surahs_result[0]['surahs_covered'] if surahs_result else 0
        
        # Recent activity (last 7 days)
        seven_days_ago = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        seven_days_ago = seven_days_ago.replace(day=seven_days_ago.day - 7)
        
        recent_activity = collection.count_documents({
            'recitation_date': {'$gte': seven_days_ago}
        })
        
        return {
            'total_recitations': total,
            'rating_distribution': rating_distribution,
            'pages_covered': pages_covered,
            'surahs_covered': surahs_covered,
            'recent_activity_7_days': recent_activity
        }
        
    except Exception as e:
        print(f"Error getting stats: {e}")
        return {
            'total_recitations': 0,
            'rating_distribution': {},
            'pages_covered': 0,
            'surahs_covered': 0,
            'recent_activity_7_days': 0
        }

def backup_database(backup_path: str) -> bool:
    """Create a backup of the database (MongoDB export)."""
    try:
        # For MongoDB, we'd typically use mongodump
        # This is a simplified version that exports to JSON
        conn = get_mongo_connection()
        
        backup_data = {
            'recitations': list(conn.database.recitations.find({})),
            'export_date': datetime.utcnow().isoformat(),
            'database': conn.database.name
        }
        
        # Convert ObjectIds to strings for JSON serialization
        for recitation in backup_data['recitations']:
            if '_id' in recitation:
                recitation['_id'] = str(recitation['_id'])
        
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, indent=2, default=str)
        
        return True
        
    except Exception as e:
        print(f"Backup failed: {e}")
        return False

def export_recitations_to_csv(file_path: str) -> bool:
    """Export all recitations to CSV format."""
    import csv
    
    try:
        recitations = get_all_recitations()
        
        if not recitations:
            # Create empty CSV file
            with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow(['No data to export'])
            return True
        
        with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = recitations[0].keys()
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            writer.writeheader()
            for recitation in recitations:
                # Convert mistakes list to string for CSV
                if recitation.get('manual_mistakes'):
                    recitation['manual_mistakes'] = ','.join(map(str, recitation['manual_mistakes']))
                writer.writerow(recitation)
        
        return True
        
    except Exception as e:
        print(f"CSV export failed: {e}")
        return False

# QUL Data Functions (for page layout and word data)
def get_pages_mongo(page_number=None):
    """Get page layout data from MongoDB."""
    try:
        conn = get_mongo_connection()
        collection = conn.database.quran_pages
        
        if page_number is not None:
            query = {'page_number': page_number}
        else:
            query = {}
        
        cursor = collection.find(query).sort('line_number', 1)
        return [dict(doc) for doc in cursor]
        
    except Exception as e:
        print(f"Error getting pages: {e}")
        return []

def get_words_mongo(word_ids=None):
    """Get word data from MongoDB."""
    try:
        conn = get_mongo_connection()
        collection = conn.database.quran_words
        
        if word_ids:
            query = {'id': {'$in': word_ids}}
        else:
            query = {}
        
        cursor = collection.find(query)
        return [dict(doc) for doc in cursor]
        
    except Exception as e:
        print(f"Error getting words: {e}")
        return []

# Initialize database when module is imported
if __name__ == '__main__':
    init_database()
    print("MongoDB database initialized successfully!")