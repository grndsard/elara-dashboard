@echo off
echo Restarting Elara Application...

REM Kill existing processes
call kill-processes.bat

REM Start the application
call start-all.bat