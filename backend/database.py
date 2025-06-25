import sqlite3
import os
import json
from datetime import datetime
from typing import List, Dict, Optional, Any

# Database file path
DB_PATH = os.path.join(os.path.dirname(__file__), 'hifz_tracker.db')

def get_db_connection():
    """Create and return a database connection with proper configuration."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Enable dict-like access to rows
    return conn

def init_database():
    """Initialize the database with the required schema."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create recitations table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS recitations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            page_number INTEGER NOT NULL,
            surah_name TEXT NOT NULL,
            juz INTEGER NOT NULL,
            recitation_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            rating TEXT NOT NULL CHECK (rating IN ('Perfect', 'Good', 'Okay', 'Bad', 'Rememorize')),
            manual_mistakes TEXT, -- JSON array of word IDs
            notes TEXT,
            fixed_it_date DATETIME,
            prev_rating TEXT CHECK (prev_rating IN ('Perfect', 'Good', 'Okay', 'Bad', 'Rememorize')),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create indexes for better query performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_recitations_page_number ON recitations(page_number)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_recitations_surah_name ON recitations(surah_name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_recitations_juz ON recitations(juz)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_recitations_recitation_date ON recitations(recitation_date)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_recitations_rating ON recitations(rating)')
    
    # Create trigger to update updated_at timestamp
    cursor.execute('''
        CREATE TRIGGER IF NOT EXISTS update_recitations_updated_at
        AFTER UPDATE ON recitations
        BEGIN
            UPDATE recitations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
    ''')
    
    conn.commit()
    conn.close()

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
) -> int:
    """Create a new recitation record and return its ID."""
    if not validate_rating(rating):
        raise ValueError(f"Invalid rating: {rating}. Must be one of: Perfect, Good, Okay, Bad, Rememorize")
    
    if manual_mistakes and not validate_mistakes(manual_mistakes):
        raise ValueError("manual_mistakes must be a list of integers")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO recitations (page_number, surah_name, juz, rating, manual_mistakes, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            page_number,
            surah_name,
            juz,
            rating,
            json.dumps(manual_mistakes) if manual_mistakes else None,
            notes
        ))
        
        recitation_id = cursor.lastrowid
        conn.commit()
        return recitation_id
    finally:
        conn.close()

def get_recitation(recitation_id: int) -> Optional[Dict[str, Any]]:
    """Get a specific recitation by ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('SELECT * FROM recitations WHERE id = ?', (recitation_id,))
        row = cursor.fetchone()
        
        if row:
            recitation = dict(row)
            # Parse JSON mistakes back to list
            if recitation['manual_mistakes']:
                recitation['manual_mistakes'] = json.loads(recitation['manual_mistakes'])
            return recitation
        return None
    finally:
        conn.close()

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
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Build query with filters
        query = 'SELECT * FROM recitations WHERE 1=1'
        params = []
        
        if page_number is not None:
            query += ' AND page_number = ?'
            params.append(page_number)
        
        if surah_name is not None:
            query += ' AND surah_name = ?'
            params.append(surah_name)
        
        if juz is not None:
            query += ' AND juz = ?'
            params.append(juz)
        
        if rating is not None:
            if not validate_rating(rating):
                raise ValueError(f"Invalid rating: {rating}")
            query += ' AND rating = ?'
            params.append(rating)
        
        # Add ordering
        query += f' ORDER BY {order_by}'
        
        # Add pagination
        if limit is not None:
            query += ' LIMIT ?'
            params.append(limit)
            
            if offset is not None:
                query += ' OFFSET ?'
                params.append(offset)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # Convert to list of dicts and parse JSON mistakes
        recitations = []
        for row in rows:
            recitation = dict(row)
            if recitation['manual_mistakes']:
                recitation['manual_mistakes'] = json.loads(recitation['manual_mistakes'])
            recitations.append(recitation)
        
        return recitations
    finally:
        conn.close()

def update_recitation(
    recitation_id: int,
    fixed_it_date: Optional[datetime] = None,
    prev_rating: Optional[str] = None,
    notes: Optional[str] = None
) -> bool:
    """Update a recitation record."""
    if prev_rating and not validate_rating(prev_rating):
        raise ValueError(f"Invalid prev_rating: {prev_rating}")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Build update query dynamically
        update_fields = []
        params = []
        
        if fixed_it_date is not None:
            update_fields.append('fixed_it_date = ?')
            params.append(fixed_it_date.isoformat())
        
        if prev_rating is not None:
            update_fields.append('prev_rating = ?')
            params.append(prev_rating)
        
        if notes is not None:
            update_fields.append('notes = ?')
            params.append(notes)
        
        if not update_fields:
            return False  # Nothing to update
        
        query = f'UPDATE recitations SET {", ".join(update_fields)} WHERE id = ?'
        params.append(recitation_id)
        
        cursor.execute(query, params)
        conn.commit()
        
        return cursor.rowcount > 0
    finally:
        conn.close()

def delete_recitation(recitation_id: int) -> bool:
    """Delete a recitation record."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('DELETE FROM recitations WHERE id = ?', (recitation_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()

def get_recitation_stats() -> Dict[str, Any]:
    """Get statistics about recitations."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Total recitations
        cursor.execute('SELECT COUNT(*) as total FROM recitations')
        total = cursor.fetchone()['total']
        
        # Rating distribution
        cursor.execute('''
            SELECT rating, COUNT(*) as count 
            FROM recitations 
            GROUP BY rating 
            ORDER BY count DESC
        ''')
        rating_distribution = {row['rating']: row['count'] for row in cursor.fetchall()}
        
        # Pages covered
        cursor.execute('SELECT COUNT(DISTINCT page_number) as pages_covered FROM recitations')
        pages_covered = cursor.fetchone()['pages_covered']
        
        # Surahs covered
        cursor.execute('SELECT COUNT(DISTINCT surah_name) as surahs_covered FROM recitations')
        surahs_covered = cursor.fetchone()['surahs_covered']
        
        # Recent activity (last 7 days)
        cursor.execute('''
            SELECT COUNT(*) as recent_count 
            FROM recitations 
            WHERE recitation_date >= datetime('now', '-7 days')
        ''')
        recent_activity = cursor.fetchone()['recent_count']
        
        return {
            'total_recitations': total,
            'rating_distribution': rating_distribution,
            'pages_covered': pages_covered,
            'surahs_covered': surahs_covered,
            'recent_activity_7_days': recent_activity
        }
    finally:
        conn.close()

def backup_database(backup_path: str) -> bool:
    """Create a backup of the database."""
    try:
        import shutil
        shutil.copy2(DB_PATH, backup_path)
        return True
    except Exception as e:
        print(f"Backup failed: {e}")
        return False

def export_recitations_to_csv(file_path: str) -> bool:
    """Export all recitations to CSV format."""
    import csv
    
    try:
        recitations = get_all_recitations()
        
        with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
            if not recitations:
                return True  # Empty file is still a success
            
            fieldnames = recitations[0].keys()
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            writer.writeheader()
            for recitation in recitations:
                # Convert mistakes list to string for CSV
                if recitation['manual_mistakes']:
                    recitation['manual_mistakes'] = ','.join(map(str, recitation['manual_mistakes']))
                writer.writerow(recitation)
        
        return True
    except Exception as e:
        print(f"CSV export failed: {e}")
        return False

# Initialize database when module is imported
if __name__ == '__main__':
    init_database()
    print("Database initialized successfully!") 