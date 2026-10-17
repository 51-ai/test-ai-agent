#!/bin/bash

# ========================================
# AI Agent System - Docker Startup Script
# ========================================

set -e

echo ""
echo "========================================"
echo "AI Agent System - Docker Environment"
echo "========================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed"
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "ERROR: Docker Compose is not available"
    exit 1
fi

echo "Docker is ready!"
echo ""

# Use docker compose or docker-compose
COMPOSE_CMD="docker-compose"
if ! command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker compose"
fi

COMMAND=${1:-start}

case $COMMAND in
    start)
        echo "[ACTION] Starting all services..."
        if [ -f .env ]; then
            $COMPOSE_CMD up -d
        else
            echo "WARNING: .env file not found, using defaults"
            echo "Copy .env.example to .env and configure your settings"
            $COMPOSE_CMD up -d
        fi
        echo ""
        echo "Services started!"
        echo "Frontend: http://localhost"
        echo "Backend API: http://localhost:3000"
        echo "MongoDB: localhost:27017"
        echo "Redis: localhost:6379"
        ;;
    
    stop)
        echo "[ACTION] Stopping all services..."
        $COMPOSE_CMD down
        echo "Services stopped."
        ;;
    
    restart)
        echo "[ACTION] Restarting all services..."
        $COMPOSE_CMD down
        $COMPOSE_CMD up -d
        echo "Services restarted."
        ;;
    
    build)
        echo "[ACTION] Building all images..."
        $COMPOSE_CMD build --no-cache
        echo "Images built."
        ;;
    
    logs)
        echo "[ACTION] Showing logs..."
        $COMPOSE_CMD logs -f
        ;;
    
    status)
        echo "[ACTION] Checking service status..."
        $COMPOSE_CMD ps
        echo ""
        docker stats --no-stream 2>/dev/null || true
        ;;
    
    clean)
        echo "[ACTION] Cleaning up..."
        echo "WARNING: This will remove all containers, volumes, and images!"
        read -p "Are you sure? (y/N): " confirm
        if [[ $confirm == "y" || $confirm == "Y" ]]; then
            $COMPOSE_CMD down -v --rmi all
            echo "Cleanup complete."
        else
            echo "Cleanup cancelled."
        fi
        ;;
    
    dev)
        echo "[ACTION] Starting development environment..."
        $COMPOSE_CMD -f docker-compose.dev.yml up -d
        echo ""
        echo "Development environment started!"
        echo "Frontend: http://localhost:5173"
        echo "Backend API: http://localhost:3000"
        ;;
    
    prod)
        echo "[ACTION] Starting production environment..."
        if [ ! -f .env ]; then
            echo "ERROR: .env file required for production"
            echo "Copy .env.example to .env and configure your settings"
            exit 1
        fi
        $COMPOSE_CMD up -d --build
        echo ""
        echo "Production environment started!"
        echo "Frontend: http://localhost"
        echo "Backend API: http://localhost:3000"
        ;;
    
    *)
        echo ""
        echo "Usage: ./docker-start.sh [command]"
        echo ""
        echo "Commands:"
        echo "  start     - Start all services (default)"
        echo "  stop      - Stop all services"
        echo "  restart   - Restart all services"
        echo "  build     - Build all images (no cache)"
        echo "  logs      - Show live logs"
        echo "  status    - Show service status and stats"
        echo "  clean     - Remove all containers, volumes, and images"
        echo "  dev       - Start development environment"
        echo "  prod      - Start production environment"
        echo ""
        ;;
esac

echo ""
echo "========================================"
echo "Done!"
echo "========================================"