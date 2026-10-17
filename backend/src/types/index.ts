export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  userId: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  userId: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  subtasks: Subtask[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Subtask {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  toolName?: string;
  parameters?: Record<string, unknown>;
  result?: unknown;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  type: 'rest' | 'graphql' | 'websocket';
  endpoint?: string;
  schema?: Record<string, unknown>;
  successRate: number;
  usageCount: number;
  createdAt: Date;
}

export interface MemoryItem {
  id: string;
  userId: string;
  type: 'short' | 'long' | 'skill';
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  accessedAt: Date;
}

export interface Intent {
  name: string;
  confidence: number;
  entities: Entity[];
}

export interface Entity {
  name: string;
  value: string;
  confidence: number;
}

export interface Emotion {
  type: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export interface AgentResponse {
  content: string;
  taskId?: string;
  status?: Task['status'];
  nextSteps?: string[];
  emotion?: Emotion;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ToolCall {
  toolName: string;
  parameters: Record<string, unknown>;
  timeout?: number;
  retries?: number;
}

export interface ExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime: number;
}

export interface TrainingData {
  id: string;
  taskDescription: string;
  steps: string[];
  expectedResult: string;
  actualResult?: string;
  metrics?: Record<string, number>;
  createdAt: Date;
}

export interface EvaluationResult {
  taskId: string;
  metrics: {
    completionRate: number;
    accuracy: number;
    consistency: number;
    efficiency: number;
  };
  timestamp: Date;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: unknown;
  category: string;
  description: string;
}