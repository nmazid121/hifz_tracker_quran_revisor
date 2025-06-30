# MongoDB Atlas Migration Guide

## 🎯 **Overview**
This guide walks you through migrating your Quran Hifz Tracker application from local SQLite databases to MongoDB Atlas cloud database for production deployment.

## 📋 **Prerequisites**
- QUL implementation completed (local SQLite working)
- Backend Flask server running locally
- Access to create MongoDB Atlas account

## 🚀 **Phase 1: MongoDB Atlas Setup**

### Step 1: Create MongoDB Atlas Account
1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Click "Start Free" and create account
3. Choose "Build a cluster" → "Shared Clusters" (Free Tier)
4. Select:
   - **Cloud Provider**: AWS (recommended)
   - **Region**: Choose closest to your users
   - **Cluster Name**: `quran-hifz-cluster`
5. Click "Create Cluster" (takes 1-3 minutes)

### Step 2: Configure Database Access
1. **Create Database User**:
   - Go to "Database Access" in left sidebar
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Username: `quran_app_user`
   - Password: Generate strong password and save it
   - Database User Privileges: "Read and write to any database"
   - Click "Add User"

2. **Configure Network Access**:
   - Go to "Network Access" in left sidebar
   - Click "Add IP Address"
   - Choose "Allow Access from Anywhere" (0.0.0.0/0)
   - Click "Confirm"
   - ⚠️ **Note**: For production, restrict to specific IPs

### Step 3: Get Connection String
1. Go to "Clusters" and click "Connect"
2. Choose "Connect your application"
3. Select "Python" and version "3.6 or later"
4. Copy the connection string:
   ```
   mongodb+srv://quran_app_user:<password>@quran-hifz-cluster.xxxxx.mongodb.net/<dbname>?retryWrites=true&w=majority
   ```
5. Replace `<password>` with actual password
6. Replace `<dbname>` with `quran_hifz_tracker`

## 🔧 **Phase 2: Backend Preparation**

### Step 1: Install Dependencies
```bash
cd backend
pip install pymongo python-dotenv
pip freeze > requirements.txt
```

### Step 2: Create Environment File
Create `backend/.env`:
```env
# MongoDB Configuration
MONGODB_URI=mongodb+srv://quran_app_user:YOUR_PASSWORD@quran-hifz-cluster.xxxxx.mongodb.net/quran_hifz_tracker?retryWrites=true&w=majority

# Optional: Local SQLite paths (for migration)
QUL_LAYOUT_DB=../qul_downloads/qudratullah-indopak-15-lines.db
QUL_SCRIPT_DB=../qul_downloads/indopak.db
```

### Step 3: Create Database Connection Module
Create `backend/mongodb_connection.py`:
```python
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

def get_mongodb_client():
    """Get MongoDB client connection"""
    try:
        client = MongoClient(os.getenv('MONGODB_URI'))
        # Test connection
        client.admin.command('ping')
        print("✅ MongoDB connection successful")
        return client
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        return None

def get_database():
    """Get the main database"""
    client = get_mongodb_client()
    if client:
        return client['quran_hifz_tracker']
    return None

# Collections
def get_collections():
    """Get all collections"""
    db = get_database()
    if db:
        return {
            'pages': db.pages,
            'words': db.words,
            'surahs': db.surahs,
            'recitations': db.recitations
        }
    return None
```

## 🔄 **Phase 3: Data Migration Script**

Create `backend/migrate_to_mongodb.py`:
```python
#!/usr/bin/env python3
"""
One-time migration script to move QUL data from SQLite to MongoDB Atlas
"""

import sqlite3
import json
from datetime import datetime
from mongodb_connection import get_collections
from database import init_database, get_all_recitations

def migrate_qul_layout_data():
    """Migrate page layout data from QUL SQLite to MongoDB"""
    print("📄 Migrating page layout data...")
    
    collections = get_collections()
    if not collections:
        return False
    
    # Connect to SQLite
    conn = sqlite3.connect('../qul_downloads/qudratullah-indopak-15-lines.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get all pages data
    cursor.execute('SELECT * FROM pages ORDER BY page_number, line_number')
    pages_data = []
    
    for row in cursor.fetchall():
        page_doc = {
            'page_number': row['page_number'],
            'line_number': row['line_number'],
            'line_type': row['line_type'],
            'is_centered': bool(row['is_centered']),
            'first_word_id': row['first_word_id'] if row['first_word_id'] else None,
            'last_word_id': row['last_word_id'] if row['last_word_id'] else None,
            'surah_number': row['surah_number'],
            'created_at': datetime.utcnow()
        }
        pages_data.append(page_doc)
    
    conn.close()
    
    # Insert into MongoDB
    if pages_data:
        collections['pages'].delete_many({})  # Clear existing
        result = collections['pages'].insert_many(pages_data)
        print(f"✅ Migrated {len(result.inserted_ids)} page layout records")
        return True
    
    return False

def migrate_qul_words_data():
    """Migrate words data from QUL SQLite to MongoDB"""
    print("📝 Migrating words data...")
    
    collections = get_collections()
    if not collections:
        return False
    
    # Connect to SQLite
    conn = sqlite3.connect('../qul_downloads/indopak.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get all words data
    cursor.execute('SELECT * FROM words ORDER BY id')
    words_data = []
    
    for row in cursor.fetchall():
        word_doc = {
            'id': row['id'],
            'text': row['text'],
            'created_at': datetime.utcnow()
        }
        words_data.append(word_doc)
    
    conn.close()
    
    # Insert into MongoDB in batches (words table is large)
    if words_data:
        collections['words'].delete_many({})  # Clear existing
        
        batch_size = 1000
        total_inserted = 0
        
        for i in range(0, len(words_data), batch_size):
            batch = words_data[i:i + batch_size]
            result = collections['words'].insert_many(batch)
            total_inserted += len(result.inserted_ids)
            print(f"  Inserted batch {i//batch_size + 1}: {len(result.inserted_ids)} words")
        
        print(f"✅ Migrated {total_inserted} word records")
        return True
    
    return False

def migrate_surah_names():
    """Migrate surah names to MongoDB"""
    print("📚 Creating surah names collection...")
    
    collections = get_collections()
    if not collections:
        return False
    
    surah_names = {
        1: "الفاتحة", 2: "البقرة", 3: "آل عمران", 4: "النساء", 5: "المائدة",
        6: "الأنعام", 7: "الأعراف", 8: "الأنفال", 9: "التوبة", 10: "يونس",
        11: "هود", 12: "يوسف", 13: "الرعد", 14: "إبراهيم", 15: "الحجر",
        16: "النحل", 17: "الإسراء", 18: "الكهف", 19: "مريم", 20: "طه",
        21: "الأنبياء", 22: "الحج", 23: "المؤمنون", 24: "النور", 25: "الفرقان",
        26: "الشعراء", 27: "النمل", 28: "القصص", 29: "العنكبوت", 30: "الروم",
        31: "لقمان", 32: "السجدة", 33: "الأحزاب", 34: "سبأ", 35: "فاطر",
        36: "يس", 37: "الصافات", 38: "ص", 39: "الزمر", 40: "غافر",
        41: "فصلت", 42: "الشورى", 43: "الزخرف", 44: "الدخان", 45: "الجاثية",
        46: "الأحقاف", 47: "محمد", 48: "الفتح", 49: "الحجرات", 50: "ق",
        51: "الذاريات", 52: "الطور", 53: "النجم", 54: "القمر", 55: "الرحمن",
        56: "الواقعة", 57: "الحديد", 58: "المجادلة", 59: "الحشر", 60: "الممتحنة",
        61: "الصف", 62: "الجمعة", 63: "المنافقون", 64: "التحريم", 65: "الملك",
        66: "القلم", 67: "الحاقة", 68: "المعارج", 69: "نوح", 70: "الجن",
        71: "المزمل", 72: "المدثر", 73: "القيامة", 74: "الإنسان", 75: "المرسلات",
        76: "النبأ", 77: "النازعات", 78: "عبس", 79: "التكوير", 80: "الانفطار",
        81: "المطففين", 82: "الانشقاق", 83: "البروج", 84: "الطارق", 85: "الأعلى",
        86: "الغاشية", 87: "الفجر", 88: "البلد", 89: "الشمس", 90: "الليل",
        91: "الضحى", 92: "الشرح", 93: "التين", 94: "العلق", 95: "البينة",
        96: "الزلزلة", 97: "العاديات", 98: "القارعة", 99: "التكاثر", 100: "العصر",
        101: "الهمزة", 102: "الفيل", 103: "قريش", 104: "الماعون", 105: "الكوثر",
        106: "الكافرون", 107: "النصر", 108: "المسد", 109: "الإخلاص", 110: "الفلق",
        111: "الناس"
    }
    
    surah_docs = []
    for number, name in surah_names.items():
        surah_doc = {
            'number': number,
            'arabic_name': name,
            'created_at': datetime.utcnow()
        }
        surah_docs.append(surah_doc)
    
    collections['surahs'].delete_many({})  # Clear existing
    result = collections['surahs'].insert_many(surah_docs)
    print(f"✅ Created {len(result.inserted_ids)} surah records")
    return True

def migrate_existing_recitations():
    """Migrate existing recitation data"""
    print("🎤 Migrating existing recitations...")
    
    collections = get_collections()
    if not collections:
        return False
    
    # Get existing recitations from SQLite
    init_database()  # Initialize local database
    recitations = get_all_recitations()
    
    if not recitations:
        print("ℹ️ No existing recitations to migrate")
        return True
    
    # Convert to MongoDB documents
    recitation_docs = []
    for rec in recitations:
        # Convert SQLite record to MongoDB document
        doc = dict(rec)
        doc['created_at'] = datetime.utcnow()
        recitation_docs.append(doc)
    
    collections['recitations'].delete_many({})  # Clear existing
    result = collections['recitations'].insert_many(recitation_docs)
    print(f"✅ Migrated {len(result.inserted_ids)} recitation records")
    return True

def create_indexes():
    """Create database indexes for performance"""
    print("📊 Creating database indexes...")
    
    collections = get_collections()
    if not collections:
        return False
    
    # Pages collection indexes
    collections['pages'].create_index('page_number')
    collections['pages'].create_index([('page_number', 1), ('line_number', 1)])
    collections['pages'].create_index('surah_number')
    
    # Words collection indexes
    collections['words'].create_index('id', unique=True)
    
    # Surahs collection indexes
    collections['surahs'].create_index('number', unique=True)
    
    # Recitations collection indexes
    collections['recitations'].create_index('page_number')
    collections['recitations'].create_index('surah_name')
    collections['recitations'].create_index('recitation_date')
    
    print("✅ Database indexes created")
    return True

def verify_migration():
    """Verify that migration was successful"""
    print("🔍 Verifying migration...")
    
    collections = get_collections()
    if not collections:
        return False
    
    # Count records
    pages_count = collections['pages'].count_documents({})
    words_count = collections['words'].count_documents({})
    surahs_count = collections['surahs'].count_documents({})
    recitations_count = collections['recitations'].count_documents({})
    
    print(f"📊 Migration Summary:")
    print(f"   - Pages: {pages_count:,} records")
    print(f"   - Words: {words_count:,} records")
    print(f"   - Surahs: {surahs_count} records")
    print(f"   - Recitations: {recitations_count} records")
    
    # Test a sample query
    try:
        sample_page = collections['pages'].find_one({'page_number': 1})
        sample_word = collections['words'].find_one({'id': 1})
        
        if sample_page and sample_word:
            print("✅ Sample queries successful - migration verified!")
            return True
        else:
            print("❌ Sample queries failed - migration may be incomplete")
            return False
    except Exception as e:
        print(f"❌ Verification failed: {e}")
        return False

def main():
    """Run the complete migration"""
    print("🚀 Starting MongoDB Atlas Migration")
    print("=" * 50)
    
    steps = [
        ("QUL Page Layout Data", migrate_qul_layout_data),
        ("QUL Words Data", migrate_qul_words_data),
        ("Surah Names", migrate_surah_names),
        ("Existing Recitations", migrate_existing_recitations),
        ("Database Indexes", create_indexes),
        ("Migration Verification", verify_migration)
    ]
    
    for step_name, step_func in steps:
        print(f"\n📋 {step_name}")
        success = step_func()
        if not success:
            print(f"❌ Migration failed at: {step_name}")
            return False
    
    print("\n" + "=" * 50)
    print("🎉 Migration completed successfully!")
    print("🔄 Next step: Update app.py to use MongoDB")
    return True

if __name__ == "__main__":
    main()
```

## 🔧 **Phase 4: Update Backend Code**

### Step 1: Modify app.py
Update the database functions in `app.py` to use MongoDB:

```python
# Add at the top of app.py
from mongodb_connection import get_collections

# Replace the existing get_pages function
def get_pages(page_number=None):
    collections = get_collections()
    if not collections:
        return []
    
    if page_number is not None:
        cursor = collections['pages'].find({'page_number': page_number}).sort('line_number', 1)
    else:
        cursor = collections['pages'].find({}).sort([('page_number', 1), ('line_number', 1)])
    
    return list(cursor)

# Replace the existing get_words function
def get_words(word_ids=None):
    collections = get_collections()
    if not collections:
        return []
    
    if word_ids:
        cursor = collections['words'].find({'id': {'$in': word_ids}})
    else:
        cursor = collections['words'].find({}).sort('id', 1)
    
    return list(cursor)

# Update surah names endpoint
@app.route('/api/quran/surah-names')
def get_surah_names():
    collections = get_collections()
    if not collections:
        return jsonify({'error': 'Database connection failed'}), 500
    
    surahs = collections['surahs'].find({}).sort('number', 1)
    surah_names = {str(surah['number']): surah['arabic_name'] for surah in surahs}
    return jsonify(surah_names)
```

## 🧪 **Phase 5: Testing**

### Step 1: Test Migration
```bash
cd backend
python3 migrate_to_mongodb.py
```

### Step 2: Test Application
```bash
# Start backend with MongoDB
python3 app.py

# In another terminal, test endpoints
python3 ../test_qul_endpoints.py
```

### Step 3: Test Frontend
```bash
cd frontend
npm start
```

## 🚨 **Troubleshooting**

### Common Issues:
1. **Connection Timeout**: Check network access whitelist in Atlas
2. **Authentication Failed**: Verify username/password in connection string
3. **Database Not Found**: Ensure database name matches in connection string
4. **Slow Queries**: Check if indexes were created properly

### Recovery Plan:
- Keep local SQLite files as backup
- Can revert to SQLite if MongoDB migration fails
- Test thoroughly in development before production

## 🎯 **Next Steps After Migration**
1. Update deployment scripts for production
2. Set up MongoDB monitoring and alerts
3. Implement data backup procedures
4. Optimize queries based on usage patterns
5. Plan for scaling as user base grows

---

**🎉 Once completed, your application will be ready for production deployment with MongoDB Atlas!**