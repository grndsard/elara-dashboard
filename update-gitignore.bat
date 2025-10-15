@echo off
echo 🔧 Updating .gitignore for Elara project...

REM Create comprehensive .gitignore if it doesn't exist
if not exist .gitignore (
    echo Creating new .gitignore file...
    echo. > .gitignore
)

REM Add essential entries to .gitignore
echo # Dependencies >> .gitignore
echo node_modules/ >> .gitignore
echo __pycache__/ >> .gitignore
echo *.pyc >> .gitignore
echo. >> .gitignore

echo # Environment files >> .gitignore
echo .env >> .gitignore
echo .env.local >> .gitignore
echo .env.production >> .gitignore
echo. >> .gitignore

echo # Logs >> .gitignore
echo logs/ >> .gitignore
echo *.log >> .gitignore
echo npm-debug.log* >> .gitignore
echo. >> .gitignore

echo # Runtime and uploads >> .gitignore
echo uploads/*.csv >> .gitignore
echo uploads/*.xlsx >> .gitignore
echo uploads/*.xls >> .gitignore
echo uploads/temp/ >> .gitignore
echo uploads/chunks/ >> .gitignore
echo. >> .gitignore

echo # IDE and OS files >> .gitignore
echo .vscode/ >> .gitignore
echo .DS_Store >> .gitignore
echo Thumbs.db >> .gitignore
echo desktop.ini >> .gitignore
echo. >> .gitignore

echo # Build and dist >> .gitignore
echo dist/ >> .gitignore
echo build/ >> .gitignore
echo coverage/ >> .gitignore
echo. >> .gitignore

echo # Temporary files >> .gitignore
echo *.tmp >> .gitignore
echo *.temp >> .gitignore
echo backup/ >> .gitignore

echo ✅ .gitignore updated successfully!
echo.
echo 📋 Current .gitignore contents:
type .gitignore
echo.
pause