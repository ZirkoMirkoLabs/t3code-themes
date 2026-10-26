@echo off
setlocal
title T3 Skins
set "HERE=%~dp0"
if exist "%HERE%launcher\node_modules\electron\dist\electron.exe" if exist "%HERE%launcher\node_modules\ffmpeg-static\package.json" goto launch

echo.
echo   T3 Skins - first-time setup
echo   ---------------------------
echo   Downloading the skin window (Electron) and the video tool (ffmpeg).
echo   This happens once and takes 1-3 minutes, about 200 MB.
echo.
where npm >nul 2>nul
if errorlevel 1 (
  echo   Node.js is needed for this one-time setup but was not found.
  echo   Install the LTS version from https://nodejs.org , then double-click START.cmd again.
  start "" https://nodejs.org/en/download
  echo.
  pause
  exit /b 1
)
pushd "%HERE%launcher"
call npm install --no-audit --no-fund --loglevel=error
set "NPMERR=%errorlevel%"
if not exist "node_modules\electron\dist\electron.exe" if exist "node_modules\electron\install.js" call node node_modules\electron\install.js
popd
if not exist "%HERE%launcher\node_modules\electron\dist\electron.exe" (
  echo.
  echo   Setup did not finish ^(npm exit code %NPMERR%^). Check your internet connection and run START.cmd again.
  pause
  exit /b 1
)
echo.
echo   Setup complete. Starting T3 Skins...
echo.

:launch
call "%HERE%launcher\Launch-Space-Terminal.cmd"
