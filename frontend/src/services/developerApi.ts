interface DevApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DeveloperStatus {
  developerMode: boolean;
  enabled: boolean;
  userId: string;
  features: {
    rag: boolean;
    rl: boolean;
    evaluation: boolean;
    dataGovernance: boolean;
    monitoring: boolean;
    continuousIteration: boolean;
  };
  limits?: {
    maxRequestsPerMinute: number;
    dataIsolation: boolean;
  };
}

export const API_BASE_URL = 'http://localhost:3000/api/dev';

// 🔒 安全修复：不再硬编码 API Key，从 localStorage 读取（开发者在登录页手动输入）
// 生产环境不暴露开发者入口，developerApi 仅用于开发/调试目的
export const getDeveloperApiKey = (): string | null => {
  return localStorage.getItem('developerKey') || null;
};

const getHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = getDeveloperApiKey();
  if (key) headers['X-Developer-Key'] = key;
  return headers;
};

export const devApi = {
  getStatus: async (): Promise<DevApiResponse<DeveloperStatus>> => {
    const response = await fetch(`${API_BASE_URL}/status`, {
      headers: getHeaders()
    });
    return response.json();
  },

  chat: async (message: string, sessionId?: string): Promise<DevApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message, sessionId })
    });
    return response.json();
  },

  getFullStatus: async (): Promise<DevApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/system/full-status`, {
      headers: getHeaders()
    });
    return response.json();
  },

  getRAGStats: async (): Promise<DevApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/rag/documents`, {
      headers: getHeaders()
    });
    return response.json();
  },

  addRAGDocument: async (content: string, metadata?: any): Promise<DevApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/rag/documents`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ content, metadata })
    });
    return response.json();
  },

  /** 文档照片识别并入库：上传 base64 图片，返回识别文本、质量评估与是否进入知识库 */
  uploadPhoto: async (imageBase64: string, fileName?: string, title?: string): Promise<DevApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/rag/photo`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ image: imageBase64, fileName, title })
    });
    return response.json();
  },

  searchRAG: async (query: string, topK?: number): Promise<DevApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/rag/search`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ query, topK })
    });
    return response.json();
  },

  getRLStats: async (): Promise<DevApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/rl/training-stats`, {
      headers: getHeaders()
    });
    return response.json();
  },

  trainRL: async (): Promise<DevApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/rl/train`, {
      method: 'POST',
      headers: getHeaders()
    });
    return response.json();
  },

  getEvaluationReport: async (): Promise<DevApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/evaluation/report`, {
      headers: getHeaders()
    });
    return response.json();
  },

  getDataGovernanceStats: async (): Promise<DevApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/data/governance/stats`, {
      headers: getHeaders()
    });
    return response.json();
  },

  getMonitoringReport: async (): Promise<DevApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/monitoring/system-report`, {
      headers: getHeaders()
    });
    return response.json();
  },

  getIterationStatus: async (): Promise<DevApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/iteration/status`, {
      headers: getHeaders()
    });
    return response.json();
  }
};
