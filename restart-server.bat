@echo off
echo Restarting Elara Server...

REM Kill existing Node.js processes
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im python.exe >nul 2>&1

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Start the server
echo Starting Node.js server...
start "Elara Server" cmd /k "node server.js"

echo Server restarted! Check http://localhost:3000