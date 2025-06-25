import os
import sqlite3
from flask import Flask, g, jsonify, request
from flask_cors import CORS
import time
from functools import wraps
import re
from datetime import datetime

# Import our database module
from database import (
    init_database, create_recitation, get_recitation, get_all_recitations,
    update_recitation, delete_recitation, get_recitation_stats,
    backup_database, export_recitations_to_csv
)

app = Flask(__name__)
CORS(app)

# Initialize database on startup
init_database()

# Paths to QUL databases (update if needed)
QUL_LAYOUT_DB = os.path.join(os.path.dirname(__file__), '../qul_downloads/qudratullah-indopak-15-lines.db')
QUL_SCRIPT_DB = os.path.join(os.path.dirname(__file__), '../qul_downloads/indopak.db')

# --- Simple In-Memory Cache with TTL ---
CACHE = {}
CACHE_TTL = 60  # seconds

def cache_with_ttl(key_func):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            key = key_func(*args, **kwargs)
            now = time.time()
            if key in CACHE:
                value, timestamp = CACHE[key]
                if now - timestamp < CACHE_TTL:
                    return value
            result = func(*args, **kwargs)
            CACHE[key] = (result, now)
            return result
        return wrapper
    return decorator

# --- Database Connection Utilities ---
def get_db(db_path):
    db = getattr(g, '_db_' + os.path.basename(db_path), None)
    if db is None:
        db = sqlite3.connect(db_path)
        db.row_factory = sqlite3.Row
        setattr(g, '_db_' + os.path.basename(db_path), db)
    return db

@app.teardown_appcontext
def close_db(error):
    for attr in dir(g):
        if attr.startswith('_db_'):
            db = getattr(g, attr)
            if db is not None:
                db.close()

# --- Models (as helper functions) ---
def get_pages(page_number=None):
    db = get_db(QUL_LAYOUT_DB)
    if page_number is not None:
        cur = db.execute('SELECT * FROM pages WHERE page_number = ?', (page_number,))
    else:
        cur = db.execute('SELECT * FROM pages')
    return [dict(row) for row in cur.fetchall()]

def get_words(word_ids=None):
    db = get_db(QUL_SCRIPT_DB)
    if word_ids:
        placeholders = ','.join('?' for _ in word_ids)
        cur = db.execute(f'SELECT * FROM words WHERE id IN ({placeholders})', word_ids)
    else:
        cur = db.execute('SELECT * FROM words')
    return [dict(row) for row in cur.fetchall()]

# --- Cached Data Fetchers ---
@cache_with_ttl(lambda page_number: f"page:{page_number}")
def cached_get_page(page_number):
    lines = get_pages(page_number)
    word_ids = []
    for line in lines:
        if line['line_type'] == 'ayah':
            word_ids.extend(range(line['first_word_id'], line['last_word_id'] + 1))
    words = get_words(word_ids) if word_ids else []
    word_map = {w['id']: w for w in words}
    # When building the pageData response, ensure first_word_id and last_word_id are None if not present
    page_data = []
    for line in lines:
        page_data.append({
            "line_number": line["line_number"],
            "line_type": line["line_type"],
            "is_centered": line["is_centered"],
            "first_word_id": line["first_word_id"] if line["first_word_id"] is not None and line["first_word_id"] != '' else None,
            "last_word_id": line["last_word_id"] if line["last_word_id"] is not None and line["last_word_id"] != '' else None,
            "page_number": line["page_number"],
            "surah_number": line["surah_number"]
        })
    return {'pageData': page_data, 'wordData': word_map}

@cache_with_ttl(lambda juz_number: f"juz:{juz_number}")
def cached_get_juz(juz_number):
    db = get_db(QUL_LAYOUT_DB)
    cur = db.execute('SELECT DISTINCT page_number FROM pages WHERE juz = ?', (juz_number,))
    page_numbers = [row['page_number'] for row in cur.fetchall()]
    result = {}
    for page_number in page_numbers:
        result[page_number] = cached_get_page(page_number)
    return result

@cache_with_ttl(lambda surah_number: f"surah:{surah_number}")
def cached_get_surah(surah_number):
    db = get_db(QUL_LAYOUT_DB)
    cur = db.execute('SELECT DISTINCT page_number FROM pages WHERE surah_number = ?', (surah_number,))
    page_numbers = [row['page_number'] for row in cur.fetchall()]
    result = {}
    for page_number in page_numbers:
        result[page_number] = cached_get_page(page_number)
    return result

# --- Data Transformation Utilities ---
def remove_diacritics(text):
    # Remove Arabic diacritics (tashkeel)
    arabic_diacritics = re.compile(r'[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]')
    return arabic_diacritics.sub('', text)

def enrich_word_metadata(word):
    # Add normalized text and other metadata
    word['text_normalized'] = remove_diacritics(word['text'])
    # Add more enrichment as needed
    return word

def transform_word_map(word_map):
    # Apply enrichment to all words
    return {k: enrich_word_metadata(dict(v)) for k, v in word_map.items()}

# --- Test Route ---
@app.route('/api/quran/test')
def test_connection():
    try:
        pages = get_pages(1)
        words = get_words([1, 2, 3])
        return jsonify({
            'pages_sample': pages,
            'words_sample': words
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- API Endpoints for QUL Data ---
@app.route('/api/quran/page/<int:page_number>')
def get_page_data(page_number):
    try:
        data = cached_get_page(page_number)
        if not data['pageData']:
            return jsonify({'error': 'Page not found'}), 404
        # Transform word map
        data['wordData'] = transform_word_map(data['wordData'])
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/quran/juz/<int:juz_number>')
def get_juz_data(juz_number):
    try:
        data = cached_get_juz(juz_number)
        if not data:
            return jsonify({'error': 'Juz not found'}), 404
        # Transform word maps for each page
        for page in data:
            data[page]['wordData'] = transform_word_map(data[page]['wordData'])
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/quran/surah/<int:surah_number>')
def get_surah_data(surah_number):
    try:
        data = cached_get_surah(surah_number)
        if not data:
            return jsonify({'error': 'Surah not found'}), 404
        # Transform word maps for each page
        for page in data:
            data[page]['wordData'] = transform_word_map(data[page]['wordData'])
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Recitation API Endpoints ---

@app.route('/api/recitations', methods=['POST'])
def create_recitation_endpoint():
    """Create a new recitation session."""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['page_number', 'surah_name', 'juz', 'rating']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Create the recitation
        recitation_id = create_recitation(
            page_number=data['page_number'],
            surah_name=data['surah_name'],
            juz=data['juz'],
            rating=data['rating'],
            manual_mistakes=data.get('manual_mistakes'),
            notes=data.get('notes')
        )
        
        return jsonify({
            'message': 'Recitation created successfully',
            'id': recitation_id
        }), 201
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Failed to create recitation: {str(e)}'}), 500

@app.route('/api/recitations', methods=['GET'])
def get_recitations_endpoint():
    """Get all recitations with optional filtering and pagination."""
    try:
        # Get query parameters
        page_number = request.args.get('page_number', type=int)
        surah_name = request.args.get('surah_name')
        juz = request.args.get('juz', type=int)
        rating = request.args.get('rating')
        limit = request.args.get('limit', type=int, default=50)
        offset = request.args.get('offset', type=int, default=0)
        order_by = request.args.get('order_by', default='recitation_date DESC')
        
        # Validate order_by to prevent SQL injection
        allowed_order_fields = ['recitation_date', 'page_number', 'surah_name', 'juz', 'rating', 'created_at']
        order_field, order_direction = order_by.split() if ' ' in order_by else (order_by, 'ASC')
        
        if order_field not in allowed_order_fields:
            order_by = 'recitation_date DESC'
        
        # Get recitations
        recitations = get_all_recitations(
            page_number=page_number,
            surah_name=surah_name,
            juz=juz,
            rating=rating,
            limit=limit,
            offset=offset,
            order_by=order_by
        )
        
        return jsonify({
            'recitations': recitations,
            'total': len(recitations),
            'limit': limit,
            'offset': offset
        })
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Failed to get recitations: {str(e)}'}), 500

@app.route('/api/recitations/<int:recitation_id>', methods=['GET'])
def get_recitation_endpoint(recitation_id):
    """Get a specific recitation by ID."""
    try:
        recitation = get_recitation(recitation_id)
        if not recitation:
            return jsonify({'error': 'Recitation not found'}), 404
        
        return jsonify(recitation)
        
    except Exception as e:
        return jsonify({'error': f'Failed to get recitation: {str(e)}'}), 500

@app.route('/api/recitations/<int:recitation_id>', methods=['PUT'])
def update_recitation_endpoint(recitation_id):
    """Update a recitation record."""
    try:
        data = request.get_json()
        
        # Check if recitation exists
        existing = get_recitation(recitation_id)
        if not existing:
            return jsonify({'error': 'Recitation not found'}), 404
        
        # Prepare update data
        update_data = {}
        
        if 'fixed_it_date' in data:
            if data['fixed_it_date']:
                try:
                    update_data['fixed_it_date'] = datetime.fromisoformat(data['fixed_it_date'].replace('Z', '+00:00'))
                except ValueError:
                    return jsonify({'error': 'Invalid fixed_it_date format. Use ISO format.'}), 400
            else:
                update_data['fixed_it_date'] = None
        
        if 'prev_rating' in data:
            update_data['prev_rating'] = data['prev_rating']
        
        if 'notes' in data:
            update_data['notes'] = data['notes']
        
        # Update the recitation
        success = update_recitation(recitation_id, **update_data)
        
        if success:
            return jsonify({'message': 'Recitation updated successfully'})
        else:
            return jsonify({'error': 'No changes made to recitation'}), 400
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Failed to update recitation: {str(e)}'}), 500

@app.route('/api/recitations/<int:recitation_id>', methods=['DELETE'])
def delete_recitation_endpoint(recitation_id):
    """Delete a recitation record."""
    try:
        # Check if recitation exists
        existing = get_recitation(recitation_id)
        if not existing:
            return jsonify({'error': 'Recitation not found'}), 404
        
        # Delete the recitation
        success = delete_recitation(recitation_id)
        
        if success:
            return jsonify({'message': 'Recitation deleted successfully'})
        else:
            return jsonify({'error': 'Failed to delete recitation'}), 500
        
    except Exception as e:
        return jsonify({'error': f'Failed to delete recitation: {str(e)}'}), 500

@app.route('/api/recitations/stats', methods=['GET'])
def get_recitation_stats_endpoint():
    """Get statistics about recitations."""
    try:
        stats = get_recitation_stats()
        return jsonify(stats)
        
    except Exception as e:
        return jsonify({'error': f'Failed to get stats: {str(e)}'}), 500

@app.route('/api/recitations/export/csv', methods=['GET'])
def export_recitations_csv_endpoint():
    """Export all recitations to CSV."""
    try:
        import tempfile
        import os
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as tmp_file:
            file_path = tmp_file.name
        
        # Export to CSV
        success = export_recitations_to_csv(file_path)
        
        if success:
            from flask import send_file
            return send_file(
                file_path,
                as_attachment=True,
                download_name=f'recitations_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv',
                mimetype='text/csv'
            )
        else:
            return jsonify({'error': 'Failed to export recitations'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Failed to export recitations: {str(e)}'}), 500

@app.route('/api/recitations/backup', methods=['POST'])
def backup_database_endpoint():
    """Create a backup of the database."""
    try:
        import tempfile
        import os
        
        # Create backup directory if it doesn't exist
        backup_dir = os.path.join(os.path.dirname(__file__), 'backups')
        os.makedirs(backup_dir, exist_ok=True)
        
        # Generate backup filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = os.path.join(backup_dir, f'hifz_tracker_backup_{timestamp}.db')
        
        # Create backup
        success = backup_database(backup_path)
        
        if success:
            return jsonify({
                'message': 'Database backup created successfully',
                'backup_path': backup_path
            })
        else:
            return jsonify({'error': 'Failed to create backup'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Failed to create backup: {str(e)}'}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
