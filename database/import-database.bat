@echo off
echo ========================================
echo  Elara Database Import Script
echo ========================================
echo.

REM Load environment variables
for /f "delims=" %%x in (.env) do (set "%%x")

echo Importing Elara database...
echo Database: %DB_NAME%
echo Host: %DB_HOST%
echo Port: %DB_PORT%
echo User: %DB_USER%
echo.

REM Import database
mysql -h %DB_HOST% -P %DB_PORT% -u %DB_USER% -p%DB_PASSWORD% < database\elara_db_import.sql

if %errorlevel% equ 0 (
    echo.
    echo ✅ Database imported successfully!
    echo.
    echo Default login credentials:
    echo Email: admin@elara.com
    echo Password: Admin123!
    echo.
    echo User account:
    echo Email: user@elara.com  
    echo Password: User123!
    echo.
) else (
    echo.
    echo ❌ Database import failed!
    echo Please check your MySQL connection and credentials.
    echo.
)

pause