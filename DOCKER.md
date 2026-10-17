# AI Agent System - Docker Deployment Guide

## Quick Start

### Windows
```batch
# Copy environment file
copy .env.example .env

# Edit .env with your settings
notepad .env

# Start all services
docker-start.bat
```

### Linux/Mac
```bash
# Copy environment file
cp .env.example .env

# Edit .env with your settings
nano .env

# Start all services
chmod +x docker-start.sh
./docker-start.sh
```

## Docker Commands

| Command | Description |
|---------|-------------|
| `start` | Start all services |
| `stop` | Stop all services |
| `restart` | Restart all services |
| `build` | Build all images (no cache) |
| `logs` | Show live logs |
| `status` | Show service status |
| `clean` | Remove all containers and volumes |
| `dev` | Start development environment |
| `prod` | Start production environment |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                            │
│                   (ai-agent-network)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Frontend   │───▶│   Backend   │───▶│  MongoDB    │     │
│  │   (nginx)   │    │  (Node.js)  │    │   (mongo)   │     │
│  │   Port: 80  │    │  Port: 3000 │    │ Port: 27017 │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                           │                                  │
│                           ▼                                  │
│                    ┌─────────────┐                          │
│                    │    Redis    │                          │
│                    │   (redis)   │                          │
│                    │  Port: 6379 │                          │
│                    └─────────────┘                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Services

### MongoDB (Port 27017)
- Image: `mongo:6.0`
- Persistent storage: `mongodb_data`
- Auth enabled with root user

### Redis (Port 6379)
- Image: `redis:7.0-alpine`
- Persistent storage: `redis_data`
- Max memory: 256MB with LRU eviction

### Backend (Port 3000)
- Node.js 20 Alpine
- Multi-stage build for optimization
- Health check endpoint: `/api/health`

### Frontend (Port 80)
- Nginx Alpine
- React production build
- API proxy configuration

## Environment Variables

### Required
- `JWT_SECRET` - Authentication secret (min 32 characters)
- `OPENAI_API_KEY` - OpenAI API key

### Optional
- `MONGO_ROOT_USER` - MongoDB root username
- `MONGO_ROOT_PASSWORD` - MongoDB root password
- `OPENAI_MODEL` - OpenAI model (default: gpt-4)

## Health Checks

All services include health checks:
- MongoDB: `db.runCommand("ping").ok`
- Redis: `redis-cli ping`
- Backend: `wget http://localhost:3000/api/health`
- Frontend: `curl http://localhost/`

## Volumes

| Volume Name | Purpose |
|-------------|---------|
| `ai-agent-mongodb-data` | MongoDB data persistence |
| `ai-agent-mongodb-config` | MongoDB configuration |
| `ai-agent-redis-data` | Redis data persistence |

## Development Mode

```bash
# Start development environment
docker-start.bat dev

# Features:
# - Hot reload enabled
# - Source code mounted as volumes
# - Debug logging enabled
# - No MongoDB auth
```

## Production Mode

```bash
# Configure production environment
copy .env.example .env
# Edit .env with production values

# Start production environment
docker-start.bat prod

# Features:
# - Optimized multi-stage builds
# - Health checks enabled
# - Log rotation configured
# - MongoDB auth enabled
```

## Troubleshooting

### Check service status
```bash
docker-start.bat status
```

### View logs
```bash
docker-start.bat logs
# Or for specific service:
docker-compose logs backend
docker-compose logs frontend
```

### Restart services
```bash
docker-start.bat restart
```

### Clean up and rebuild
```bash
docker-start.bat clean
docker-start.bat build
docker-start.bat start
```

### Common Issues

1. **Port conflicts**
   - Ensure ports 80, 3000, 27017, 6379 are not in use
   - Stop conflicting services or change ports in docker-compose.yml

2. **Permission denied (Linux/Mac)**
   ```bash
   chmod +x docker-start.sh
   ```

3. **Docker not running**
   - Start Docker Desktop (Windows/Mac)
   - Start Docker daemon (Linux)

4. **Memory issues**
   - Increase Docker memory limit to at least 4GB
   - Redis maxmemory is set to 256MB

## Resource Requirements

| Service | CPU | Memory |
|---------|-----|--------|
| MongoDB | 1 | 1GB |
| Redis | 0.5 | 256MB |
| Backend | 1 | 512MB |
| Frontend | 0.25 | 128MB |
| **Total** | **2.75** | **1.9GB** |

## Security Notes

1. Change default passwords in production
2. Use strong JWT_SECRET (min 32 characters)
3. Enable HTTPS in production (add SSL certificates)
4. Restrict MongoDB and Redis ports in production
5. Review and update rate limiting settings