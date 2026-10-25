@echo off
title Room Viewer 1.0 build 1101 OB - Builder
color 0A

echo ============================================
echo   Room Viewer - Build System
echo   Windows x64 Installer Generator
echo ============================================
echo.

:: Check Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found!
    echo Please install Node.js from https://nodejs.org
    echo Minimum required version: 18.x
    pause
    exit /b 1
)

echo [OK] Node.js found: 
node --version
echo.

:: Install dependencies
echo [1/3] Installing dependencies...
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies installed
echo.

:: Build
echo [2/3] Building Windows installer...
call npx electron-builder --win --x64
if errorlevel 1 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)
echo [OK] Build complete
echo.

:: Done
echo [3/3] Done!
echo.
echo ============================================
echo   Installer created in: dist\
echo   Look for "3D Room Viewer Setup*.exe"
echo ============================================
echo.
pause
