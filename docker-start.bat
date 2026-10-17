@echo off
REM ========================================
REM AI Agent System - Docker Startup Script
REM ========================================

setlocal enabledelayedexpansion

echo.
echo ========================================
echo AI Agent System - Docker Environment
echo ========================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed or not running
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    exit /b 1
)

REM Check if Docker Compose is available
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker Compose is not available
    exit /b 1
)

echo Docker is ready!
echo.

REM Parse command argument
set "COMMAND=%1"

if "%COMMAND%"=="" set "COMMAND=start"
if "%COMMAND%"=="start" goto :start
if "%COMMAND%"=="stop" goto :stop
if "%COMMAND%"=="restart" goto :restart
if "%COMMAND%"=="build" goto :build
if "%COMMAND%"=="logs" goto :logs
if "%COMMAND%"=="status" goto :status
if "%COMMAND%"=="clean" goto :clean
if "%COMMAND%"=="dev" goto :dev
if "%COMMAND%"=="prod" goto :prod
goto :help

:start
echo [ACTION] Starting all services...
if exist .env (
    docker-compose up -d
) else (
    echo WARNING: .env file not found, using defaults
    echo Copy .env.example to .env and configure your settings
    docker-compose up -d
)
echo.
echo Services started!
echo Frontend: http://localhost
echo Backend API: http://localhost:3000
echo MongoDB: localhost:27017
echo Redis: localhost:6379
goto :end

:stop
echo [ACTION] Stopping all services...
docker-compose down
echo Services stopped.
goto :end

:restart
echo [ACTION] Restarting all services...
docker-compose down
docker-compose up -d
echo Services restarted.
goto :end

:build
echo [ACTION] Building all images...
docker-compose build --no-cache
echo Images built.
goto :end

:logs
echo [ACTION] Showing logs...
docker-compose logs -f
goto :end

:status
echo [ACTION] Checking service status...
docker-compose ps
echo.
docker stats --no-stream ai-agent-mongodb ai-agent-redis ai-agent-backend ai-agent-frontend 2>nul
goto :end

:clean
echo [ACTION] Cleaning up...
echo WARNING: This will remove all containers, volumes, and images!
set /p CONFIRM="Are you sure? (y/N): "
if /i "!CONFIRM!"=="y" (
    docker-compose down -v --rmi all
    echo Cleanup complete.
) else (
    echo Cleanup cancelled.
)
goto :end

:dev
echo [ACTION] Starting development environment...
if exist .env.development (
    docker-compose -f docker-compose.dev.yml up -d
) else (
    echo WARNING: .env.development not found
    docker-compose -f docker-compose.dev.yml up -d
)
echo.
echo Development environment started!
echo Frontend: http://localhost:5173
echo Backend API: http://localhost:3000
goto :end

:prod
echo [ACTION] Starting production environment...
if not exist .env (
    echo ERROR: .env file required for production
    echo Copy .env.example to .env and configure your settings
    exit /b 1
)
docker-compose up -d --build
echo.
echo Production environment started!
echo Frontend: http://localhost
echo Backend API: http://localhost:3000
goto :end

:help
echo.
echo Usage: docker-start.bat [command]
echo.
echo Commands:
echo   start     - Start all services (default)
echo   stop      - Stop all services
echo   restart   - Restart all services
echo   build     - Build all images (no cache)
echo   logs      - Show live logs
echo   status    - Show service status and stats
echo   clean     - Remove all containers, volumes, and images
echo   dev       - Start development environment
echo   prod      - Start production environment
echo.
echo Examples:
echo   docker-start.bat          - Start all services
echo   docker-start.bat dev      - Start development mode
echo   docker-start.bat logs     - View logs
echo   docker-start.bat stop     - Stop services
echo.

:end
endlocal
echo.
echo ========================================
echo Done!
echo ========================================