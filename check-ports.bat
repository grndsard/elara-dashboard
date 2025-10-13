@echo off
echo Checking port availability...
echo.

echo Port 3000 (Node.js):
netstat -an | findstr :3000 >nul
if %errorlevel%==0 (
    echo   ❌ Port 3000 is in use
) else (
    echo   ✅ Port 3000 is available
)

echo Port 5000 (Python):
netstat -an | findstr :5000 >nul
if %errorlevel%==0 (
    echo   ❌ Port 5000 is in use
) else (
    echo   ✅ Port 5000 is available
)

echo.
pause