# AI Agent 使用说明

## 📋 目录

- [项目概述](#项目概述)
- [环境要求](#环境要求)
- [安装步骤](#安装步骤)
- [运行项目](#运行项目)
- [功能说明](#功能说明)
- [常见问题](#常见问题)
- [注意事项](#注意事项)

***

## 项目概述

AI Agent 是一个基于 Electron + React + Node.js 的智能对话系统，集成了 DeepSeek 大模型，支持：

- ✅ 智能对话功能
- ✅ 多模型切换（V4-Pro / V4-Flash）
- ✅ 数据持久化存储
- ✅ 嵌入式 MongoDB（无需单独安装数据库）
- ✅ 用户认证系统
- ✅ 开发者门户

***

## 环境要求

### 必需软件

| 软件          | 版本要求                 | 说明              |
| ----------- | -------------------- | --------------- |
| **Node.js** | >= 18.x（推荐 20.x LTS） | JavaScript 运行环境 |
| **npm**     | >= 9.x               | Node.js 包管理器    |

### 检查版本

在命令行中运行：

```powershell
node --version
npm --version
```

**推荐版本**：

- Node.js: `v20.x.x` 或 `v22.x.x`（LTS版本）
- npm: `10.x.x`

### 如果版本不符合

1. 访问 <https://nodejs.org>
2. 下载 **LTS 版本**（推荐 20.x）
3. 安装时勾选 **"Add to PATH"**

***

## 安装步骤

### 第一步：复制项目到电脑

将项目从U盘复制到电脑硬盘（推荐），或直接在U盘上运行：

```powershell
# 复制到电脑（假设复制到D盘）
Copy-Item "U盘路径\test--ai agent" -Destination "D:\projects\test--ai agent" -Recurse

# 或直接在U盘上运行（假设U盘是E盘）
cd "E:\test--ai agent"
```

### 第二步：进入项目目录

```powershell
# 进入项目目录
cd "D:\projects\test--ai agent"
```

### 第三步：安装依赖

```powershell
# 安装所有依赖（包含backend和frontend）
npm run install:all
```

或手动安装：

```powershell
# 安装根目录依赖
npm install

# 安装后端依赖
cd backend
npm install
cd ..

# 安装前端依赖
cd frontend
npm install
cd ..
```

### 第四步：配置环境变量

检查 `.env` 文件是否存在：

```powershell
# 查看环境变量文件
Get-Content ".env"
```

确保包含以下配置：

```env
# DeepSeek API配置
DEEPSEEK_API_KEY=你的API密钥

# 数据库配置（嵌入式MongoDB，无需修改）
MONGODB_URI=mongodb://localhost:27017/ai-agent

# 服务端口
PORT=3000

# JWT密钥
JWT_SECRET=your-jwt-secret-key
```

***

## 运行项目

### 方式一：开发模式运行（推荐）

```powershell
# 进入项目目录
cd "D:\projects\test--ai agent"

# 启动开发服务器
npm run dev
```

启动后：

- 后端服务：<http://localhost:3000>
- 前端界面：<http://localhost:5173>

### 方式二：运行打包后的程序

如果已有打包好的exe文件：

```powershell
# 运行打包后的程序
Start-Process "dist-electron\win-unpacked\AI Agent.exe"
```

### 方式三：Electron开发模式

```powershell
# 启动Electron开发模式
npm run electron:dev
```

***

## 功能说明

### 1. 用户登录

- 打开应用后，需要注册/登录
- 默认管理员账号：`admin@example.com` / `admin123`

### 2. 智能对话

- 登录后进入聊天界面
- 支持多轮对话
- 数据自动保存到本地存储

### 3. 模型切换

界面提供两个模型切换按钮：

| 模型           | 说明     | 适用场景      |
| ------------ | ------ | --------- |
| **V4-Pro**   | 高性能模型  | 复杂任务、深度思考 |
| **V4-Flash** | 快速响应模型 | 简单对话、快速响应 |

### 4. 开发者门户

- 点击右上角开发者入口
- 查看系统监控、日志、配置等

### 5. 数据持久化

对话数据自动保存到：

- localStorage（前端本地存储）
- MongoDB（后端数据库）

***

## 常见问题与排查命令

### 🔧 问题排查快速命令表

| 问题类型        | 检查命令               | 修复命令                        | <br />                   |
| ----------- | ------------------ | --------------------------- | :----------------------- |
| Node.js版本不对 | `node --version`   | 下载安装新版本                     | <br />                   |
| npm版本不对     | `npm --version`    | `npm install -g npm@latest` | <br />                   |
| 端口被占用       | \`netstat -ano     | findstr :3000\`             | `taskkill /F /PID <PID>` |
| 依赖安装失败      | `npm cache verify` | `npm cache clean --force`   | <br />                   |
| 环境变量缺失      | `Get-Content .env` | 手动创建`.env`                  | <br />                   |
| 服务无法启动      | 查看终端日志             | 重启服务                        | <br />                   |

***

### Q1: npm install 失败？

**原因**：网络问题导致依赖下载失败

**检查命令**：

```powershell
# 检查npm配置
npm config list

# 检查缓存状态
npm cache verify

# 检查网络连接
ping registry.npmjs.org
```

**解决方案**：

```powershell
# 步骤1：切换到淘宝镜像（国内用户推荐）
npm config set registry https://registry.npmmirror.com

# 步骤2：清除npm缓存
npm cache clean --force

# 步骤3：删除已有的node_modules
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json

# 步骤4：重新安装依赖
npm install

# 步骤5：如果还有问题，尝试使用cnpm
npm install -g cnpm --registry=https://registry.npmmirror.com
cnpm install
```

***

### Q2: 端口被占用？

**检查端口占用**：

```powershell
# 检查3000端口（后端）
netstat -ano | findstr :3000

# 检查5173端口（前端）
netstat -ano | findstr :5173

# 检查27017端口（MongoDB）
netstat -ano | findstr :27017

# 检查所有被占用的端口
netstat -ano | findstr LISTENING
```

**解决方案**：

```powershell
# 方法1：找到进程PID并结束（示例：PID=12345）
netstat -ano | findstr :3000  # 找到PID
taskkill /F /PID 12345        # 结束进程

# 方法2：一键结束占用3000端口的进程
$pid = (Get-NetTCPConnection -LocalPort 3000).OwningProcess
Stop-Process -Id $pid -Force

# 方法3：批量清理所有Node.js进程
taskkill /F /IM node.exe
```

***

### Q3: DeepSeek API 连接失败？

**检查网络连接**：

```powershell
# 测试API连通性
curl https://api.deepseek.com

# 或使用PowerShell
Invoke-WebRequest -Uri "https://api.deepseek.com" -UseBasicParsing

# 检查DNS解析
nslookup api.deepseek.com

# 检查防火墙规则
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*node*"}
```

**解决方案**：

```powershell
# 方案1：使用代理（需要先配置代理）
# 在.env文件中添加：
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890

# 方案2：切换网络环境
# 使用手机热点或其他网络

# 方案3：检查防火墙（临时关闭测试）
# 控制面板 -> 系统和安全 -> Windows Defender防火墙 -> 关闭
```

***

### Q4: MongoDB 连接失败？

**检查MongoDB状态**：

```powershell
# 检查27017端口是否被占用
netstat -ano | findstr :27017

# 检查是否有外部MongoDB进程
Get-Process | Where-Object {$_.ProcessName -like "*mongo*"}

# 检查环境变量配置
Get-Content backend\.env | findstr MONGO
```

**解决方案**：

```powershell
# 方案1：结束占用27017端口的进程
netstat -ano | findstr :27017
taskkill /F /PID <找到的PID>

# 方案2：重启应用（嵌入式MongoDB会自动重启）
# 在终端中按 Ctrl+C 停止服务
# 然后重新运行 npm run dev

# 方案3：清理MongoDB缓存
Remove-Item -Recurse -Force backend\node_modules\.cache
npm run dev
```

***

### Q5: TypeScript 编译错误？

**检查编译状态**：

```powershell
# 检查TypeScript版本
npm list typescript

# 检查tsconfig配置
Get-Content tsconfig.json

# 尝试编译查看错误
cd backend
npm run build
cd ..
```

**解决方案**：

```powershell
# 步骤1：清理构建产物
Remove-Item -Recurse -Force backend\dist
Remove-Item -Recurse -Force frontend\dist

# 步骤2：清理node_modules缓存
Remove-Item -Recurse -Force backend\node_modules\.cache
Remove-Item -Recurse -Force frontend\node_modules\.cache

# 步骤3：重新安装依赖
cd backend
npm install
cd ..
cd frontend
npm install
cd ..

# 步骤4：重新构建
cd backend
npm run build
cd ..
```

***

### Q6: 服务无法启动？

**检查服务状态**：

```powershell
# 检查后端服务日志
cd backend
npm run dev

# 检查前端服务日志
cd frontend
npm run dev

# 检查所有node进程
Get-Process node

# 检查项目依赖是否完整
npm list --depth=0
```

**解决方案**：

```powershell
# 方案1：完全重置项目
# 停止所有服务
taskkill /F /IM node.exe

# 清理所有依赖
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force backend\node_modules
Remove-Item -Recurse -Force frontend\node_modules
Remove-Item package-lock.json
Remove-Item backend\package-lock.json
Remove-Item frontend\package-lock.json

# 重新安装
npm run install:all

# 启动服务
npm run dev
```

***

### Q7: 环境变量配置问题？

**检查环境变量**：

```powershell
# 查看根目录.env文件
Get-Content .env

# 查看backend目录.env文件
Get-Content backend\.env

# 查看frontend目录.env文件（如果存在）
Get-Content frontend\.env

# 检查是否有.env.example模板
Get-Content .env.example
```

**解决方案**：

```powershell
# 方案1：从模板创建.env文件
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env

# 方案2：手动创建.env文件
# 使用记事本或VS Code编辑：
# 填入你的API密钥等配置

# 方案3：验证环境变量是否生效
cd backend
node -e "console.log(process.env.DEEPSEEK_API_KEY)"
cd ..
```

***

### Q8: 前端无法连接后端？

**检查连接状态**：

```powershell
# 检查后端API是否响应
curl http://localhost:3000/api/health

# 或使用PowerShell
Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing

# 检查前端配置
Get-Content frontend\src\config.ts
```

**解决方案**：

```powershell
# 方案1：检查CORS配置（在backend/src/index.ts）
# 确保 CORS 已正确配置

# 方案2：检查前端API地址
# 确保frontend调用的是正确的后端地址（localhost:3000）

# 方案3：重启前后端服务
taskkill /F /IM node.exe
npm run dev
```

***

### 🛠️ 完整重置脚本

如果以上方法都无法解决，可以运行以下完整重置脚本：

```powershell
# === 完整重置脚本 ===

Write-Host "正在重置项目..."

# 1. 停止所有Node进程
Write-Host "停止所有Node进程..."
taskkill /F /IM node.exe

# 2. 清理所有依赖
Write-Host "清理所有依赖..."
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force backend\node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force frontend\node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue
Remove-Item backend\package-lock.json -ErrorAction SilentlyContinue
Remove-Item frontend\package-lock.json -ErrorAction SilentlyContinue

# 3. 清理构建产物
Write-Host "清理构建产物..."
Remove-Item -Recurse -Force backend\dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force frontend\dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force backend\node_modules\.cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force frontend\node_modules\.cache -ErrorAction SilentlyContinue

# 4. 清理npm缓存
Write-Host "清理npm缓存..."
npm cache clean --force

# 5. 设置淘宝镜像
Write-Host "设置npm镜像..."
npm config set registry https://registry.npmmirror.com

# 6. 重新安装依赖
Write-Host "重新安装依赖..."
npm install
cd backend
npm install
cd ..
cd frontend
npm install
cd ..

# 7. 启动服务
Write-Host "启动服务..."
Write-Host "项目已重置完成！请运行: npm run dev"
Write-Host "访问: http://localhost:5173"
```

***

## 注意事项

### ⚠️ 重要提醒

1. **不要删除** **`.env`** **文件**
   - 包含API密钥和配置信息
   - 删除后需要重新配置
2. **不要上传** **`.env`** **到公开仓库**
   - 包含敏感信息（API密钥）
   - 使用 `.env.example` 作为模板
3. **Node.js 版本要求**
   - 必须使用 18.x 以上版本
   - 推荐 20.x LTS 版本
4. **数据备份**
   - 定期备份重要对话数据
   - MongoDB数据存储在本地
5. **网络环境**
   - DeepSeek API需要访问外网
   - 如无法访问，请使用代理

***

## 快速启动脚本

创建一个启动脚本 `start.bat`：

```bat
@echo off
echo 正在启动 AI Agent...
cd /d "%~dp0"
npm run dev
pause
```

双击 `start.bat` 即可启动项目。

***

## 项目结构

```
test--ai agent/
├── backend/           # 后端代码
│   ├── src/           # 源代码
│   ├── dist/          # 编译输出
│   └── .env           # 后端环境变量
├── frontend/          # 前端代码
│   ├── src/           # 源代码
│   └── dist/          # 构建输出
├── electron/          # Electron主进程
├── dist-electron/     # Electron打包输出
├── .env               # 根目录环境变量
├── package.json       # 项目配置
└── USER_GUIDE.md      # 本使用说明
```

***

## 更新日志

| 版本    | 更新内容                  |
| ----- | --------------------- |
| 1.0.0 | 初始版本，支持基础对话功能         |
| -     | 支持V4-Pro/V4-Flash模型切换 |
| -     | 嵌入式MongoDB集成          |
| -     | 开发者门户功能               |

***

## 技术支持

如有问题，请检查：

1. Node.js版本是否符合要求
2. 依赖是否完整安装
3. 环境变量配置是否正确
4. 网络是否能访问DeepSeek API

***

**祝使用愉快！**
