export interface FeedbackData {
  id: string;
  conversationId: string;
  userId: string;
  rating?: number;
  comment?: string;
  helpful?: boolean;
  issues?: string[];
  timestamp: Date;
  category?: 'accuracy' | 'relevance' | 'speed' | 'usability' | 'other';
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
}

export interface ModelVersion {
  id: string;
  version: string;
  name: string;
  description?: string;
  checkpointPath?: string;
  createdAt: Date;
  createdBy: string;
  isActive: boolean;
  metrics?: Record<string, number>;
  tags?: string[];
  deploymentEnv?: 'development' | 'staging' | 'production';
  rollbackable?: boolean;
  performanceScore?: number;
}

export interface TrainingJob {
  id: string;
  type: 'fine_tune' | 'rl_training' | 'full_training' | 'incremental';
  datasetId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startTime?: Date;
  endTime?: Date;
  modelVersion?: string;
  error?: string;
  config: Record<string, unknown>;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  resources?: { cpu?: number; gpu?: number; memory?: number };
  logPath?: string;
}

export interface PipelineStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  error?: string;
  dependencies?: string[];
  outputs?: Record<string, unknown>;
  duration?: number;
}

export interface IterationCycle {
  id: string;
  startDate: Date;
  endDate?: Date;
  feedbackCount: number;
  trainingJobs: string[];
  modelVersions: string[];
  status: 'collecting' | 'training' | 'evaluating' | 'deploying' | 'completed' | 'rolled_back';
  goal?: string;
  lessonsLearned?: string[];
  improvements?: Record<string, number>;
}

export interface ABTestConfig {
  id: string;
  name: string;
  description?: string;
  variants: string[];
  trafficSplit: Record<string, number>;
  startDate: Date;
  endDate?: Date;
  status: 'draft' | 'running' | 'completed' | 'paused';
  metrics: string[];
}

export interface ModelComparison {
  versionA: string;
  versionB: string;
  comparisonMetrics: Record<string, { a: number; b: number; diff: number }>;
  winner?: string;
  confidence?: number;
}

export interface ImprovementSuggestion {
  id: string;
  type: 'training_data' | 'hyperparameter' | 'model_architecture' | 'prompting';
  description: string;
  priority: 'low' | 'medium' | 'high';
  expectedImpact?: number;
  implementationCost?: number;
  status: 'suggested' | 'in_progress' | 'implemented' | 'rejected';
}

// ==================== 增强功能类型定义 ====================

// 迭代计划
export interface IterationPlan {
  id: string;
  name: string;
  description: string;
  cycleId: string;
  startDate: Date;
  endDate: Date;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  tasks: IterationTask[];
  milestones: Milestone[];
  progress: number;
  createdBy: string;
  assignees: string[];
}

export interface IterationTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  assignee?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedHours?: number;
  actualHours?: number;
  startDate?: Date;
  endDate?: Date;
  dependencies?: string[];
  subtasks?: string[];
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  targetDate: Date;
  status: 'pending' | 'achieved' | 'missed';
  criteria: string[];
}

// 自动化测试
export interface AutomatedTest {
  id: string;
  name: string;
  type: 'unit' | 'integration' | 'e2e' | 'performance' | 'regression';
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  testSuite: string;
  testCases: TestCase[];
  lastRunTime?: Date;
  lastResult?: 'passed' | 'failed';
  coverage?: number;
  duration?: number;
}

export interface TestCase {
  id: string;
  name: string;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
  logs?: string[];
}

export interface TestReport {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  duration: number;
  timestamp: Date;
  details: TestCaseResult[];
}

export interface TestCaseResult {
  testId: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

// 性能回归
export interface PerformanceMetrics {
  timestamp: Date;
  latency: { avg: number; p50: number; p95: number; p99: number };
  throughput: number;
  errorRate: number;
  resourceUsage: { cpu: number; memory: number; gpu?: number };
}

export interface PerformanceRegression {
  id: string;
  detectedAt: Date;
  metric: string;
  baselineValue: number;
  currentValue: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'detected' | 'investigating' | 'resolved' | 'false_positive';
  affectedVersions: string[];
}

// 灰度发布
export interface CanaryRelease {
  id: string;
  versionId: string;
  name: string;
  trafficPercentage: number;
  targetUsers: number;
  status: 'preparing' | 'testing' | 'promoting' | 'completed' | 'rolled_back';
  startTime?: Date;
  endTime?: Date;
  metrics: CanaryMetrics;
  rollbackPolicy: RollbackPolicy;
}

export interface CanaryMetrics {
  requestCount: number;
  errorRate: number;
  latencyIncrease: number;
  userFeedback: number;
}

export interface RollbackPolicy {
  autoRollback: boolean;
  errorThreshold: number;
  latencyThreshold: number;
  userFeedbackThreshold: number;
}

// 团队协作
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'developer' | 'reviewer' | 'viewer';
  tasks: string[];
  workload: number;
}

export interface TaskAssignment {
  id: string;
  taskId: string;
  assigneeId: string;
  assignedAt: Date;
  assignedBy: string;
  status: 'assigned' | 'accepted' | 'rejected' | 'completed';
}

export interface TeamNotification {
  id: string;
  type: 'task_assigned' | 'task_completed' | 'review_requested' | 'release_approved' | 'rollback_triggered';
  recipientId: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

// 发布审批
export interface ApprovalRequest {
  id: string;
  versionId: string;
  type: 'deployment' | 'rollback' | 'release';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requester: string;
  approvers: ApprovalInfo[];
  createdAt: Date;
  updatedAt?: Date;
  notes?: string;
}

export interface ApprovalInfo {
  approverId: string;
  approverName: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp?: Date;
  comment?: string;
}

// 迭代历史分析
export interface IterationAnalytics {
  totalCycles: number;
  completedCycles: number;
  averageCycleDuration: number;
  averageTasksPerCycle: number;
  taskCompletionRate: number;
  commonBottlenecks: string[];
  performanceTrends: PerformanceTrend[];
  teamVelocity: TeamVelocity;
  recommendations: string[];
}

export interface PerformanceTrend {
  metric: string;
  direction: 'improving' | 'declining' | 'stable';
  changePercent: number;
  dataPoints: { date: Date; value: number }[];
}

export interface TeamVelocity {
  current: number;
  previous: number;
  changePercent: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}
