#!/bin/bash

echo "🚀 Starting Hifz Tracker Quran Revisor..."
echo

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Check if backend port is available
if check_port 5000; then
    echo "⚠️  Port 5000 is already in use. Backend may already be running."
else
    echo "[1/2] Starting Backend Server (Flask)..."
    cd backend
    python app.py &
    BACKEND_PID=$!
    cd ..
    echo "✅ Backend started (PID: $BACKEND_PID)"
fi

# Wait a moment for backend to start
sleep 3

# Check if frontend port is available
if check_port 3000; then
    echo "⚠️  Port 3000 is already in use. Frontend may already be running."
else
    echo "[2/2] Starting Frontend Server (Vite)..."
    cd frontend
    npm run dev &
    FRONTEND_PID=$!
    cd ..
    echo "✅ Frontend started (PID: $FRONTEND_PID)"
fi

echo
echo "🎉 Services are starting..."
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend:  http://localhost:5000/api/quran/test"
echo
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap 'echo "Stopping servers..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit' INT
wait 