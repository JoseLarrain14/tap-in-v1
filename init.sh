#!/bin/bash
# Tap In V1 - Development Server Initialization

echo "=== Tap In V1 - Starting Development Servers ==="

# Kill any existing processes on ports 3001 and 5173
echo "[Init] Checking for existing processes..."
lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1

# Start backend
echo "[Init] Starting backend server..."
cd "$(dirname "$0")/backend"
if [ ! -d "node_modules" ]; then
  echo "[Init] Installing backend dependencies..."
  npm install
fi
node src/index.js &
BACKEND_PID=$!
echo "[Init] Backend started (PID: $BACKEND_PID)"

# Wait for backend to be ready
echo "[Init] Waiting for backend to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "[Init] Backend is ready!"
    break
  fi
  sleep 1
done

# Start frontend if it exists
cd "$(dirname "$0")/frontend"
if [ -f "package.json" ]; then
  if [ ! -d "node_modules" ]; then
    echo "[Init] Installing frontend dependencies..."
    npm install
  fi
  echo "[Init] Starting frontend server..."
  npx vite --host &
  FRONTEND_PID=$!
  echo "[Init] Frontend started (PID: $FRONTEND_PID)"
fi

echo "=== Tap In V1 - Servers Running ==="
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:5173"
echo ""

wait
