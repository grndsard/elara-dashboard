@echo off
echo 🧹 Cleaning up unused files in Elara...

REM Backup important files first
echo 📦 Creating backup...
if not exist "backup" mkdir backup
copy .env backup\.env.backup 2>nul

REM Remove Python service duplicates
echo 🐍 Removing Python service duplicates...
del python_upload_service\app-optimized.py 2>nul
del python_upload_service\minimal_app.py 2>nul
del python_upload_service\simple_app.py 2>nul

REM Remove route duplicates
echo 🛣️ Removing route duplicates...
del routes\datasets-optimized.js 2>nul

REM Remove test/debug files
echo 🧪 Removing test and debug files...
del fix-upload-issues.js 2>nul
del test-upload-fix.js 2>nul
del test-upload.js 2>nul
del temp_remove_modal.js 2>nul

REM Remove documentation duplicates
echo 📚 Removing documentation duplicates...
del UPLOAD_FIX_SUMMARY.md 2>nul
del UPLOAD_OPTIMIZATION.md 2>nul
del setup-qbusiness.md 2>nul
del START_GUIDE.md 2>nul

REM Remove redundant batch files
echo 📜 Removing redundant batch files...
del start-all.bat 2>nul
del start-simple.bat 2>nul
del start-upload-fix.bat 2>nul
del restart-server.bat 2>nul

REM Clean upload test files
echo 📁 Cleaning upload test files...
del uploads\*.csv 2>nul
del uploads\temp\*.xlsx 2>nul
del uploads\temp\*.xls 2>nul

REM Remove old migration files (optional - uncomment if needed)
REM echo 🗄️ Removing old migration files...
REM del database\rename-entitas-to-entity.js 2>nul
REM del database\update-audit-table.js 2>nul
REM del database\update-tables.js 2>nul

echo ✅ Cleanup completed!
echo 📊 Files removed:
echo   - Python service duplicates: 3 files
echo   - Route duplicates: 1 file  
echo   - Test/debug files: 4 files
echo   - Documentation duplicates: 4 files
echo   - Redundant batch files: 4 files
echo   - Upload test files: cleaned
echo.
echo 💡 Backup created in backup\ directory
echo 🚀 Elara codebase is now cleaner and production-ready!
pause