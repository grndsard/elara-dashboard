@echo off
echo 🔍 Checking Git Repository Sync Status...
echo.

REM Check if we're in a git repository
git status >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Not a git repository. Initialize with: git init
    pause
    exit /b 1
)

echo 📊 Current Git Status:
git status --porcelain

echo.
echo 📁 Files in Local Directory but NOT in Git:
echo ==========================================
git ls-files --others --exclude-standard

echo.
echo 🗑️ Files in Git but NOT in Local Directory:
echo ============================================
git ls-files --deleted

echo.
echo 📝 Modified Files (Local vs Git):
echo =================================
git diff --name-only

echo.
echo 🔄 Staged Files:
echo ===============
git diff --cached --name-only

echo.
echo 📋 Summary:
echo ===========
for /f %%i in ('git ls-files --others --exclude-standard ^| find /c /v ""') do set untracked=%%i
for /f %%i in ('git ls-files --deleted ^| find /c /v ""') do set deleted=%%i
for /f %%i in ('git diff --name-only ^| find /c /v ""') do set modified=%%i

echo - Untracked files (local only): %untracked%
echo - Deleted files (git only): %deleted%
echo - Modified files: %modified%

echo.
echo 💡 Next Steps:
echo - Review untracked files above
echo - Check if deleted files should be removed from git
echo - Use git-cleanup.bat to clean up safely
echo.
pause