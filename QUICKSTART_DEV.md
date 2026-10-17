# 🚀 开发者入口快速启动指南

## 📖 简介

开发者入口是一个**无需登录**的独立测试环境，允许开发者快速测试 AI Agent 系统的所有核心功能，同时确保测试数据与生产数据完全隔离。

## ⚡ 快速开始

### 1. 启动后端服务

```bash
cd backend
npm install
npm run dev
```

后端将在 `http://localhost:3000` 运行。

### 2. 启动前端服务

```bash
cd frontend
npm install
npm run dev
```

前端将在 `http://localhost:5173` 运行。

### 3. 访问开发者入口

在浏览器中打开：

```
http://localhost:5173/dev
```

## 🎯 快速功能测试

### 💬 对话测试

在对话测试面板中输入：

```
你好，请介绍一下你的功能
```

系统将返回 AI Agent 的响应。

### 📚 RAG 检索测试

1. 在 "RAG 检索" 面板中点击 "添加文档"
2. 输入测试文档内容
3. 使用搜索功能查找相关内容

### 🧠 强化学习测试

在 "强化学习" 面板中点击 "🚀 执行训练步骤" 按钮，观察训练统计的变化。

### 📊 查看评估指标

在 "评估系统" 面板中查看系统的各项评估指标。

## 🔐 安全性

- ✅ API 密钥验证（`X-Developer-Key` 头）
- ✅ 速率限制（60 请求/分钟）
- ✅ CORS 保护
- ✅ 数据完全隔离（`dev_` 前缀）
- ✅ 仅开发环境可用

## 🎨 视觉标识

开发者入口使用**深色主题**，与普通用户入口的浅色主题形成明显对比：

- 🔧 标题栏带有紫色渐变背景
- ⚙️ 侧边栏功能导航使用深灰色主题
- 🔒 所有隔离数据使用明显的标签标识

## 🔧 从普通入口访问

在普通用户界面（Chat 页面）的右上角，有一个**扳手图标**（🔧），点击即可跳转到开发者入口。

## 📝 环境变量配置

在 `backend/.env` 文件中配置：

```env
DEVELOPER_MODE=true                    # 启用开发者模式
DEVELOPER_API_KEY=dev-key-2024-secure-token  # API 密钥
DEVELOPER_USER_ID=dev-user-001          # 开发者用户 ID
DEVELOPER_MAX_REQUESTS=60               # 速率限制
DEVELOPER_LOGGING=true                  # 详细日志
```

## 🐛 故障排除

### 连接失败

**问题**：显示 "连接失败" 页面

**解决方案**：
1. 确认后端服务正在运行
2. 检查环境变量 `DEVELOPER_MODE=true`
3. 验证 API 密钥配置

### API 错误

**问题**：API 请求返回错误

**解决方案**：
1. 查看浏览器控制台错误信息
2. 检查后端日志
3. 确认 API 密钥正确

## 📚 更多资源

- [完整开发者文档](./DEVELOPER_PORTAL_GUIDE.md)
- [API 文档](./API.md)
- [系统架构文档](./ARCHITECTURE.md)

## 🆘 获取帮助

如有问题：

1. 查看 [DEVELOPER_PORTAL_GUIDE.md](./DEVELOPER_PORTAL_GUIDE.md)
2. 检查后端日志
3. 确认环境配置正确

---

**快速提示**：开发者入口的 URL 是 `/dev`，可以通过点击 Chat 页面的扳手图标快速访问！
