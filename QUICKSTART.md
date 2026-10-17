# ========================================
# AI Agent System - Quick Start Guide
# ========================================

## 无需 Docker 的快速启动

如果 Docker 安装太慢或遇到问题，可以使用以下方法快速启动项目：

### 前提条件

1. **Node.js 18+** - https://nodejs.org/zh-cn/download/
2. **npm** - Node.js 自带

### 快速启动步骤

#### 1. 安装后端依赖

```powershell
cd backend
npm install
```

#### 2. 启动后端（开发模式）

```powershell
npm run dev
```

后端将在 http://localhost:3000 运行

#### 3. 新开终端，安装前端依赖

```powershell
cd frontend
npm install
```

#### 4. 启动前端

```powershell
npm run dev
```

前端将在 http://localhost:5173 运行

#### 5. 打开浏览器访问

- 前端：http://localhost:5173
- 后端 API：http://localhost:3000
- 健康检查：http://localhost:3000/api/health

### 使用内存数据库（推荐用于开发测试）

如果您不想安装 MongoDB 和 Redis，可以使用内存数据库：

1. 编辑 `backend/src/dev-server.ts`
2. 运行 `npm run dev:simple`

内存数据库会自动创建，无需额外配置。

### 可用脚本

```powershell
# 后端
npm run dev          # 开发模式（热重载）
npm run build        # 构建
npm run start        # 生产模式
npm run typecheck    # 类型检查
npm test             # 运行测试

# 前端
npm run dev          # 开发模式（热重载）
npm run build        # 构建
npm run preview      # 预览构建结果
```

### 功能说明

使用内存数据库时：
- ✅ 对话功能正常工作
- ✅ AI Agent 响应正常
- ✅ 性能监控正常
- ❌ 数据重启后会丢失
- ❌ 不支持多用户

适合场景：
- 快速演示
- 功能测试
- 开发调试

### 生产环境（需要 Docker）

完成开发测试后，使用 Docker 进行生产部署：

```powershell
# 1. 复制环境变量
copy .env.example .env

# 2. 启动所有服务
docker-compose up -d

# 3. 查看状态
docker-compose ps
```

### 常见问题

#### Q: 端口被占用
```powershell
# 查看端口占用
netstat -ano | findstr ":3000"
netstat -ano | findstr ":5173"

# 关闭占用程序或修改端口
```

#### Q: npm 安装失败
```powershell
# 清除缓存
npm cache clean --force

# 使用淘宝镜像
npm config set registry https://registry.npmmirror.com
npm install
```

#### Q: TypeScript 错误
```powershell
npm install
npm run typecheck
```

### 技术支持

如果遇到问题：
1. 查看终端错误信息
2. 运行 `npm run typecheck` 检查代码
3. 查看浏览器控制台错误
4. 查看后端日志