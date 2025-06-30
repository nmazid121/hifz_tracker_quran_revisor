# Hifz Tracker - Production Deployment Guide

This guide walks you through migrating your Hifz Tracker application from local SQLite databases to MongoDB Atlas for production deployment.

## 🎯 Overview

**Current State (Development):**
- ✅ Local SQLite databases (hifz_tracker.db, QUL databases)
- ✅ Flask backend on port 5001
- ✅ React frontend with Vite on port 3000
- ✅ QUL font integration and page rendering

**Target State (Production):**
- 🚀 MongoDB Atlas cloud database
- 🚀 Scalable backend deployment
- 🚀 Optimized frontend build
- 🚀 Secure production configuration

---

## 📋 Prerequisites

### 1. MongoDB Atlas Account
- Sign up at [MongoDB Atlas](https://www.mongodb.com/atlas)
- Create a new project and cluster
- Note your connection string

### 2. Dependencies
Install required Python packages:
```bash
cd backend
source venv/bin/activate
pip install pymongo python-dotenv
```

### 3. Backend Requirements Update
Add to `backend/requirements.txt`:
```
pymongo>=4.5.0
python-dotenv>=1.0.0
```

---

## 🔧 Step 1: Setup MongoDB Atlas

### 1.1 Create Atlas Cluster
1. Create a new cluster in MongoDB Atlas
2. Configure network access (add your IP or 0.0.0.0/0 for development)
3. Create a database user with read/write privileges
4. Get your connection string

### 1.2 Configure Connection
Run the interactive setup:
```bash
cd backend
python mongo_migration.py --setup
```

This will:
- Prompt for your MongoDB Atlas connection string
- Save configuration to `.env` file
- Test the connection

**Example connection string format:**
```
mongodb+srv://username:password@cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

---

## 🚀 Step 2: Data Migration

### 2.1 Run Full Migration
Migrate all data from SQLite to MongoDB Atlas:
```bash
cd backend
python mongo_migration.py --migrate
```

This will:
- ✅ Migrate recitation history (`hifz_tracker.db`)
- ✅ Migrate QUL page layout data (`qudratullah-indopak-15-lines.db`)
- ✅ Migrate QUL word data (`indopak.db`)
- ✅ Create proper indexes for performance
- ✅ Validate migration success

### 2.2 Validate Migration
Verify the migration was successful:
```bash
python mongo_migration.py --validate
```

Expected output:
```
🔍 Validating migration...
   Recitations: MongoDB=150, SQLite=150
   Pages: MongoDB=604, SQLite=604
   Words: MongoDB=77797, SQLite=77797
   recitations indexes: 6
   quran_pages indexes: 5
   quran_words indexes: 5
   ✅ Migration validation successful
```

---

## ⚙️ Step 3: Backend Configuration

### 3.1 Update Flask App for Production
Create `backend/app_production.py`:

```python
import os
from app import app

# Import MongoDB functions instead of SQLite
if os.getenv('USE_MONGODB') == 'true':
    from database_mongo import (
        get_pages_mongo as get_pages,
        get_words_mongo as get_words
    )
    print("✅ Using MongoDB Atlas for production")
else:
    from app import get_pages, get_words
    print("ℹ️ Using SQLite for development")

if __name__ == "__main__":
    port = int(os.getenv('PORT', 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
```

### 3.2 Environment Variables for Production
Create `backend/.env.production`:
```bash
# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
MONGODB_DATABASE=hifz_tracker_prod
USE_MONGODB=true

# Production Settings
FLASK_ENV=production
FLASK_DEBUG=false
PORT=5000

# Security (generate strong secrets)
SECRET_KEY=your-super-secret-key-here
```

### 3.3 Update App.py for Database Switching
Modify `backend/app.py` to support both SQLite and MongoDB:

```python
import os

# Database switching logic
if os.getenv('USE_MONGODB') == 'true':
    from database_mongo import (
        init_database, create_recitation, get_recitation, get_all_recitations,
        update_recitation, delete_recitation, get_recitation_stats,
        backup_database, export_recitations_to_csv,
        get_pages_mongo as get_pages,
        get_words_mongo as get_words
    )
    print("✅ Using MongoDB Atlas")
else:
    from database import (
        init_database, create_recitation, get_recitation, get_all_recitations,
        update_recitation, delete_recitation, get_recitation_stats,
        backup_database, export_recitations_to_csv
    )
    
    # Keep original QUL functions for SQLite
    def get_pages(page_number=None):
        # ... existing SQLite implementation
        pass
    
    def get_words(word_ids=None):
        # ... existing SQLite implementation
        pass
    
    print("ℹ️ Using SQLite for development")
```

---

## 🏗️ Step 4: Frontend Production Build

### 4.1 Update Vite Config for Production
Modify `frontend/vite.config.js`:

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: mode === 'development' ? {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false,
      }
    } : undefined,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          quran: ['@/components/MushafPage'],
        },
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
}));
```

### 4.2 Build Frontend
```bash
cd frontend
npm run build
```

This creates an optimized `dist/` folder ready for deployment.

---

## 🌍 Step 5: Deployment Options

### Option A: Vercel + Railway (Recommended)

#### Frontend (Vercel)
1. Push your code to GitHub
2. Connect to Vercel
3. Set build command: `cd frontend && npm run build`
4. Set output directory: `frontend/dist`
5. Add environment variable: `NODE_ENV=production`

#### Backend (Railway)
1. Connect your repo to Railway
2. Set start command: `cd backend && python app_production.py`
3. Add environment variables:
   ```
   USE_MONGODB=true
   MONGODB_URI=your-connection-string
   MONGODB_DATABASE=hifz_tracker_prod
   PORT=5000
   FLASK_ENV=production
   ```

### Option B: Docker Deployment

Create `Dockerfile`:
```dockerfile
# Multi-stage build
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim AS backend
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./static
COPY qul_downloads/ ./qul_downloads/

EXPOSE 5000
CMD ["python", "app_production.py"]
```

Build and run:
```bash
docker build -t hifz-tracker .
docker run -p 5000:5000 --env-file .env.production hifz-tracker
```

### Option C: Traditional VPS

1. Set up Ubuntu/CentOS server
2. Install Python 3.11, Node.js 18, nginx
3. Clone repository
4. Set up systemd service
5. Configure nginx reverse proxy

---

## 🔒 Step 6: Security & Performance

### 6.1 Environment Variables
Never commit sensitive data. Use:
- MongoDB Atlas IP whitelist
- Strong database passwords
- Environment-specific configuration

### 6.2 Optimization
- ✅ Database indexes (automatically created)
- ✅ Frontend code splitting
- ✅ Gzip compression
- ✅ CDN for static assets (fonts)

### 6.3 Monitoring
Set up monitoring for:
- Database connection health
- API response times
- Error rates
- Memory usage

---

## 🧪 Step 7: Testing Production Setup

### 7.1 Local Production Test
```bash
# Test with MongoDB but local server
cd backend
export USE_MONGODB=true
export MONGODB_URI="your-connection-string"
python app_production.py
```

### 7.2 Verify APIs
Test these endpoints:
- `GET /api/quran/test` - Connection test
- `GET /api/quran/page-layout/1` - QUL data
- `GET /api/quran/surah-names` - Surah names
- `GET /api/recitations` - Recitation history

### 7.3 Frontend Testing
Build and serve locally:
```bash
cd frontend
npm run build
npx serve dist -l 3000
```

---

## 📊 Step 8: Migration Rollback Plan

If issues arise, you can rollback:

### 8.1 Revert to SQLite
```bash
cd backend
export USE_MONGODB=false
python app.py
```

### 8.2 Re-import from Backup
If you need to restore data:
```bash
# Create backup before migration
python mongo_migration.py --validate > migration_backup.log

# If needed, re-run migration
python mongo_migration.py --migrate
```

---

## 🎉 Success Checklist

**Development → Production Migration:**
- ✅ MongoDB Atlas cluster created
- ✅ Data successfully migrated
- ✅ Migration validated
- ✅ Backend configured for MongoDB
- ✅ Frontend optimized and built
- ✅ APIs tested and working
- ✅ Production deployment completed
- ✅ Performance monitoring set up

**Key Benefits Achieved:**
- 🚀 **Scalability** - MongoDB Atlas auto-scaling
- 🔒 **Security** - Enterprise-grade security
- 📊 **Analytics** - Built-in MongoDB metrics
- 🌍 **Global** - Multi-region deployment
- 💾 **Backup** - Automated Atlas backups
- ⚡ **Performance** - Optimized indexes and queries

---

## 🆘 Troubleshooting

### Common Issues

**Connection Timeout**
```bash
# Check IP whitelist in MongoDB Atlas
# Verify connection string format
python -c "from database_mongo import get_mongo_connection; get_mongo_connection()"
```

**Migration Fails**
```bash
# Check source databases exist
ls -la hifz_tracker.db ../qul_downloads/*.db

# Verify permissions
python mongo_migration.py --validate
```

**Frontend Build Errors**
```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

**API Errors in Production**
```bash
# Check backend logs
tail -f backend.log

# Test individual endpoints
curl https://your-api.com/api/quran/test
```

---

## 📞 Support

For issues:
1. Check logs in MongoDB Atlas console
2. Verify environment variables
3. Test database connectivity
4. Review this deployment guide
5. Check application logs

**Happy Deploying! 🚀**