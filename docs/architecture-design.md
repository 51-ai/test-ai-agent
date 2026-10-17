# AI Agent 系统设计文档

## 1. 系统架构概述

### 1.1 架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         前端层 (Frontend)                           │
│  React + TypeScript + Vite + TailwindCSS                           │
│  ┌──────────┐ ┌──────────────────┐ ┌──────────────────────────┐   │
│  │  Chat    │ │ DeveloperDashboard│ │ EvaluationDashboard     │   │
│  └────┬─────┘ └────────┬─────────┘ └────────────┬─────────────┘   │
└───────┼────────────────┼────────────────────────┼─────────────────┘
        │                │                        │
   REST API / WebSocket  │                        │
        │                │                        │
┌───────┼────────────────┼────────────────────────┼─────────────────┐
│       ▼                ▼                        ▼                  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    API Gateway Layer                         │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │  │
│  │  │  Auth    │ │ RateLimit│ │  CORS    │ │  Content      │  │  │
│  │  │  (JWT)   │ │          │ │          │ │  Moderation   │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                     Agent Core Layer                          │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │                  AgentCore.ts                         │   │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌───────────────────┐   │   │  │
│  │  │  │ Session  │ │ Dialogue │ │ UserProfile       │   │   │  │
│  │  │  │ Manager  │ │Evaluator │ │ Manager           │   │   │  │
│  │  │  └──────────┘ └──────────┘ └───────────────────┘   │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Core Modules                               │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │Perception│ │Decision  │ │Execution │ │   Memory     │  │  │
│  │  │ Module   │ │Engine    │ │ Engine   │ │   System     │  │  │
│  │  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────────┤  │  │
│  │  │• Intent  │ │• Task    │ │• Sync/   │ │• Short-term │  │  │
│  │  │  Recog.  │ │  Decomp  │ │  Async   │ │• Long-term  │  │  │
│  │  │• Entity  │ │• Priority│ │• Retry   │ │• Skill DB   │  │  │
│  │  │  Extract │ │  Sort    │ │• Timeout │ │• Vector     │  │  │
│  │  │• Emotion │ │• Dynamic │ │• Resource│ │  Store      │  │  │
│  │  │  Analysis│ │  Planning│ │  Control │ │• Importance │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │               Enhancement Modules                             │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌─────────┐ │  │
│  │  │  RL  │ │ RAG  │ │ Eval │ │Data  │ │Monitor│ │Plugins  │ │  │
│  │  │Module│ │System│ │System│ │Gov.  │ │System │ │Manager  │ │  │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └─────────┘ │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                  Data Layer                                   │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │ MongoDB  │ │  Redis   │ │ ChromaDB │ │ File Storage │  │  │
│  │  │(用户数据)│ │(缓存会话)│ │(向量存储)│ │(日志/模型)   │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心设计原则

1. **模块化**: 每个模块独立、可测试、可替换
2. **松耦合**: 通过事件总线和接口实现模块间通信
3. **可观测**: 全链路日志、指标采集、健康检查
4. **安全优先**: 输入验证、沙箱隔离、权限控制、审计追踪
5. **性能导向**: 缓存策略、异步处理、资源池化

---

## 2. 模块间通信协议

### 2.1 事件总线架构

```
Module A ──emit('event', data)──▶ EventBus ──on('event', handler)──▶ Module B
                                                          ──▶ Module C
```

### 2.2 数据交换格式标准

所有模块间通信使用统一的 JSON Schema：

```typescript
interface ModuleMessage {
  id: string;           // UUID v4
  timestamp: string;    // ISO 8601
  source: string;       // 源模块名
  target: string;       // 目标模块名
  type: string;         // 消息类型
  payload: unknown;     // 消息负载
  correlationId?: string; // 关联ID（用于请求-响应模式）
  traceId?: string;     // 分布式追踪ID
}
```

### 2.3 模块接口规范

每个核心模块必须实现标准生命周期接口：

```typescript
interface ModuleLifecycle {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: string }>;
  getStats(): Record<string, unknown>;
}
```

---

## 3. 安全架构

### 3.1 认证流程

```
Client ──POST /api/auth/login──▶ Auth Service ──验证凭据──▶ MongoDB
                                    │
                                    ▼
                              ──生成JWT Token──▶ Client
                                    │
Client ──请求 + JWT Header──▶ Auth Middleware ──验证Token──▶ Route Handler
```

### 3.2 权限模型 (RBAC)

| 角色 | 权限 |
|-----|------|
| admin | 全部权限：系统配置、用户管理、工具管理、监控查看 |
| developer | 代码执行、工具注册、配置查看、测试运行 |
| user | 聊天交互、会话管理、个人记忆查看 |

### 3.3 数据加密

- **传输层**: TLS 1.3
- **静态数据**: AES-256-GCM 加密敏感字段
- **密钥管理**: 环境变量 + 密钥轮换机制

---

## 4. 数据库设计

### 4.1 MongoDB 集合

| 集合 | 用途 | 索引 |
|-----|------|------|
| users | 用户账户 | email(unique), username |
| conversations | 对话记录 | userId, createdAt |
| memories | 记忆存储 | userId, type, accessedAt |
| tasks | 任务记录 | userId, status, createdAt |
| tools | 工具注册 | name(unique), type |

### 4.2 Redis 缓存策略

| 键模式 | 用途 | TTL |
|-------|------|-----|
| session:{userId} | 活跃会话 | 24h |
| cache:tool:{key} | 工具调用缓存 | 5min |
| rate:{userId}:{endpoint} | 限流计数 | 1min |
| lock:{resource} | 分布式锁 | 30s |

---

## 5. 模块详细设计

### 5.1 AgentCore（核心调度器）

**职责**: 协调各模块完成用户请求的全链路处理

```
processInput(userInput, userId):
  1. 内容审核 (ContentModeration)
  2. 感知处理 (PerceptionModule) → Intent + Entities + Emotion
  3. 会话管理 (SessionManager) → 上下文窗口
  4. 决策规划 (DecisionEngine) → Task + Subtasks
  5. 工具调用 (ExecutionEngine + ToolManager)
  6. 记忆存储 (MemorySystem) → 短期/长期记忆
  7. 强化学习 (RLModule) → 记录经验 + 奖励
  8. 响应生成 → AgentResponse
```

### 5.2 SessionManager（会话管理）

**职责**: 管理用户对话会话的生命周期

- 会话创建与初始化
- 多轮对话上下文窗口管理（≥10轮）
- 话题追踪与切换检测
- 会话中断与恢复（持久化到MongoDB）
- 会话过期清理

### 5.3 DialogueEvaluator（对话质量评估）

**职责**: 实时评估对话质量，提供改进建议

- 相关性评分
- 准确性评分
- 完整性评分
- 清晰度评分
- 时效性评分

### 5.4 UserProfileManager（用户画像管理）

**职责**: 构建和维护用户画像

- 语言偏好学习
- 交互风格识别
- 知识水平评估
- 兴趣话题追踪
- 情感倾向分析

---

## 6. 部署架构

```
                    ┌─────────────┐
                    │  Nginx LB   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼───┐  ┌────▼───┐  ┌────▼───┐
         │ Agent  │  │ Agent  │  │ Agent  │  ← K8s Pods (水平扩展)
         │ Pod 1  │  │ Pod 2  │  │ Pod N  │
         └────┬───┘  └────┬───┘  └────┬───┘
              │            │            │
              └────────────┼────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
    │ MongoDB │      │  Redis  │      │ChromaDB │
    │ Cluster │      │ Cluster │      │         │
    └─────────┘      └─────────┘      └─────────┘
```
