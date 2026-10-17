# AI Agent 开发者入口使用指南

## 📋 概述

开发者入口是一个独立的、功能完整的测试环境，允许开发者在不登录的情况下测试和开发 AI Agent 系统的新功能。

### 🎯 主要特性

- **无需登录**: 开发者可以直接访问 `/dev` 路径进入测试环境
- **功能完整**: 提供所有核心功能的测试界面
- **数据隔离**: 所有测试数据与生产数据完全分离
- **视觉区分**: 明显的深色主题和开发者标识

## 🚀 快速开始

### 1. 启动开发者模式

确保后端环境变量中已启用开发者模式：

```bash
# 在 backend/.env 文件中设置
DEVELOPER_MODE=true
DEVELOPER_API_KEY=dev-key-2024-secure-token
DEVELOPER_USER_ID=dev-user-001
```

### 2. 访问开发者入口

在浏览器中访问：

```
http://localhost:5173/dev
```

### 3. 开始测试

系统会自动连接到后端开发者 API，开始使用各个功能模块。

## 🎨 功能模块

### 💬 对话测试

测试 AI Agent 的对话功能：

- 支持实时对话交互
- 显示开发者模式标识
- 自动会话管理

**使用示例**：
```typescript
// API 调用
POST /api/dev/chat
{
  "message": "你好，请介绍一下自己",
  "sessionId": "optional-session-id"
}
```

### 📚 RAG 检索增强

测试检索增强生成系统：

- 添加文档到知识库
- 执行相似性搜索
- 查看 RAG 统计信息

**使用示例**：
```typescript
// 添加文档
POST /api/dev/rag/documents
{
  "content": "这是一段要添加到知识库的内容",
  "metadata": { "source": "test" }
}

// 搜索查询
POST /api/dev/rag/search
{
  "query": "查找相关内容",
  "topK": 5
}
```

### 🧠 强化学习模块

测试强化学习训练功能：

- 查看训练统计
- 执行训练步骤
- 监控学习进度

**使用示例**：
```typescript
// 获取训练统计
GET /api/dev/rl/training-stats

// 执行训练
POST /api/dev/rl/train
```

### 📊 评估系统

查看系统评估指标：

- 离线评估结果
- 在线评估数据
- A/B 测试状态

**使用示例**：
```typescript
// 获取评估报告
GET /api/dev/evaluation/report
```

### 🔒 数据治理

管理测试数据：

- 查看数据统计
- 数据隔离存储
- 安全的数据管理

**使用示例**：
```typescript
// 获取数据治理统计
GET /api/dev/data/governance/stats
```

### 📈 系统监控

实时监控系统性能：

- 性能指标
- 行为指标
- 延迟和吞吐量

**使用示例**：
```typescript
// 获取监控报告
GET /api/dev/monitoring/system-report
```

### 🔄 持续迭代

管理持续迭代系统：

- 查看迭代状态
- 模型版本管理
- 反馈收集

**使用示例**：
```typescript
// 获取迭代状态
GET /api/dev/iteration/status
```

## 🔐 安全机制

### API 密钥验证

所有开发者 API 请求必须包含 `X-Developer-Key` 头：

```typescript
headers: {
  'X-Developer-Key': 'dev-key-2024-secure-token'
}
```

### 速率限制

- 默认限制: 60 请求/分钟
- 可通过环境变量 `DEVELOPER_MAX_REQUESTS` 配置

### 数据隔离

所有开发者数据使用 `dev_` 前缀隔离存储：

```
dev_user_001
dev_rag_documents
dev_training_data
```

### CORS 配置

开发者模式仅允许指定的来源访问：

```bash
DEVELOPER_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3001
```

## 🛠️ 配置说明

### 环境变量

在 `backend/.env` 文件中配置：

```env
# 开发者模式开关
DEVELOPER_MODE=true

# API 密钥（建议使用复杂的随机密钥）
DEVELOPER_API_KEY=your-secure-api-key-here

# 开发者用户 ID
DEVELOPER_USER_ID=dev-user-001

# 速率限制（请求/分钟）
DEVELOPER_MAX_REQUESTS=60

# 详细日志
DEVELOPER_LOGGING=true

# 允许的来源
DEVELOPER_ALLOWED_ORIGINS=http://localhost:5173
```

### 生产环境注意事项

⚠️ **重要**: 在生产环境中：

1. 设置 `DEVELOPER_MODE=false` 或删除该变量
2. 使用强密码的 API 密钥
3. 限制 `DEVELOPER_ALLOWED_ORIGINS` 只包含必要的域名
4. 考虑移除开发者入口路由

## 🐛 故障排除

### 连接失败

如果看到 "连接失败" 页面：

1. 确认后端服务器正在运行
2. 检查环境变量 `DEVELOPER_MODE=true`
3. 验证 API 密钥配置正确
4. 检查 CORS 配置是否包含前端地址

### API 错误

如果遇到 API 错误：

1. 查看浏览器控制台的错误信息
2. 检查后端日志
3. 确认所有必需的环境变量已设置

### 数据问题

如果测试数据异常：

1. 开发者数据完全隔离，不会影响生产数据
2. 可以随时重置开发者环境
3. 数据以 `dev_` 前缀标识

## 📞 支持

如有问题或建议，请：

1. 查看后端日志获取详细错误信息
2. 检查环境变量配置
3. 确认网络连接正常

## 🔄 更新日志

### v1.0.0 (2024)

- 初始版本发布
- 包含所有核心功能模块
- 完整的数据隔离机制
- 详细的 API 文档

---

**开发者入口** - 让 AI Agent 开发更简单！
