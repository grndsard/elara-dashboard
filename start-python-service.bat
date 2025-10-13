@echo off
REM Python Upload Service Startup Script for Windows

echo Starting Python Upload Service...

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if pip is installed
pip --version >nul 2>&1
if errorlevel 1 (
    echo Error: pip is not installed or not in PATH
    pause
    exit /b 1
)

REM Navigate to the Python service directory
cd /d "%~dp0python_upload_service"

REM Install dependencies
echo Installing Python dependencies...
pip install -r requirements.txt

REM Check if .env file exists in parent directory
if not exist "..\\.env" (
    echo Warning: .env file not found in parent directory
    echo Please copy .env.example to .env and configure it
)

REM Start the Flask service
echo Starting Flask service on port 5000...
python app.py

pause