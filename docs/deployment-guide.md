# AI Agent 系统部署指南

## 1. 环境要求

| 组件 | 最低版本 | 推荐版本 | 说明 |
|-----|---------|---------|------|
| Node.js | 18.x | 20.x LTS | 运行环境 |
| MongoDB | 6.0 | 7.0 | 用户数据和会话存储 |
| Redis | 7.0 | 7.2 | 缓存和会话管理 |
| Docker | 24.x | 26.x | 容器化部署（可选） |
| Docker Compose | 2.x | 2.27+ | 服务编排（可选） |

---

## 2. 本地开发环境部署

### 2.1 克隆项目

```bash
cd /path/to/workspace
git clone <repository_url>
cd "test--ai agent"
```

### 2.2 环境变量配置

**后端配置** (`backend/.env`):
```env
# 服务器配置
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# 数据库
MONGO_URI=mongodb://localhost:27017/ai_agent
REDIS_URI=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# OpenAI（可选）
OPENAI_API_KEY=sk-your-api-key
OPENAI_MODEL=gpt-4o

# 开发者模式
DEVELOPER_MODE=true
```

**前端配置** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
```

### 2.3 启动数据库

**使用 Docker Compose**:
```bash
docker-compose up -d mongodb redis
```

**或手动安装**:
```bash
# macOS
brew install mongodb-community redis
brew services start mongodb-community
brew services start redis

# Ubuntu/Debian
sudo apt install mongodb redis-server
sudo systemctl start mongod redis-server
```

### 2.4 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd backend && npm install

# 安装前端依赖
cd ../frontend && npm install
```

### 2.5 启动服务

```bash
# 终端1：启动后端
cd backend
npm run dev

# 终端2：启动前端
cd frontend
npm run dev
```

**访问地址**:
- 前端: http://localhost:5173
- 后端API: http://localhost:3000/api
- 健康检查: http://localhost:3000/api/health

---

## 3. Docker 部署

### 3.1 使用 docker-compose 一键部署

```bash
# 构建并启动所有服务
docker-compose -f docker-compose.dev.yml up --build

# 后台运行
docker-compose -f docker-compose.dev.yml up -d --build
```

### 3.2 单独构建镜像

**后端**:
```bash
cd backend
docker build -t ai-agent-backend -f Dockerfile.dev .
docker run -p 3000:3000 --env-file .env ai-agent-backend
```

**前端**:
```bash
cd frontend
docker build -t ai-agent-frontend -f Dockerfile.dev .
docker run -p 5173:5173 ai-agent-frontend
```

---

## 4. 生产环境部署

### 4.1 安全加固清单

- [ ] 修改所有默认密钥（JWT_SECRET等）
- [ ] 设置 `NODE_ENV=production`
- [ ] 关闭 `DEVELOPER_MODE`
- [ ] 配置 HTTPS 证书
- [ ] 设置 MongoDB 认证和网络白名单
- [ ] 设置 Redis 密码认证
- [ ] 配置日志轮转
- [ ] 设置资源限制（CPU/内存）

### 4.2 Nginx 反向代理配置

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # 前端静态文件
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API 接口
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # 速率限制
        limit_req zone=api_limit burst=20 nodelay;
    }

    # WebSocket (Socket.IO)
    location /socket.io/ {
        proxy_pass http://localhost:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}

# 速率限制区域
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
```

### 4.3 K8s 部署（概要）

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-agent-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-agent-backend
  template:
    metadata:
      labels:
        app: ai-agent-backend
    spec:
      containers:
      - name: backend
        image: ai-agent-backend:latest
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        env:
        - name: NODE_ENV
          value: "production"
        - name: MONGO_URI
          valueFrom:
            secretKeyRef:
              name: ai-agent-secrets
              key: mongo-uri
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: ai-agent-backend
spec:
  selector:
    app: ai-agent-backend
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ai-agent-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ai-agent-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## 5. 故障排除

### 5.1 MongoDB 连接失败

```bash
# 检查 MongoDB 服务状态
sudo systemctl status mongod

# 查看 MongoDB 日志
tail -f /var/log/mongodb/mongod.log

# 测试连接
mongosh mongodb://localhost:27017/ai_agent
```

### 5.2 Redis 连接失败

```bash
# 检查 Redis 状态
redis-cli ping  # 应返回 PONG

# 重启 Redis
sudo systemctl restart redis-server
```

### 5.3 端口被占用

```bash
# Windows
netstat -ano | findstr :3000

# Linux/macOS
lsof -i :3000
```

### 5.4 内存不足

```bash
# 检查 Node.js 内存限制
node -e "console.log(v8.getHeapStatistics())"

# 增加 Node.js 内存限制（生产环境建议）
NODE_OPTIONS="--max-old-space-size=4096" node dist/index.js
```

### 5.5 Docker 容器无法启动

```bash
# 查看容器日志
docker logs <container_id>

# 重新构建（无缓存）
docker-compose build --no-cache

# 清理并重启
docker-compose down -v
docker-compose up --build
```
