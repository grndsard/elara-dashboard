@echo off
echo ========================================
echo ELARA UPLOAD FIX - STARTUP SCRIPT
echo ========================================
echo.

echo 1. Running diagnostics...
node fix-upload-issues.js
echo.

echo 2. Starting Python service...
cd python_upload_service
start "Python Service" cmd /k "python minimal_app.py"
cd ..
echo Python service starting in new window...
echo.

echo 3. Waiting for Python service to start...
timeout /t 5 /nobreak > nul
echo.

echo 4. Testing Python service...
curl -s http://localhost:5000/health
echo.

echo 5. Starting Node.js server...
echo Server will start in 3 seconds...
timeout /t 3 /nobreak > nul
npm start

pause