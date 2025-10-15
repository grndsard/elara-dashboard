@echo off
echo 🧹 Git Repository Cleanup Tool
echo ==============================
echo.

REM Check if we're in a git repository
git status >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Not a git repository
    pause
    exit /b 1
)

echo 🔍 Analyzing repository...
echo.

REM Create temporary files for analysis
git ls-files > git-files.tmp
dir /b /s /a-d | findstr /v ".git" | findstr /v "node_modules" | findstr /v "logs" | findstr /v "uploads" > local-files.tmp

echo 📁 Files in Git but missing locally:
echo ====================================
for /f "delims=" %%f in (git-files.tmp) do (
    if not exist "%%f" (
        echo   ❌ %%f
    )
)

echo.
echo 📄 Large/Generated files that should be in .gitignore:
echo =====================================================
for /f "delims=" %%f in ('git ls-files --others --exclude-standard') do (
    for %%a in ("%%f") do (
        if %%~za gtr 1048576 (
            echo   📦 %%f ^(%%~za bytes^)
        )
    )
)

echo.
echo 🗂️ Checking .gitignore coverage:
echo ================================
if not exist .gitignore (
    echo   ⚠️ No .gitignore file found
) else (
    echo   ✅ .gitignore exists
    findstr /c:"node_modules" .gitignore >nul || echo   ⚠️ Missing: node_modules
    findstr /c:"logs" .gitignore >nul || echo   ⚠️ Missing: logs/
    findstr /c:"uploads" .gitignore >nul || echo   ⚠️ Missing: uploads/
    findstr /c:".env" .gitignore >nul || echo   ⚠️ Missing: .env
)

echo.
echo 🔧 Recommended Actions:
echo ======================
echo 1. Add missing entries to .gitignore
echo 2. Remove deleted files from git: git rm [filename]
echo 3. Add new files to git: git add [filename]
echo 4. Commit changes: git commit -m "Sync repository"

REM Cleanup temp files
del git-files.tmp local-files.tmp 2>nul

echo.
echo 💡 Run 'git status' to see current state
echo 💡 Run 'git add .' to stage all new files
echo 💡 Run 'git commit -m "Update files"' to commit
echo.
pause