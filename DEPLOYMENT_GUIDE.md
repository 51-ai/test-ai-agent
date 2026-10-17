# AI Agent 项目部署指南

## 一、环境要求

| 软件 | 版本要求 | 说明 |
|------|----------|------|
| **Node.js** | ≥ 18.x | 推荐使用 LTS 版本 |
| **npm** | ≥ 9.x | Node.js 自带 |
| **MongoDB** | ≥ 6.x | 数据库服务 |
| **Git** | ≥ 2.x | 版本控制 |

---

## 二、安装步骤

### 2.1 克隆项目

```bash
git clone <项目仓库地址>
cd test--ai agent
```

### 2.2 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 2.3 配置环境变量

在 `backend` 目录下复制 `.env.example` 文件并重命名为 `.env`：

```bash
cd backend
copy .env.example .env
```

然后编辑 `.env` 文件，填写您的配置信息：

```env
# 必须配置
DEEPSEEK_API_KEY=your-deepseek-api-key-here
JWT_SECRET=your-secret-key-here

# 可选配置
LLM_MODEL=deepseek-v4-pro  # 或 deepseek-v4-flash
```

**重要**: `.env` 文件包含敏感信息（API Key等），不要提交到版本控制。

### 2.4 启动 MongoDB

```bash
# Windows
mongod --dbpath "C:\data\db"

# macOS/Linux
sudo systemctl start mongod
```

---

## 三、开发模式运行

### 3.1 同时启动前后端

```bash
# 终端1 - 启动后端
cd backend
npm run dev

# 终端2 - 启动前端
cd frontend
npm run dev
```

### 3.2 使用根目录脚本

```bash
# 启动后端
npm run start:backend

# 启动前端
npm run start:frontend
```

访问地址：**http://localhost:5173**

---

## 四、生产模式构建与运行

### 4.1 构建前端

```bash
cd frontend
npm run build
```

### 4.2 构建后端

```bash
cd backend
npm run build
```

### 4.3 启动生产服务器

```bash
cd backend
npm start
```

---

## 五、打包成桌面应用 (Electron)

### 5.1 安装 Electron 依赖

```bash
npm install
```

### 5.2 构建前端

```bash
npm run build:frontend
```

### 5.3 打包应用

```bash
# Windows
npm run electron:build

# 或者使用构建脚本
.\build-exe.bat
```

### 5.4 运行打包后的应用

打包后的文件位于：`dist-electron/win-unpacked/AI Agent.exe`

---

## 六、常见问题

| 问题 | 解决方案 |
|------|----------|
| **端口被占用** | `netstat -ano | findstr :3000` 查看进程，然后终止 |
| **MongoDB 连接失败** | 检查 MongoDB 是否启动，端口是否正确 |
| **npm install 失败** | 配置国内镜像：`npm config set registry https://registry.npmmirror.com` |
| **DeepSeek API 无法访问** | 检查网络，配置 DNS 为 114.114.114.114 |
| **前端白屏** | 检查浏览器控制台错误，确认后端服务是否运行 |

---

## 七、项目结构

```
test--ai agent/
├── backend/          # 后端服务
│   ├── src/          # 源代码
│   ├── dist/         # 构建输出
│   ├── package.json  # 后端依赖
│   └── .env          # 环境变量配置
├── frontend/         # 前端应用
│   ├── src/          # 源代码
│   ├── dist/         # 构建输出
│   ├── package.json  # 前端依赖
│   └── vite.config.ts # Vite配置
├── electron/         # Electron主进程
│   └── main.js       # 入口文件
├── package.json      # 根目录配置
└── build-exe.bat     # Windows构建脚本
```

---

## 八、登录账号

- **邮箱**: `admin@example.com`
- **密码**: `admin123`

---

## 九、配置说明

### 9.1 模型选择

系统支持以下模型：

| 模型 | 模型ID | 价格 | 特点 |
|------|--------|------|------|
| DeepSeek V4-Pro | deepseek-v4-pro | ¥3/百万输入, ¥6/百万输出 | 旗舰推理模型 |
| DeepSeek V4-Flash | deepseek-v4-flash | ¥1/百万输入, ¥2/百万输出 | 经济快速模型 |

### 9.2 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 后端服务端口 | 3000 |
| MONGO_URI | MongoDB 连接地址 | mongodb://localhost:27017/ai-agent |
| DEEPSEEK_API_KEY | DeepSeek API Key | - |
| LLM_MODEL | 默认LLM模型 | deepseek-v4-pro |
| USE_DUCKDUCKGO | 是否使用DuckDuckGo搜索 | true |

---

## 十、功能特性

- ✅ ReAct 框架实现（思考→行动→观察→反思循环）
- ✅ 模块化 Agent 拆分（PlannerAgent、ExecutorAgent、ReflectorAgent、ValidatorAgent）
- ✅ 文档解析工具支持（PDF、Word、PPT）
- ✅ Token 消耗显示
- ✅ 对话自动总结为标题
- ✅ 模型切换功能（V4-Pro / V4-Flash）
- ✅ Electron 桌面应用打包