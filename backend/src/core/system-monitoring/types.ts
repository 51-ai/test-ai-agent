export interface Metric {
  id?: string;
  name: string;
  value: number;
  unit?: string;
  timestamp: Date | number;
  success?: boolean;
  metadata?: Record<string, unknown>;
}

export interface Alert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  metric?: Metric;
  threshold?: number;
  triggeredAt: Date;
  acknowledged?: boolean;
  acknowledgedAt?: Date;
  resolved?: boolean;
  resolvedAt?: Date;
}

export interface PerformanceMetrics {
  latency: {
    p50: number;
    p95: number;
    p99: number;
    average: number;
    max: number;
  };
  throughput: number;
  errorRate: number;
  successRate: number;
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface BehaviorMetrics {
  totalConversations: number;
  totalMessages: number;
  averageMessagesPerConversation: number;
  toolCalls: number;
  hallucinationRate: number;
  userSatisfaction: number;
  taskCompletionRate: number;
  avgResponseTime?: number;
  responseQuality?: number;
  taskCompletion?: number;
}

export interface AlertRule {
  id: string;
  metricName: string;
  condition: 'above' | 'below';
  threshold: number;
  level: Alert['level'];
  message: string;
  cooldownMinutes: number;
  enabled: boolean;
  lastTriggered?: Date;
}

export interface ResourceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage?: number;
  networkIn?: number;
  networkOut?: number;
  activeConnections?: number;
}

export interface QualityMetrics {
  relevanceScore: number;
  coherenceScore: number;
  safetyScore: number;
  hallucinationRate: number;
  userSatisfaction: number;
  responseQuality: number;
}

export interface SystemHealth {
  overallStatus: 'healthy' | 'warning' | 'critical' | 'degraded';
  uptime: number;
  lastRestart?: Date;
  componentStatuses: Record<string, 'healthy' | 'unhealthy' | 'unknown'>;
}

export interface TrafficMetrics {
  requestsPerMinute: number;
  concurrentUsers: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
}

export interface ComprehensiveMetrics {
  performance: PerformanceMetrics;
  behavior: BehaviorMetrics;
  resource: ResourceMetrics;
  quality: QualityMetrics;
  traffic: TrafficMetrics;
  health: SystemHealth;
  timestamp: Date;
}
