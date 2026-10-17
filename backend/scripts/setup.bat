@echo off
REM AI Agent System - Backend Setup Script

echo ========================================
echo AI Agent System - Backend Setup
echo ========================================
echo.

echo [1/4] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    exit /b 1
)

echo.
echo [2/4] Checking TypeScript configuration...
call npx tsc --version

echo.
echo [3/4] Running TypeScript type check...
call npm run typecheck
if %errorlevel% neq 0 (
    echo.
    echo WARNING: TypeScript type check found issues.
    echo This may be due to missing type definitions.
    echo Try running: npm install @types/node @types/uuid
)

echo.
echo [4/4] Setup complete!
echo.
echo ========================================
echo Next steps:
echo ========================================
echo 1. Start MongoDB and Redis:
echo    docker-compose up -d mongodb redis
echo.
echo 2. Configure environment variables:
echo    Copy .env.example to .env and update values
echo.
echo 3. Start development server:
echo    npm run dev
echo ========================================
echo.

pause