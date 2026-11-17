@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Install Node.js 22 or newer from nodejs.org first. & pause & exit /b 1)
if not exist node_modules (call npm ci || (pause & exit /b 1))
call npm start
pause
