import axios from 'axios';
import { humanizeAxiosError } from '../utils/errorHumanizer';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // 允许跨域请求携带 cookies
  timeout: 30000, // 30秒超时
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status;
    if (status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    (err as any).humanized = humanizeAxiosError(err);
    return Promise.reject(err);
  }
);

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

export interface Message {
  _id?: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  _id: string;
  userId: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentResponse {
  response: string;
  emotion?: { type: string; confidence: number };
  taskId?: string;
  status?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    elapsedMs: number;
  };
}

export const authAPI = {
  register: (username: string, email: string, password: string) =>
    api.post('/api/auth/register', { username, email, password }),
  
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
  
  getMe: () => api.get('/api/auth/me'),
};

export const conversationAPI = {
  getAll: () => api.get('/api/conversations'),
  
  getById: (id: string) => api.get(`/api/conversations/${id}`),
  
  create: (title?: string) => api.post('/api/conversations', { title }),
  
  addMessage: (id: string, content: string) =>
    api.post(`/api/conversations/${id}/messages`, { content }),
  
  updateTitle: (id: string, title: string) =>
    api.put(`/api/conversations/${id}`, { title }),
  
  delete: (id: string) => api.delete(`/api/conversations/${id}`),
};

export const agentAPI = {
  chat: (message: string, model?: string) => api.post('/api/agent/chat', { message, model }),
  
  getMemoryStats: () => api.get('/api/agent/memory/stats'),
  
  consolidateMemory: () => api.post('/api/agent/memory/consolidate'),
  
  summarize: (messages: Message[], model?: string) => api.post('/api/agent/summarize', { messages, model }),
};

export default api;