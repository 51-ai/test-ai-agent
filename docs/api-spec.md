# AI Agent 系统 API 接口文档

## 1. 概述

**Base URL**: `http://<host>:<port>/api`

**认证方式**: JWT Bearer Token

**请求头**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

## 2. 认证接口

### 2.1 用户注册

```
POST /api/auth/register
```

**请求体**:
```json
{
  "username": "string (3-50 字符)",
  "email": "string (有效邮箱)",
  "password": "string (6-100 字符)"
}
```

**响应**:
```json
{
  "token": "jwt_token_string",
  "user": {
    "id": "user_id",
    "username": "string",
    "email": "string",
    "role": "user"
  }
}
```

### 2.2 用户登录

```
POST /api/auth/login
```

**请求体**:
```json
{
  "email": "string",
  "password": "string"
}
```

**响应**: 同注册接口

---

## 3. Agent 交互接口

### 3.1 发送消息

```
POST /api/agent/chat
```

**请求体**:
```json
{
  "message": "string (用户输入)",
  "context": { "optional": "上下文信息" }
}
```

**响应**:
```json
{
  "response": "Agent 回复内容",
  "emotion": { "type": "positive|negative|neutral", "confidence": 0.85 },
  "taskId": "task_uuid",
  "status": "completed|in_progress"
}
```

### 3.2 获取记忆统计

```
GET /api/agent/memory/stats
```

**响应**:
```json
{
  "shortTermCount": 42,
  "longTermCount": 156,
  "skillCount": 23,
  "totalMemories": 221
}
```

### 3.3 记忆整合

```
POST /api/agent/memory/consolidate
```

**响应**:
```json
{
  "success": true,
  "message": "Memory consolidated successfully"
}
```

### 3.4 获取训练状态

```
GET /api/agent/training/status
```

**响应**:
```json
{
  "rlStats": {
    "totalExperiences": 1500,
    "recentRewards": [0.8, 0.9, -0.2, 1.0],
    "specialEvents": { "total": 15, "byCategory": { "milestone": 5 } }
  },
  "monitoring": {
    "activeUsers": 12,
    "totalRequests": 5000
  }
}
```

---

## 4. 会话接口

### 4.1 创建会话

```
POST /api/conversations
```

**请求体**:
```json
{
  "title": "会话标题 (可选)"
}
```

### 4.2 获取会话列表

```
GET /api/conversations
```

### 4.3 获取会话详情

```
GET /api/conversations/:id
```

### 4.4 添加消息到会话

```
POST /api/conversations/:id/messages
```

**请求体**:
```json
{
  "content": "消息内容"
}
```

---

## 5. 开发者接口（DEVELOPER_MODE=true 时可用）

### 5.1 系统状态

```
GET /api/dev/status
```

**响应**:
```json
{
  "uptime": 86400,
  "memoryUsage": { "heapUsed": 150, "heapTotal": 200 },
  "activeUsers": 12,
  "toolStats": { "totalTools": 15, "enabledTools": 12 },
  "pluginStats": { "totalPlugins": 3, "enabledPlugins": 2 }
}
```

### 5.2 工具管理

```
GET /api/dev/tools
```
返回所有工具的状态和统计信息。

```
POST /api/dev/tools/:toolName/toggle
```
启用/禁用指定工具。

### 5.3 评估接口

```
GET /api/dev/evaluation/quality/:userId
```
获取指定用户的对话质量趋势。

```
POST /api/dev/evaluation/ab-test
```
创建 A/B 测试实验。

### 5.4 插件管理

```
GET /api/dev/plugins
```
获取所有插件状态。

```
POST /api/dev/plugins/:pluginId/:action
```
action: enable | disable | reload | uninstall

---

## 6. 监控接口

### 6.1 健康检查

```
GET /api/health
```

**响应**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00Z",
  "uptime": 86400,
  "checks": {
    "database": "connected",
    "redis": "connected",
    "memory": "ok"
  }
}
```

### 6.2 系统指标

```
GET /api/monitoring/metrics
```

**响应**:
```json
{
  "cpu": { "usage": 45.2, "cores": 4 },
  "memory": { "used": 512, "total": 2048, "percentage": 25 },
  "requests": { "total": 10000, "perSecond": 12.5, "errorRate": 0.3 },
  "sessions": { "active": 25, "total": 150 }
}
```

---

## 7. 通用错误码

| 状态码 | 说明 |
|-------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证（Token 无效或过期） |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 429 | 请求频率超限 |
| 500 | 服务器内部错误 |

**错误响应格式**:
```json
{
  "error": "错误描述信息",
  "code": "ERROR_CODE",
  "details": {}
}
```
