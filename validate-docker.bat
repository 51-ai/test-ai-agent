@echo off
REM ========================================
REM Docker Configuration Validator
REM ========================================

setlocal enabledelayedexpansion

echo.
echo ========================================
echo Docker Configuration Validator
echo ========================================
echo.

set ERRORS=0
set WARNINGS=0

REM Check if Docker is available
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Docker is not installed
    exit /b 1
)
echo ✅ Docker is available: 
docker --version

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Docker Compose is not available
    exit /b 1
)
echo ✅ Docker Compose is available

echo.
echo ========================================
echo Checking Docker Compose Configuration
echo ========================================
echo.

if not exist "docker-compose.yml" (
    echo ❌ ERROR: docker-compose.yml not found
    set /a ERRORS+=1
    goto :summary
)

echo ✅ docker-compose.yml found

docker-compose -f docker-compose.yml config >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Invalid docker-compose.yml syntax
    docker-compose -f docker-compose.yml config
    set /a ERRORS+=1
) else (
    echo ✅ docker-compose.yml syntax is valid
)

echo.
echo ========================================
echo Checking Required Files
echo ========================================
echo.

set REQUIRED_FILES=backend\Dockerfile;frontend\Dockerfile;frontend\nginx.conf;.env.example

for %%F in (%REQUIRED_FILES%) do (
    if exist "%%F" (
        echo ✅ %%F exists
    ) else (
        echo ❌ %%F missing
        set /a ERRORS+=1
    )
)

echo.
echo ========================================
echo Checking Environment Configuration
echo ========================================
echo.

if exist ".env" (
    echo ✅ .env file exists
    findstr /C:"JWT_SECRET=" .env | findstr /V /C:"your-secret-key" >nul
    if not errorlevel 1 (
        echo ✅ JWT_SECRET is configured
    ) else (
        echo ⚠️  WARNING: JWT_SECRET is not properly configured
        set /a WARNINGS+=1
    )
    
    findstr /C:"OPENAI_API_KEY=" .env | findstr /V /C:"sk-your" >nul
    if not errorlevel 1 (
        echo ✅ OPENAI_API_KEY is configured
    ) else (
        echo ⚠️  WARNING: OPENAI_API_KEY is not configured
        set /a WARNINGS+=1
    )
) else (
    echo ⚠️  WARNING: .env file not found (copy from .env.example)
    set /a WARNINGS+=1
)

echo.
echo ========================================
echo Checking Docker Daemon
echo ========================================
echo.

docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Docker daemon is not running
    echo    Please start Docker Desktop
    set /a ERRORS+=1
) else (
    echo ✅ Docker daemon is running
)

echo.
echo ========================================
echo Checking Port Availability
echo ========================================
echo.

set PORTS=80 3000 27017 6379

for %%P in (%PORTS%) do (
    netstat -ano | findstr ":%%P " >nul 2>&1
    if not errorlevel 1 (
        echo ⚠️  WARNING: Port %%P is in use
        set /a WARNINGS+=1
    ) else (
        echo ✅ Port %%P is available
    )
)

echo.
echo ========================================
echo Validating Dockerfiles
echo ========================================
echo.

if exist "backend\Dockerfile" (
    findstr /C:"FROM node:" backend\Dockerfile >nul 2>&1
    if not errorlevel 1 (
        echo ✅ backend\Dockerfile uses Node.js base image
    ) else (
        echo ❌ backend\Dockerfile missing Node.js base image
        set /a ERRORS+=1
    )
    
    findstr /C:"WORKDIR /app" backend\Dockerfile >nul 2>&1
    if not errorlevel 1 (
        echo ✅ backend\Dockerfile sets WORKDIR
    ) else (
        echo ⚠️  WARNING: backend\Dockerfile should set WORKDIR
        set /a WARNINGS+=1
    )
)

if exist "frontend\Dockerfile" (
    findstr /C:"nginx" frontend\Dockerfile >nul 2>&1
    if not errorlevel 1 (
        echo ✅ frontend\Dockerfile uses Nginx
    ) else (
        echo ⚠️  WARNING: frontend\Dockerfile should use Nginx for production
        set /a WARNINGS+=1
    )
)

:summary
echo.
echo ========================================
echo Summary
echo ========================================
echo.

if !ERRORS! equ 0 (
    if !WARNINGS! equ 0 (
        echo ✅ All checks passed! Docker configuration is ready.
        echo.
        echo Next steps:
        echo   1. copy .env.example .env
        echo   2. Edit .env with your configuration
        echo   3. docker-compose up -d
        echo.
        exit /b 0
    ) else (
        echo ⚠️  !WARNINGS! warning^(s^) found. Review above for details.
        echo    Docker should still work, but some features may be limited.
        echo.
        exit /b 0
    )
) else (
    echo ❌ !ERRORS! error^(s^) and !WARNINGS! warning^(s^) found.
    echo    Please fix the errors before running Docker.
    echo.
    exit /b 1
)

endlocal