@echo off
title 3D Room Viewer
color 0B
echo Starting 3D Room Viewer...
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is required. Install from https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies for first run...
    call npm install
)

echo Launching application...
call npx electron .
