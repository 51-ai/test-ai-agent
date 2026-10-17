# AI Agent System - Backend

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

如果遇到类型定义错误（如 `找不到名称 "console"`），请确保运行：

```bash
npm install
```

这将安装所有必要的类型定义包，包括：
- `@types/node` - Node.js 全局对象类型（如 console, process, Buffer 等）
- `@types/uuid` - UUID 模块类型定义

### 2. 配置环境变量

复制 `.env.example` 为 `.env`（如果不存在）：

```bash
cp .env.example .env
```

或手动创建 `.env` 文件：

```env
PORT=3000
HOST=localhost
NODE_ENV=development

JWT_SECRET=your-secret-key-here-change-in-production
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10

MONGO_URI=mongodb://localhost:27017/ai-agent
REDIS_URI=redis://localhost:6379

OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4
```

### 3. 启动数据库

使用 Docker 启动 MongoDB 和 Redis：

```bash
docker-compose up -d mongodb redis
```

或手动启动服务（确保 MongoDB 和 Redis 已安装）。

### 4. 构建和运行

```bash
# 开发模式（热重载）
npm run dev

# 生产构建
npm run build
npm start

# 类型检查
npm run typecheck

# 运行测试
npm test
```

## 常见问题

### Q: TypeScript 报错 "找不到名称 console"

**原因**: 缺少 `@types/node` 类型定义

**解决方案**:
```bash
npm install
```

### Q: TypeScript 报错 "找不到模块 uuid"

**原因**: 缺少 `@types/uuid` 类型定义

**解决方案**:
```bash
npm install @types/uuid
```

### Q: 构建失败

**解决方案**:
1. 确保依赖已安装：`npm install`
2. 检查 TypeScript 配置：`tsconfig.json`
3. 运行类型检查：`npm run typecheck`

## 项目结构

```
backend/
├── src/
│   ├── api/               # REST API 路由
│   ├── core/              # 核心模块
│   │   ├── decision/      # 决策引擎
│   │   ├── execution/     # 执行引擎
│   │   ├── memory/        # 记忆系统
│   │   ├── monitoring/    # 性能监控
│   │   ├── nlp/           # NLP 模块
│   │   ├── perception/    # 感知模块
│   │   └── tools/         # 工具管理
│   ├── config/            # 配置
│   ├── middlewares/       # Express 中间件
│   ├── models/            # 数据库模型
│   ├── services/          # 业务逻辑
│   ├── tests/             # 单元测试
│   └── utils/            # 工具函数
├── package.json
└── tsconfig.json
```

## API 端点

### 认证
- `POST /api/auth/register` - 注册用户
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户

### 对话
- `GET /api/conversations` - 获取所有对话
- `POST /api/conversations` - 创建新对话
- `GET /api/conversations/:id` - 获取对话详情
- `POST /api/conversations/:id/messages` - 添加消息

### Agent
- `POST /api/agent/chat` - 发送消息给 Agent
- `GET /api/agent/memory/stats` - 获取记忆统计
- `POST /api/agent/memory/consolidate` - 巩固记忆

### 监控
- `GET /api/monitoring/metrics` - 获取性能指标
- `GET /api/monitoring/metrics/:name` - 获取指定指标
- `GET /api/monitoring/report` - 获取性能报告
- `POST /api/monitoring/metrics/reset` - 重置指标