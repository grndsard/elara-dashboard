@echo off
echo ========================================
echo    Starting All Elara Services
echo ========================================
echo.

echo Starting Database Service (Port 5001)...
start "DB Service" cmd /k "cd db_service && python app.py"
timeout /t 3 >nul

echo Starting Python Upload Service (Port 5000)...
start "Python Service" cmd /k "cd python_upload_service && python app.py"
timeout /t 3 >nul

echo Starting Main Elara Server (Port 3000)...
start "Elara Server" cmd /k "npm start"

echo.
echo ✅ All services started!
echo.
echo Services running:
echo - Database Service: http://localhost:5001
echo - Python Service: http://localhost:5000  
echo - Elara Dashboard: http://localhost:3000
echo.
echo Press any key to close this window...
pause >nul