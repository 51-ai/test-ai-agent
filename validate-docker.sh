#!/bin/bash

# ========================================
# Docker Configuration Validator
# ========================================

set -e

echo ""
echo "========================================"
echo "Docker Configuration Validator"
echo "========================================"
echo ""

ERRORS=0
WARNINGS=0

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ ERROR: Docker is not installed"
    exit 1
fi

echo "✅ Docker is available: $(docker --version)"

# Check if docker-compose is available
COMPOSE_CMD="docker-compose"
if ! command -v docker-compose &> /dev/null; then
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
        echo "✅ Docker Compose is available (plugin)"
    else
        echo "❌ ERROR: Docker Compose is not available"
        exit 1
    fi
else
    echo "✅ Docker Compose is available"
fi

# Navigate to project root
cd "$(dirname "$0")"

echo ""
echo "========================================"
echo "Checking Docker Compose Configuration"
echo "========================================"
echo ""

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ ERROR: docker-compose.yml not found"
    exit 1
fi
echo "✅ docker-compose.yml found"

# Validate docker-compose syntax
if ! $COMPOSE_CMD -f docker-compose.yml config > /dev/null 2>&1; then
    echo "❌ ERROR: Invalid docker-compose.yml syntax"
    $COMPOSE_CMD -f docker-compose.yml config
    ERRORS=$((ERRORS + 1))
else
    echo "✅ docker-compose.yml syntax is valid"
fi

# Check required files
echo ""
echo "========================================"
echo "Checking Required Files"
echo "========================================"
echo ""

REQUIRED_FILES=(
    "backend/Dockerfile"
    "frontend/Dockerfile"
    "frontend/nginx.conf"
    ".env.example"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check environment variables
echo ""
echo "========================================"
echo "Checking Environment Configuration"
echo "========================================"
echo ""

if [ -f ".env" ]; then
    echo "✅ .env file exists"

    # Check critical variables
    if grep -q "JWT_SECRET=" .env && ! grep -q "JWT_SECRET=your-secret-key" .env; then
        echo "✅ JWT_SECRET is configured"
    else
        echo "⚠️  WARNING: JWT_SECRET is not properly configured"
        WARNINGS=$((WARNINGS + 1))
    fi

    if grep -q "OPENAI_API_KEY=" .env && ! grep -q "OPENAI_API_KEY=sk-your" .env; then
        echo "✅ OPENAI_API_KEY is configured"
    else
        echo "⚠️  WARNING: OPENAI_API_KEY is not configured"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "⚠️  WARNING: .env file not found (copy from .env.example)"
    WARNINGS=$((WARNINGS + 1))
fi

# Check Docker daemon
echo ""
echo "========================================"
echo "Checking Docker Daemon"
echo "========================================"
echo ""

if docker info > /dev/null 2>&1; then
    echo "✅ Docker daemon is running"

    # Check available resources
    echo ""
    echo "Available Resources:"
    docker info | grep -E "Memory|CPU|Cores" || true
else
    echo "❌ ERROR: Docker daemon is not running"
    echo "   Please start Docker Desktop or Docker daemon"
    ERRORS=$((ERRORS + 1))
fi

# Check port availability
echo ""
echo "========================================"
echo "Checking Port Availability"
echo "========================================"
echo ""

PORTS=(80 3000 27017 6379)

for PORT in "${PORTS[@]}"; do
    if netstat -an 2>/dev/null | grep -q ":$PORT " || ss -an 2>/dev/null | grep -q ":$PORT "; then
        echo "⚠️  WARNING: Port $PORT is in use"
        WARNINGS=$((WARNINGS + 1))
    else
        echo "✅ Port $PORT is available"
    fi
done

# Validate Dockerfiles
echo ""
echo "========================================"
echo "Validating Dockerfiles"
echo "========================================"
echo ""

if [ -f "backend/Dockerfile" ]; then
    if grep -q "FROM node:" backend/Dockerfile; then
        echo "✅ backend/Dockerfile uses Node.js base image"
    else
        echo "❌ backend/Dockerfile missing Node.js base image"
        ERRORS=$((ERRORS + 1))
    fi

    if grep -q "WORKDIR /app" backend/Dockerfile; then
        echo "✅ backend/Dockerfile sets WORKDIR"
    else
        echo "⚠️  WARNING: backend/Dockerfile should set WORKDIR"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

if [ -f "frontend/Dockerfile" ]; then
    if grep -q "nginx" frontend/Dockerfile; then
        echo "✅ frontend/Dockerfile uses Nginx"
    else
        echo "⚠️  WARNING: frontend/Dockerfile should use Nginx for production"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

# Summary
echo ""
echo "========================================"
echo "Summary"
echo "========================================"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ All checks passed! Docker configuration is ready."
    echo ""
    echo "Next steps:"
    echo "  1. cp .env.example .env"
    echo "  2. Edit .env with your configuration"
    echo "  3. docker-compose up -d"
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  $WARNINGS warning(s) found. Review above for details."
    echo "   Docker should still work, but some features may be limited."
    echo ""
    exit 0
else
    echo "❌ $ERRORS error(s) and $WARNINGS warning(s) found."
    echo "   Please fix the errors before running Docker."
    echo ""
    exit 1
fi