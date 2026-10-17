@echo off
cd /d "c:\Users\51\Documents\trae_projects\test--ai agent"
echo ========================================
echo AI Agent Build Script
echo ========================================
echo.

set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

echo [1/4] Checking dependencies...
call npm install
if %errorLevel% neq 0 (
    echo [ERROR] npm install failed
    goto :end
)

echo.
echo [2/4] Building frontend...
call npm run build:frontend
if %errorLevel% neq 0 (
    echo [ERROR] Frontend build failed
    goto :end
)

echo.
echo [3/4] Packaging Electron app...
call npx electron-builder --win --x64 --publish never
if %errorLevel% neq 0 (
    echo [ERROR] Electron build failed
    goto :end
)

echo.
echo [4/4] Checking build result...
if exist "release\win-unpacked\AI Agent.exe" (
    echo Build successful!
    echo Location: release\win-unpacked\AI Agent.exe
) else (
    echo Check release folder for output
)

echo.
echo Done!

:end
pause