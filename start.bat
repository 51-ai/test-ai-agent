@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================
echo         AI Agent - Startup Script
echo ============================================
echo.

set "PROJECT_DIR=%~dp0"

echo [1/7] Checking Node.js version...
node --version
if errorlevel 1 (
    echo ERROR: Node.js failed to start
    echo Please check that Node.js is installed and in PATH
    pause
    exit /b 1
)

echo.
echo [2/7] Checking dependencies...

set "NEED_INSTALL=0"

if not exist "%PROJECT_DIR%node_modules" (
    echo   [MISSING] Root node_modules
    set "NEED_INSTALL=1"
) else (
    echo   [OK] Root node_modules
)

if not exist "%PROJECT_DIR%backend\node_modules" (
    echo   [MISSING] backend\node_modules
    set "NEED_INSTALL=1"
) else (
    echo   [OK] backend\node_modules
)

if not exist "%PROJECT_DIR%frontend\node_modules" (
    echo   [MISSING] frontend\node_modules
    set "NEED_INSTALL=1"
) else (
    echo   [OK] frontend\node_modules
)

if !NEED_INSTALL! equ 1 (
    echo.
    echo   Installing missing dependencies, please wait...
    echo   This may take a few minutes on first run.
    echo.

    if not exist "%PROJECT_DIR%node_modules" (
        echo   [1/3] Installing root dependencies...
        cd /d "%PROJECT_DIR%"
        call npm install
        if errorlevel 1 (
            echo   [WARN] Root install had issues, continuing...
        )
    )

    if not exist "%PROJECT_DIR%backend\node_modules" (
        echo.
        echo   [2/3] Installing backend dependencies...
        cd /d "%PROJECT_DIR%backend"
        call npm install
        if errorlevel 1 (
            echo   [WARN] Backend install had issues, continuing...
        )
    )

    if not exist "%PROJECT_DIR%frontend\node_modules" (
        echo.
        echo   [3/3] Installing frontend dependencies...
        cd /d "%PROJECT_DIR%frontend"
        call npm install
        if errorlevel 1 (
            echo   [WARN] Frontend install had issues, continuing...
        )
    )

    cd /d "%PROJECT_DIR%"
    echo.
    echo   [OK] Dependency installation complete.
) else (
    echo   All dependencies are already installed.
)

echo.
echo [3/7] Checking Ollama (local NPU AI)...
where ollama >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Ollama found
) else (
    echo [WARN] Ollama not in PATH - install it or start the service manually
)

echo [Checking] Ollama service status...
curl.exe -s -o nul -w "%%{http_code}" http://localhost:11434/api/tags > "%TEMP%\ollama_check" 2>&1
findstr /c:"200" "%TEMP%\ollama_check" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Ollama service is running
) else (
    echo [Starting] Launching Ollama service...
    start "Ollama" cmd /c "ollama serve"
    ping -n 4 127.0.0.1 >nul 2>&1
    echo [OK] Ollama service started
)

echo.
echo [4/7] Starting backend service...
start "Backend" cmd /c "cd /d %PROJECT_DIR%backend && npm run dev"

echo Waiting for backend...
ping -n 9 127.0.0.1 >nul 2>&1

echo.
echo [5/7] Starting frontend service...
start "Frontend" cmd /c "cd /d %PROJECT_DIR%frontend && npm run dev"

echo Waiting for frontend...
ping -n 6 127.0.0.1 >nul 2>&1

echo.
echo [6/7] Verifying services...
curl.exe -s -o nul -w "%%{http_code}" http://localhost:3000/api/health > "%TEMP%\svc_check" 2>&1
findstr /c:"200" "%TEMP%\svc_check" >nul 2>&1
if !errorlevel! equ 0 (
    echo   [OK] Backend is responding
) else (
    echo   [WARN] Backend may still be starting up
)

curl.exe -s -o nul -w "%%{http_code}" http://localhost:5173 > "%TEMP%\svc_check" 2>&1
findstr /c:"200" "%TEMP%\svc_check" >nul 2>&1
if !errorlevel! equ 0 (
    echo   [OK] Frontend is responding
) else (
    echo   [WARN] Frontend may still be starting up
)

echo.
echo [7/7] Opening browser...
start http://localhost:5173

echo.
echo ============================================
echo         Services started successfully!
echo ============================================
echo.
echo Frontend:  http://localhost:5173
echo Backend:   http://localhost:3000
echo Ollama:    http://localhost:11434
echo.
echo Press any key to exit...
pause >nul

endlocal