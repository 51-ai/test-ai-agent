export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface EvaluationMetrics {
  taskCompletionRate: number;
  accuracy: number;
  recallRate: number;
  precision: number;
  f1Score: number;
  responseTime: number;
  hallucinationRate: number;
  userSatisfaction?: number;
}

export interface EvaluationResult {
  testCaseId: string;
  input: string;
  actualOutput: string;
  expectedOutput: string;
  passed: boolean;
  metrics: EvaluationMetrics;
  timestamp: Date;
  executionTime: number;
  errors?: string[];
}

export interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  variants: {
    name: string;
    percentage: number;
    config?: Record<string, unknown>;
  }[];
  startDate: Date;
  endDate?: Date;
  metrics?: string[];
}

export interface ABTestResult {
  testId: string;
  variantName: string;
  traffic: number;
  metrics: Record<string, number>;
  sampleSize: number;
  winner?: boolean;
}

export interface OnlineEvaluationData {
  conversationId: string;
  userId: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }[];
  userFeedback?: {
    rating?: number;
    comment?: string;
    wasHelpful?: boolean;
  };
  taskCompleted?: boolean;
  responseTime: number;
}

export interface EvaluationReport {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  completedAt?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  testCases: TestCase[];
  results: EvaluationResult[];
  aggregatedMetrics: EvaluationMetrics & {
    relevanceScore?: number;
    coherenceScore?: number;
    safetyScore?: number;
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
    successRate: number;
  };
  metadata?: Record<string, unknown>;
}

export interface BenchmarkSuite {
  id: string;
  name: string;
  description: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  testCases: TestCase[];
  categories: string[];
  difficultyLevels: ('easy' | 'medium' | 'hard')[];
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface DetailedEvaluationMetrics extends EvaluationMetrics {
  relevanceScore: number;
  coherenceScore: number;
  safetyScore: number;
  creativityScore?: number;
  helpfulnessScore?: number;
  clarityScore?: number;
}

export interface EvaluationBenchmark {
  suiteId: string;
  reportId: string;
  timestamp: Date;
  modelVersion: string;
  metrics: DetailedEvaluationMetrics;
  comparison?: {
    previousVersion?: string;
    improvement?: Record<string, number>;
  };
}
