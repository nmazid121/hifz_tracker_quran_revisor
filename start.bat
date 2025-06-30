@echo off
echo 🚀 Starting Hifz Tracker Quran Revisor...
echo.

echo [1/2] Starting Backend Server (Flask)...
echo ⏳ Backend starting at http://localhost:5000
start "Hifz Tracker Backend" /D "backend" cmd /k "echo 🔧 Backend Server && python app.py"

echo.
echo [2/2] Starting Frontend Server (Vite)...
echo ⏳ Waiting for backend to initialize...
timeout /t 5 /nobreak > nul
echo ⏳ Frontend starting at http://localhost:3000
start "Hifz Tracker Frontend" /D "frontend" cmd /k "echo 📱 Frontend Server && npm run dev"

echo.
echo ✅ Both servers are starting...
echo.
echo 🌐 Access Points:
echo    📱 Frontend: http://localhost:3000
echo    🔧 Backend:  http://localhost:5000
echo    🧪 API Test: http://localhost:5000/api/quran/test
echo.
echo 💡 Troubleshooting:
echo    - If you see connection errors, wait a moment for servers to start
echo    - Backend takes 3-5 seconds to fully initialize
echo    - Frontend auto-retries failed connections
echo.
echo Press any key to close this window (servers will keep running)...
pause > nul 