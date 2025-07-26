#!/bin/bash

echo "========================================"
echo "     LoadBalancerSim - Start Script"
echo "========================================"
echo ""

# Kill existing processes
echo "Cleaning up existing processes..."
pkill -f "node.*backend" 2>/dev/null
pkill -f "node.*frontend" 2>/dev/null
sleep 2

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

cd backend
if [ ! -d "node_modules" ]; then
    npm install
fi

cd ../frontend
if [ ! -d "node_modules" ]; then
    npm install
fi

cd ..

echo ""
echo -e "${GREEN}========================================"
echo "     Starting Backend (Port 3001)"
echo -e "========================================${NC}"
echo ""

# Start backend in background
cd backend
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
echo "Waiting for backend to initialize..."
sleep 5

# Check if backend is running
if curl -s http://localhost:3001/api/status > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend started successfully!${NC}"
else
    echo -e "${RED}✗ Backend failed to start${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================"
echo "     Starting Frontend (Port 3000)"
echo -e "========================================${NC}"
echo ""

# Start frontend in background
cd ../frontend
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 5

# Check if frontend is running
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend started successfully!${NC}"
else
    echo -e "${RED}✗ Frontend failed to start${NC}"
    exit 1
fi

cd ..

echo ""
echo -e "${GREEN}========================================"
echo "     LoadBalancerSim is Running!"
echo -e "========================================${NC}"
echo ""
echo -e "Dashboard: ${BLUE}http://localhost:3000${NC}"
echo -e "Backend:   ${BLUE}http://localhost:3001${NC}"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap "echo ''
echo 'Shutting down LoadBalancerSim...'
kill $BACKEND_PID 2>/dev/null
kill $FRONTEND_PID 2>/dev/null
exit 0" INT

wait