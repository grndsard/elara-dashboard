@echo off
echo 🔄 Elara Git Synchronization Tool
echo =================================
echo.

echo 📊 Current Git Status Analysis:
echo.

echo ✅ MODIFIED FILES (will be updated):
echo   - .env.example (updated with new variables)
echo   - README.md (updated with enterprise features)
echo   - config/database.js (added connection retry)
echo   - server.js (added enterprise middleware)
echo   - utils/logger.js (added correlation IDs)
echo.

echo ❌ DELETED FILES (cleaned up unused files):
echo   - START_GUIDE.md (replaced by README.md)
echo   - UPLOAD_FIX_SUMMARY.md (obsolete)
echo   - UPLOAD_OPTIMIZATION.md (moved to docs/)
echo   - fix-upload-issues.js (debug script, no longer needed)
echo   - python_upload_service/app-optimized.py (duplicate)
echo   - python_upload_service/minimal_app.py (duplicate)
echo   - python_upload_service/simple_app.py (duplicate)
echo   - restart-server.bat (use restart.bat instead)
echo   - routes/datasets-optimized.js (duplicate)
echo   - setup-qbusiness.md (moved to docs/)
echo   - start-all.bat (use start-all-optimized.bat)
echo   - start-simple.bat (obsolete)
echo   - start-upload-fix.bat (debug script)
echo   - temp_remove_modal.js (temporary file)
echo   - test-upload-fix.js (debug script)
echo   - test-upload.js (debug script)
echo.

echo ➕ NEW FILES (enterprise improvements):
echo   - ENTERPRISE_IMPROVEMENTS.md (improvement summary)
echo   - docs/ (comprehensive documentation)
echo   - middleware/error-handler.js (enhanced error handling)
echo   - middleware/input-sanitizer.js (XSS protection)
echo   - middleware/performance-monitor.js (monitoring)
echo   - routes/health.js (health check endpoint)
echo   - utils/env-validator.js (environment validation)
echo   - Various .bat scripts for git management
echo.

echo 🤔 What would you like to do?
echo.
echo 1. Stage all changes and new files (recommended)
echo 2. Remove deleted files from git only
echo 3. Add new files only
echo 4. Show detailed diff
echo 5. Cancel
echo.
set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" goto stage_all
if "%choice%"=="2" goto remove_deleted
if "%choice%"=="3" goto add_new
if "%choice%"=="4" goto show_diff
if "%choice%"=="5" goto cancel

:stage_all
echo.
echo 🚀 Staging all changes...
git add .
git status
echo.
echo ✅ All changes staged. Ready to commit with:
echo    git commit -m "Enterprise improvements and cleanup"
goto end

:remove_deleted
echo.
echo 🗑️ Removing deleted files from git...
git rm START_GUIDE.md UPLOAD_FIX_SUMMARY.md UPLOAD_OPTIMIZATION.md
git rm fix-upload-issues.js
git rm python_upload_service/app-optimized.py python_upload_service/minimal_app.py python_upload_service/simple_app.py
git rm restart-server.bat routes/datasets-optimized.js setup-qbusiness.md
git rm start-all.bat start-simple.bat start-upload-fix.bat
git rm temp_remove_modal.js test-upload-fix.js test-upload.js
echo ✅ Deleted files removed from git
goto end

:add_new
echo.
echo ➕ Adding new files...
git add ENTERPRISE_IMPROVEMENTS.md docs/ middleware/ routes/health.js utils/env-validator.js
echo ✅ New files added to git
goto end

:show_diff
echo.
echo 📋 Detailed changes:
git diff --stat
echo.
echo Press any key to continue...
pause >nul
goto end

:cancel
echo.
echo ❌ Operation cancelled
goto end

:end
echo.
echo 💡 Next steps:
echo   - Review staged changes: git status
echo   - Commit changes: git commit -m "Enterprise improvements and cleanup"
echo   - Push to remote: git push origin main
echo.
pause