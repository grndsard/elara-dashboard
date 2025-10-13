@echo off
REM Elara Application Startup Script

echo ========================================
echo    Elara Finance Dashboard Startup
echo ========================================
echo.

REM Stop any existing processes
echo Stopping existing processes...
call kill-processes.bat
echo.

REM Check Node.js
echo Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo Node.js: OK

REM Check Python
echo Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python from https://python.org/
    pause
    exit /b 1
)
echo Python: OK

REM Install Node.js dependencies
echo.
echo Installing Node.js dependencies...
call npm install
if errorlevel 1 (
    echo Error: Failed to install Node.js dependencies
    pause
    exit /b 1
)

REM Install Python dependencies
echo.
echo Installing Python dependencies...
cd python_upload_service
call pip install --user -r requirements.txt
if errorlevel 1 (
    echo Error: Failed to install Python dependencies
    echo Try running as Administrator or manually install with:
    echo pip install --user -r requirements.txt
    pause
    exit /b 1
)
cd ..

REM Check environment file
if not exist ".env" (
    echo.
    echo Warning: .env file not found
    echo Copying .env.example to .env...
    copy .env.example .env
    echo.
    echo Please edit .env file with your configuration before starting the services
    echo Press any key to continue...
    pause >nul
)

REM Start services
echo.
echo ========================================
echo    Starting Services
echo ========================================
echo.

REM Start Python service in background
echo Starting Python Upload Service...
start "Python Service" cmd /c "cd python_upload_service && python app.py"

REM Wait a moment for Python service to start
timeout /t 3 /nobreak >nul

REM Start Node.js application
echo Starting Node.js Application...
echo.
echo Application will be available at: http://localhost:3000
echo Python Service will be available at: http://localhost:5000
echo.
echo Press Ctrl+C to stop the application
echo.

npm start