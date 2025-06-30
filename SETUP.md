# 🕌 Hifz Tracker Quran Revisor - Setup Guide

A comprehensive web application for tracking Quran recitation (Hifz) progress.

## 🚀 Quick Start

### Windows Users:
```bash
# Double-click start.bat or run:
start.bat
```

### Linux/Mac/Git Bash Users:
```bash
chmod +x start.sh
./start.sh
```

## 🌐 URLs After Starting
- **Frontend**: http://localhost:3000  
- **Backend API**: http://localhost:5000
- **Test Endpoint**: http://localhost:5000/api/quran/test

## 🔧 Manual Setup

### Backend (Flask):
```bash
cd backend
pip install flask flask-cors
python app.py
```

### Frontend (Vite):
```bash  
cd frontend
npm install
npm run dev
```

## 🛠️ Connection Issues - SOLVED! ✅

**Issue**: Intermittent proxy connection failures (ECONNREFUSED errors)
**Solution**: Multi-layered resilience system:

### 🔧 Enhanced Proxy Configuration
- Better error handling and timeout settings
- Debug logging for troubleshooting  
- Network interface compatibility

### 🔄 Auto-Retry System
- **3 automatic retries** with exponential backoff
- **Smart error detection** (ECONNREFUSED, fetch failures)
- **Graceful degradation** to offline mode if needed

### 📊 Real-time Status Monitoring
- **Connection indicator** (top-right corner)
- **Auto-recovery** notification
- **Background health checks** every 30 seconds

### 🚀 Improved Startup
- **5-second delay** for backend initialization
- **Better error messages** and troubleshooting tips
- **Separate windows** for backend and frontend logs

## 🎯 Features
- Interactive Mushaf pages with mistake tracking
- Recitation rating system
- Progress dashboard with statistics
- Offline support with sync
- Data export and backup

## ⌨️ Keyboard Shortcuts
- **R**: Toggle reveal/hide text
- **M**: Reset mistakes

## 📊 Tracking System
Track your Hifz progress at each page:
1. Hide text and recite from memory
2. Reveal to check accuracy
3. Mark mistakes by clicking words
4. Rate performance (Perfect/Good/Okay/Bad/Rememorize)
5. Submit for progress tracking

## 🚨 Connection Issues? No Problem!

### What You'll See:
- **🔴 Connection Lost** - Backend is restarting (common during development)
- **🟡 Server Error** - Backend responded with an error
- **⚪ Checking...** - System is testing the connection
- **🟢 Connected** - Everything working normally (indicator disappears)

### What Happens Automatically:
- **Auto-retry** up to 3 times with smart delays
- **Loading states** show "retrying..." messages  
- **Offline queuing** for recitation submissions
- **Background recovery** without user action

### If Problems Persist:
1. Check that both servers are running
2. Visit http://localhost:5000/api/quran/test directly
3. Restart using `start.bat` or `start.sh`
4. Wait 10-15 seconds for full initialization

---
*May Allah accept our efforts in learning the Quran. Ameen.* 