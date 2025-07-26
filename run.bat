@echo off
echo =========================================
echo      LoadBalancerSim - Start Script
echo =========================================
echo.

REM Kill any existing Node processes
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr "3000\b.*LISTENING"') DO (
    echo Killing process on port 3000 (PID: %%P)
    taskkill /F /PID %%P 2>nul
)
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr "3001\b.*LISTENING"') DO (
    echo Killing process on port 3001 (PID: %%P)
    taskkill /F /PID %%P 2>nul
)

echo.
echo =========================================
echo     Starting Backend (Port 3001)
echo =========================================
start "Backend" cmd /k "cd backend && npm run dev"
timeout /t 5 /nobreak >nul

echo.
echo =========================================
echo     Starting Frontend (Port 3000)
echo =========================================
start "Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 5 /nobreak >nul

echo.
echo =========================================
echo      LoadBalancerSim is Running!
echo =========================================
echo.
echo Dashboard: http://localhost:3000
echo Backend API: http://localhost:3001/api/status
echo WebSocket: ws://localhost:3001
echo.
echo Press any key to exit (this will close the terminals)
pause >nul
taskkill /FI "WINDOWTITLE eq Backend*" /T
taskkill /FI "WINDOWTITLE eq Frontend*" /T