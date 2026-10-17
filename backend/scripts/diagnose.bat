@echo off
REM TypeScript Diagnostics Script for AI Agent System

echo ========================================
echo TypeScript Diagnostics
echo ========================================
echo.

echo [1/6] Checking Node.js installation...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed
    exit /b 1
)
echo.

echo [2/6] Checking npm installation...
npm --version
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed
    exit /b 1
)
echo.

echo [3/6] Checking node_modules...
if not exist "node_modules" (
    echo WARNING: node_modules not found
    echo Running npm install...
    call npm install
)
echo.

echo [4/6] Checking type definitions...
echo Checking @types/node...
if exist "node_modules\@types\node" (
    echo   OK: @types/node installed
) else (
    echo   ERROR: @types/node not found
    echo   Run: npm install @types/node --save-dev
)

echo Checking @types/uuid...
if exist "node_modules\@types\uuid" (
    echo   OK: @types/uuid installed
) else (
    echo   ERROR: @types/uuid not found
    echo   Run: npm install @types/uuid --save-dev
)
echo.

echo [5/6] Checking TypeScript version...
npx tsc --version
echo.

echo [6/6] Running TypeScript compilation check...
call npx tsc --noEmit 2>&1
if %errorlevel% equ 0 (
    echo.
    echo SUCCESS: No TypeScript errors found!
) else (
    echo.
    echo WARNING: TypeScript compilation found errors.
    echo Common solutions:
    echo   - Run: npm install
    echo   - Run: npm install @types/node @types/uuid
    echo   - Check tsconfig.json configuration
)
echo.

echo ========================================
echo Quick Fix Commands:
echo ========================================
echo.
echo If you see "找不到名称 console":
echo   npm install @types/node --save-dev
echo.
echo If you see "找不到模块 uuid":
echo   npm install @types/uuid --save-dev
echo.
echo To fix all issues at once:
echo   npm install
echo   npm install @types/node @types/uuid @types/express --save-dev
echo ========================================
echo.

pause