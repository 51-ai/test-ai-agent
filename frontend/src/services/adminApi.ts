import api from './api';

// ========== 类型定义 ==========
export interface DashboardData {
  users: { total: number; admins: number; regularUsers: number };
  conversations: { total: number; byStatus?: Record<string, number> };
  memories: { total: number; byType?: Record<string, number> };
  tasks: { total: number; byStatus?: Record<string, number>; byPriority?: Record<string, number> };
  tools: { total: number; byType?: Record<string, number> };
  audit: {
    totalEntries: number;
    byLevel?: Record<string, number>;
    byCategory?: Record<string, number>;
    byResult?: Record<string, number>;
    recentActivity?: unknown[];
    topUsers?: unknown[];
    topActions?: unknown[];
    securityAlerts?: number;
  };
  dbStatus: string;
  generatedAt: string;
}

export interface UserListResult {
  data: Array<{
    _id: string;
    username: string;
    email: string;
    role: string;
    active?: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

export interface ConversationListResult {
  data: Array<{
    _id: string;
    userId: string;
    title: string;
    messageCount?: number;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

export interface MemoryListResult {
  data: Array<{
    _id: string;
    userId: string;
    type: string;
    content: string;
    importance?: number;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

export interface TaskListResult {
  data: Array<{
    _id: string;
    userId: string;
    description: string;
    status: string;
    priority: string;
    subtasks?: unknown[];
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

export interface ToolListResult {
  data: Array<{
    _id: string;
    name: string;
    description: string;
    type: string;
    endpoint?: string;
    usageCount?: number;
    enabled?: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditLogListResult {
  data: Array<{
    _id: string;
    timestamp: string;
    level: string;
    category: string;
    action: string;
    resource: string;
    result: string;
    userId?: string;
    message?: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

// ========== Security Reports (A2 持久化报告) ==========
export type RiskLevel = 'high' | 'mid' | 'low' | 'excellent';

export interface SecurityReport {
  _id: string;
  userId: string;
  model: string;
  modelName?: string;
  provider: 'deepseek' | 'ollama' | 'openai' | 'fallback';
  prompt: string;
  customPrompt?: string;
  content: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  elapsedMs: number;
  riskLevel?: RiskLevel;
  generatedAt: string;
}

export interface SecurityReportListResponse {
  success: boolean;
  items: SecurityReport[];
  total: number;
  page: number;
  size: number;
}

// ========== API 方法 ==========
export const adminAPI = {
  // Dashboard
  getDashboard: () => api.get<DashboardData>('/api/admin/dashboard'),

  // Users
  getUsers: (params?: { page?: number; pageSize?: number; role?: string; search?: string }) =>
    api.get<UserListResult>('/api/admin/users', { params }),
  getUser: (id: string) => api.get(`/api/admin/users/${id}`),
  createUser: (data: { username: string; email: string; password: string; role?: string }) =>
    api.post('/api/admin/users', data),
  updateUser: (id: string, data: Record<string, unknown>) => api.put(`/api/admin/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/api/admin/users/${id}`),

  // Conversations
  getConversations: (params?: { page?: number; pageSize?: number; userId?: string; search?: string }) =>
    api.get<ConversationListResult>('/api/admin/conversations', { params }),
  getConversation: (id: string) => api.get(`/api/admin/conversations/${id}`),
  updateConversation: (id: string, data: Record<string, unknown>) => api.put(`/api/admin/conversations/${id}`, data),
  deleteConversation: (id: string) => api.delete(`/api/admin/conversations/${id}`),
  clearConversation: (id: string) => api.post(`/api/admin/conversations/${id}/clear`),

  // Memories
  getMemories: (params?: { page?: number; pageSize?: number; userId?: string; type?: string; search?: string }) =>
    api.get<MemoryListResult>('/api/admin/memories', { params }),
  getMemory: (id: string) => api.get(`/api/admin/memories/${id}`),
  createMemory: (data: { userId: string; type: string; content: string; metadata?: unknown }) =>
    api.post('/api/admin/memories', data),
  updateMemory: (id: string, data: Record<string, unknown>) => api.put(`/api/admin/memories/${id}`, data),
  deleteMemory: (id: string) => api.delete(`/api/admin/memories/${id}`),

  // Tasks
  getTasks: (params?: { page?: number; pageSize?: number; userId?: string; status?: string; priority?: string; search?: string }) =>
    api.get<TaskListResult>('/api/admin/tasks', { params }),
  getTask: (id: string) => api.get(`/api/admin/tasks/${id}`),
  createTask: (data: { userId: string; description: string; status?: string; priority?: string }) =>
    api.post('/api/admin/tasks', data),
  updateTask: (id: string, data: Record<string, unknown>) => api.put(`/api/admin/tasks/${id}`, data),
  deleteTask: (id: string) => api.delete(`/api/admin/tasks/${id}`),

  // Tools
  getTools: (params?: { page?: number; pageSize?: number; type?: string; search?: string }) =>
    api.get<ToolListResult>('/api/admin/tools', { params }),
  getTool: (id: string) => api.get(`/api/admin/tools/${id}`),
  createTool: (data: { name: string; description: string; type: string; endpoint?: string }) =>
    api.post('/api/admin/tools', data),
  updateTool: (id: string, data: Record<string, unknown>) => api.put(`/api/admin/tools/${id}`, data),
  deleteTool: (id: string) => api.delete(`/api/admin/tools/${id}`),

  // Audit Logs
  getAuditLogs: (params?: { page?: number; pageSize?: number; userId?: string; levels?: string; categories?: string }) =>
    api.get<AuditLogListResult>('/api/admin/audit-logs', { params }),
  getAuditSummary: () => api.get('/api/admin/audit-logs/summary'),
  getUserActivity: (userId: string) => api.get(`/api/admin/audit-logs/user/${userId}`),
  purgeAuditLogs: (days: number) => api.delete(`/api/admin/audit-logs/purge?days=${days}`),

  // ===== 系统级 API =====
  // Health
  getHealth: () => api.get('/api/health'),
  getHealthLive: () => api.get('/api/health/live'),
  getHealthReady: () => api.get('/api/health/ready'),

  // Monitoring
  getMetrics: () => api.get('/api/monitoring/metrics'),
  getMetricsReport: () => api.get('/api/monitoring/report'),

  // Agent System
  getSystemStatus: () => api.get('/api/agent-system/status'),
  getRAGStats: () => api.get('/api/agent-system/rag/documents'),
  getAlerts: () => api.get('/api/agent-system/monitoring/alerts'),
  getAgentPerformance: () => api.get('/api/agent-system/monitoring/performance'),
  getFeedback: () => api.get('/api/agent-system/feedback'),
  getIterationCycles: () => api.get('/api/agent-system/iteration/cycles'),
  getModelVersions: () => api.get('/api/agent-system/models/versions'),
  getDataGovernance: () => api.get('/api/agent-system/data-governance/stats'),
  getRLStats: () => api.get('/api/agent-system/rl/stats'),
  getEvaluationReport: () => api.get('/api/agent-system/evaluation/report'),

  // Agent API (auth)
  getAgentMemoryStats: () => api.get('/api/agent/memory/stats'),
  getAgentEvents: () => api.get('/api/agent/events'),
  getTrainingStatus: () => api.get('/api/agent/training/status'),

  // ===== AI 安全分析师 (DeepSeek) =====
  analyzeSecurity: (params: { dashboard: DashboardData | null; prompt?: string; model?: string; customApiKey?: string }) =>
    api.post<{
      success: boolean;
      content: string;
      model: string;
      provider: string;
      usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
      elapsedMs: number;
      generatedAt: string;
      reportId?: string;
    }>(
      '/api/admin/security/analyze',
      { dashboard: params.dashboard, prompt: params.prompt, model: params.model },
      {
        timeout: 120_000,
        ...(params.customApiKey ? { headers: { 'X-Deepseek-Key': params.customApiKey } } : {})
      }
    ),

  getLatestSecurityReport: () =>
    api.get<{ success: boolean; data: SecurityReport | null }>(
      '/api/admin/security/reports/latest'
    ),

  listSecurityReports: (params?: { page?: number; size?: number }) =>
    api.get<SecurityReportListResponse>('/api/admin/security/reports', { params }),

  getSecurityReport: (id: string) =>
    api.get<{ success: boolean; data: SecurityReport }>(
      `/api/admin/security/reports/${id}`
    ),

  setReportRiskLevel: (id: string, riskLevel: RiskLevel) =>
    api.post<{ success: boolean; data: SecurityReport }>(
      `/api/admin/security/reports/${id}/risk-level`,
      { riskLevel }
    ),

  npmAudit: () =>
    api.get<{
      success: boolean;
      error?: string;
      backend?: {
        stdout?: string;
        stderr?: string;
        exitCode?: number | null;
        error?: string;
        json?: any;
      };
      frontend?: {
        stdout?: string;
        stderr?: string;
        exitCode?: number | null;
        error?: string;
        json?: any;
      };
      checkedAt?: string;
    }>('/api/dev/npm-audit'),

  resetUserMfa: (userId: string) =>
    api.post<{ success: boolean }>('/api/dev/users/reset-mfa', { userId }),

  /**
   * 开发者快速登录（已移除，生产环境不暴露 dev 端点）
   */
  quickLogin: async (_kind: string, _developerKey?: string) => {
    return { data: { error: '快速登录功能已禁用，请使用标准登录流程' } };
  },
};
