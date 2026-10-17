# AI Agent 系统 - 快速启动指南

## 🚀 5分钟快速开始

### 前置要求

确保您的系统已安装：
- ✅ Node.js 18+ ([下载](https://nodejs.org/))
- ✅ Docker & Docker Compose ([下载](https://www.docker.com/))
- ✅ Git ([下载](https://git-scm.com/))

### 步骤1: 克隆项目

```bash
git clone <repository-url>
cd ai-agent-system
```

### 步骤2: 配置环境变量

```bash
# 复制示例配置文件
cp .env.example .env

# 编辑 .env 文件，至少配置以下变量：
# JWT_SECRET=your-secret-key
# OPENAI_API_KEY=your-api-key (可选)
```

### 步骤3: 启动服务

```bash
# 方式1: 使用Docker（推荐）
docker-compose up -d

# 方式2: 本地开发
npm install
npm run dev
```

### 步骤4: 访问应用

打开浏览器访问：
- **前端**: http://localhost:5173
- **后端API**: http://localhost:3000

### 步骤5: 创建第一个对话

1. 注册账号或登录
2. 点击"新建对话"
3. 输入消息，例如："你好，请介绍一下你自己"
4. 查看AI Agent的响应

---

## 📋 完整启动指南

### 本地开发环境

#### 1. 安装依赖

```bash
# 根目录
npm install

# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

#### 2. 启动数据库（Docker）

```bash
docker-compose up -d mongodb redis
```

#### 3. 启动后端

```bash
cd backend
npm run dev
```

后端将在 http://localhost:3000 启动

#### 4. 启动前端

```bash
cd frontend
npm run dev
```

前端将在 http://localhost:5173 启动

---

## 🐳 Docker部署

### 一键启动所有服务

```bash
docker-compose up -d
```

这将启动：
- MongoDB (端口 27017)
- Redis (端口 6379)
- Backend (端口 3000)
- Frontend (端口 80)

### 查看日志

```bash
# 所有服务
docker-compose logs -f

# 特定服务
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 停止服务

```bash
docker-compose down
```

### 重新构建

```bash
docker-compose build --no-cache
docker-compose up -d
```

---

## 🔧 常见问题

### Q1: MongoDB连接失败

**症状**: `MongoNetworkError: connect ECONNREFUSED`

**解决方案**:
```bash
# 检查MongoDB是否运行
docker-compose ps mongodb

# 查看日志
docker-compose logs mongodb

# 重启MongoDB
docker-compose restart mongodb
```

### Q2: 端口被占用

**症状**: `Error: listen EADDRINUSE: address already in use :::3000`

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :3000

# 杀死进程
kill -9 <PID>

# 或者修改端口
PORT=3001 npm run dev
```

### Q3: 内存不足

**症状**: `JavaScript heap out of memory`

**解决方案**:
```bash
# 增加Node.js内存限制
export NODE_OPTIONS="--max-old-space-size=4096"
npm run dev
```

### Q4: 依赖安装失败

**症状**: `npm ERR! Could not resolve dependency`

**解决方案**:
```bash
# 清除缓存
npm cache clean --force

# 删除node_modules
rm -rf node_modules backend/node_modules frontend/node_modules

# 重新安装
npm install
cd backend && npm install
cd ../frontend && npm install
```

---

## 📊 系统健康检查

### API健康检查

```bash
# 基础健康检查
curl http://localhost:3000/api/health

# 数据库连接
curl http://localhost:3000/api/health/db

# Redis连接
curl http://localhost:3000/api/health/redis
```

### 预期响应

```json
{
  "status": "ok",
  "timestamp": "2026-06-14T12:00:00Z",
  "uptime": 3600,
  "database": "connected",
  "redis": "connected"
}
```

---

## 🎯 功能测试

### 1. 用户认证

```bash
# 注册
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"password123"}'

# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"password123"}'
```

保存返回的token用于后续请求。

### 2. Agent交互

```bash
# 发送消息
curl -X POST http://localhost:3000/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message":"你好，请介绍一下你自己"}'
```

### 3. 记忆统计

```bash
# 获取记忆统计
curl http://localhost:3000/api/agent/memory/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🌍 环境变量说明

### 必需配置

| 变量 | 说明 | 示例 |
|------|------|------|
| PORT | 后端端口 | 3000 |
| MONGO_URI | MongoDB连接字符串 | mongodb://localhost:27017/ai-agent |
| REDIS_URI | Redis连接字符串 | redis://localhost:6379 |
| JWT_SECRET | JWT密钥 | your-secret-key |

### 可选配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| OPENAI_API_KEY | OpenAI API密钥 | - |
| GOOGLE_SEARCH_API_KEY | Google搜索API密钥 | - |
| PYTHON_PATH | Python路径 | python3 |
| RATE_LIMIT_MAX_REQUESTS | 速率限制 | 100 |

---

## 📚 更多资源

- **系统架构文档**: [docs/system-architecture.md](docs/system-architecture.md)
- **部署指南**: [docs/deployment-guide.md](docs/deployment-guide.md)
- **API文档**: README.md # API Endpoints
- **项目总结**: [docs/project-summary.md](docs/project-summary.md)

---

## 💡 提示

### 开发模式

```bash
# 热重载开发
npm run dev

# 仅后端
cd backend && npm run dev

# 仅前端
cd frontend && npm run dev
```

### 生产模式

```bash
# 构建
npm run build

# 启动
npm start
```

### 测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 生成覆盖率报告
npm test -- --coverage
```

---

## 🆘 获取帮助

如果遇到问题：

1. 查看日志: `docker-compose logs -f`
2. 检查健康状态: `curl http://localhost:3000/api/health`
3. 查阅文档: [docs/](docs/)
4. 提交Issue: GitHub Issues

---

**祝您使用愉快！** 🎉
