@echo off
echo Stopping existing Elara processes...

REM Kill processes using port 3000 (Node.js)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    echo Killing process %%a on port 3000
    taskkill /f /pid %%a >nul 2>&1
)

REM Kill processes using port 5000 (Python)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do (
    echo Killing process %%a on port 5000
    taskkill /f /pid %%a >nul 2>&1
)

REM Kill any remaining node.exe processes
taskkill /f /im node.exe >nul 2>&1

REM Kill any remaining python.exe processes running app.py
wmic process where "name='python.exe' and commandline like '%%app.py%%'" delete >nul 2>&1

echo All processes stopped.
timeout /t 2 /nobreak >nul