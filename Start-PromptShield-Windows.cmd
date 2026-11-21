@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>nul
if errorlevel 1 goto missing_node
node.exe -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 goto missing_node

if not exist "node_modules\electron\package.json" goto setup
if not exist "node_modules\esbuild\package.json" goto setup
goto runtime

:setup
echo Setting up PromptShield. The first run needs an internet connection.
call npm.cmd ci --include=dev --cache .npm-cache
if errorlevel 1 goto failed

:runtime
rem Some npm configurations skip dependency install scripts. Prepare Electron explicitly.
if exist "node_modules\electron\dist\electron.exe" goto launch
node.exe "node_modules\electron\install.js"
if errorlevel 1 goto failed
if not exist "node_modules\electron\dist\electron.exe" goto missing_runtime

:launch
echo Opening PromptShield Desktop...
call npm.cmd start
if errorlevel 1 goto failed
exit /b 0

:missing_node
echo Install Node.js 22 or newer with npm from https://nodejs.org.
echo Then close and reopen this terminal and run the launcher again.
goto failed

:missing_runtime
echo The Electron runtime is missing. Check your internet connection and retry.

:failed
echo PromptShield could not start. Review the error above.
echo To repair dependencies, run: npm.cmd ci --include=dev --cache .npm-cache
pause
exit /b 1
