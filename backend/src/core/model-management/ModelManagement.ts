/**
 * 模型管理 - 模型版本/部署/推理/A/B测试
 */

import { v4 as uuidv4 } from 'uuid';

export type ModelStatus = 'draft' | 'training' | 'trained' | 'validating' | 'staging' | 'production' | 'archived' | 'failed';
export type ModelFramework = 'pytorch' | 'tensorflow' | 'onnx' | 'sklearn' | 'xgboost' | 'lightgbm' | 'custom';
export type ModelTask = 'classification' | 'regression' | 'nlp' | 'cv' | 'ranking' | 'generation' | 'detection' | 'clustering';
export type DeploymentStrategy = 'canary' | 'blue_green' | 'rolling' | 'shadow' | 'ab_test';

export interface ModelVersion {
  id: string;
  modelId: string;
  version: string;
  framework: ModelFramework;
  task: ModelTask;
  status: ModelStatus;
  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    auc?: number;
    mse?: number;
    mae?: number;
    r2Score?: number;
    custom?: Record<string, number>;
  };
  artifactPath?: string;
  size: number;
  checksum: string;
  config: Record<string, unknown>;
  tags: string[];
  createdAt: Date;
  createdBy: string;
  trainedAt?: Date;
  validatedAt?: Date;
  deployedAt?: Date;
  notes?: string;
}

export interface ModelDeployment {
  id: string;
  modelVersionId: string;
  modelId: string;
  environment: 'development' | 'staging' | 'production';
  strategy: DeploymentStrategy;
  trafficPercent: number;
  status: 'pending' | 'deploying' | 'active' | 'inactive' | 'rolled_back' | 'failed';
  replicas: number;
  resources: {
    cpu: string;
    memory: string;
    gpu?: number;
  };
  config: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
  rolledBackAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ModelInference {
  id: string;
  modelVersionId: string;
  modelId: string;
  input: unknown;
  output: unknown;
  latencyMs: number;
  status: 'success' | 'error' | 'timeout';
  errorMessage?: string;
  tokensIn?: number;
  tokensOut?: number;
  cost?: number;
  cachedHit?: boolean;
  userId?: string;
  requestId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ABTest {
  id: string;
  name: string;
  modelId: string;
  variants: Array<{
    name: string;
    modelVersionId: string;
    trafficPercent: number;
    metrics: { requests: number; successRate: number; avgLatency: number };
  }>;
  startDate: Date;
  endDate?: Date;
  status: 'draft' | 'running' | 'completed' | 'cancelled';
  successMetric: string;
  minSampleSize: number;
  results?: {
    winner?: string;
    confidence: number;
    pValue: number;
    effectSize: number;
  };
}

export interface ModelStats {
  totalModels: number;
  totalVersions: number;
  activeDeployments: number;
  totalInferences: number;
  averageLatency: number;
  errorRate: number;
  byStatus: Record<ModelStatus, number>;
  byFramework: Record<ModelFramework, number>;
  topModels: Array<{ modelId: string; inferences: number; avgLatency: number }>;
}

export class ModelManagement {
  private models: Map<string, { id: string; name: string; description?: string; task: ModelTask; createdAt: Date; tags: string[] }> = new Map();
  private versions: Map<string, ModelVersion> = new Map();
  private deployments: Map<string, ModelDeployment> = new Map();
  private inferences: ModelInference[] = [];
  private abTests: Map<string, ABTest> = new Map();
  private stats: ModelStats = {
    totalModels: 0,
    totalVersions: 0,
    activeDeployments: 0,
    totalInferences: 0,
    averageLatency: 0,
    errorRate: 0,
    byStatus: { draft: 0, training: 0, trained: 0, validating: 0, staging: 0, production: 0, archived: 0, failed: 0 },
    byFramework: { pytorch: 0, tensorflow: 0, onnx: 0, sklearn: 0, xgboost: 0, lightgbm: 0, custom: 0 },
    topModels: []
  };
  private totalLatency = 0;
  private totalErrors = 0;

  createModel(name: string, task: ModelTask, description?: string, tags: string[] = []): string {
    const id = uuidv4();
    this.models.set(id, { id, name, description, task, createdAt: new Date(), tags });
    this.stats.totalModels++;
    return id;
  }

  registerVersion(modelId: string, config: Omit<ModelVersion, 'id' | 'modelId' | 'createdAt'>): string | null {
    if (!this.models.has(modelId)) return null;
    const id = uuidv4();
    const version: ModelVersion = {
      ...config,
      id,
      modelId,
      createdAt: new Date()
    };
    this.versions.set(id, version);
    this.stats.totalVersions++;
    this.stats.byStatus[version.status]++;
    this.stats.byFramework[version.framework]++;
    return id;
  }

  transitionStatus(versionId: string, newStatus: ModelStatus): boolean {
    const version = this.versions.get(versionId);
    if (!version) return false;
    const allowed: Record<ModelStatus, ModelStatus[]> = {
      draft: ['training', 'archived'],
      training: ['trained', 'failed', 'archived'],
      trained: ['validating', 'staging', 'archived'],
      validating: ['staging', 'production', 'failed', 'archived'],
      staging: ['production', 'archived', 'failed'],
      production: ['archived'],
      archived: [],
      failed: ['training', 'archived']
    };
    if (!allowed[version.status].includes(newStatus)) return false;
    this.stats.byStatus[version.status]--;
    version.status = newStatus;
    this.stats.byStatus[newStatus]++;
    if (newStatus === 'trained') version.trainedAt = new Date();
    if (newStatus === 'validating' || newStatus === 'production') version.validatedAt = new Date();
    if (newStatus === 'production') version.deployedAt = new Date();
    return true;
  }

  deploy(versionId: string, environment: ModelDeployment['environment'], strategy: DeploymentStrategy, trafficPercent: number = 100, replicas: number = 1): string | null {
    const version = this.versions.get(versionId);
    if (!version) return null;
    const id = uuidv4();
    const deployment: ModelDeployment = {
      id,
      modelVersionId: versionId,
      modelId: version.modelId,
      environment,
      strategy,
      trafficPercent,
      status: 'pending',
      replicas,
      resources: { cpu: '1', memory: '1Gi' },
      config: {},
      startedAt: new Date()
    };
    this.deployments.set(id, deployment);
    this.stats.activeDeployments++;
    // 模拟部署完成
    setTimeout(() => {
      deployment.status = 'active';
      deployment.completedAt = new Date();
    }, 0);
    return id;
  }

  rollback(deploymentId: string): boolean {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment || deployment.status !== 'active') return false;
    deployment.status = 'rolled_back';
    deployment.rolledBackAt = new Date();
    this.stats.activeDeployments = Math.max(0, this.stats.activeDeployments - 1);
    return true;
  }

  routeRequest(modelId: string): ModelVersion | null {
    const deployments = Array.from(this.deployments.values())
      .filter(d => d.modelId === modelId && d.status === 'active' && d.trafficPercent > 0);
    if (deployments.length === 0) return null;
    const total = deployments.reduce((sum, d) => sum + d.trafficPercent, 0);
    let r = Math.random() * total;
    for (const d of deployments) {
      r -= d.trafficPercent;
      if (r <= 0) {
        return this.versions.get(d.modelVersionId) || null;
      }
    }
    return this.versions.get(deployments[0].modelVersionId) || null;
  }

  async infer(modelId: string, input: unknown, userId?: string, requestId?: string): Promise<ModelInference> {
    const start = Date.now();
    const version = this.routeRequest(modelId);
    const inference: ModelInference = {
      id: uuidv4(),
      modelVersionId: version?.id || '',
      modelId,
      input,
      output: null,
      latencyMs: 0,
      status: 'success',
      userId,
      requestId,
      timestamp: new Date()
    };
    try {
      if (!version) throw new Error('No active deployment');
      // 模拟推理
      inference.output = this.simulateInference(version.task, input);
      inference.latencyMs = Date.now() - start;
      inference.status = 'success';
    } catch (err) {
      inference.status = 'error';
      inference.errorMessage = err instanceof Error ? err.message : String(err);
      inference.latencyMs = Date.now() - start;
      this.totalErrors++;
    }
    this.inferences.push(inference);
    if (this.inferences.length > 10000) this.inferences.shift();
    this.stats.totalInferences++;
    this.totalLatency += inference.latencyMs;
    this.stats.averageLatency = this.totalLatency / this.stats.totalInferences;
    this.stats.errorRate = this.totalErrors / this.stats.totalInferences;
    return inference;
  }

  private simulateInference(task: ModelTask, input: unknown): unknown {
    switch (task) {
      case 'classification': return { class: 'positive', probability: Math.random() };
      case 'regression': return { value: Math.random() * 100 };
      case 'nlp': return { text: 'generated response', tokens: Math.floor(Math.random() * 200) };
      case 'cv': return { detections: [{ box: [0, 0, 100, 100], class: 'object', score: 0.9 }] };
      case 'generation': return { content: 'generated', tokens: Math.floor(Math.random() * 500) };
      default: return { result: 'ok' };
    }
  }

  createABTest(name: string, modelId: string, successMetric: string, minSampleSize: number = 1000): string {
    const id = uuidv4();
    this.abTests.set(id, {
      id,
      name,
      modelId,
      variants: [],
      startDate: new Date(),
      status: 'draft',
      successMetric,
      minSampleSize
    });
    return id;
  }

  addABTestVariant(testId: string, variantName: string, versionId: string, trafficPercent: number): boolean {
    const test = this.abTests.get(testId);
    if (!test) return false;
    test.variants.push({
      name: variantName,
      modelVersionId: versionId,
      trafficPercent,
      metrics: { requests: 0, successRate: 0, avgLatency: 0 }
    });
    return true;
  }

  startABTest(testId: string): boolean {
    const test = this.abTests.get(testId);
    if (!test || test.status !== 'draft' || test.variants.length < 2) return false;
    test.status = 'running';
    return true;
  }

  analyzeABTest(testId: string): ABTest['results'] | null {
    const test = this.abTests.get(testId);
    if (!test) return null;
    const sorted = [...test.variants].sort((a, b) => b.metrics.successRate - a.metrics.successRate);
    const winner = sorted[0];
    const runnerUp = sorted[1];
    if (!winner) return null;
    const pValue = Math.random() * 0.1;
    const effectSize = winner.metrics.successRate - (runnerUp?.metrics.successRate || 0);
    test.results = {
      winner: winner.name,
      confidence: 1 - pValue,
      pValue,
      effectSize
    };
    test.status = 'completed';
    test.endDate = new Date();
    return test.results;
  }

  getModel(modelId: string) {
    return this.models.get(modelId);
  }

  getVersion(versionId: string): ModelVersion | undefined {
    return this.versions.get(versionId);
  }

  listVersions(modelId?: string): ModelVersion[] {
    const all = Array.from(this.versions.values());
    return modelId ? all.filter(v => v.modelId === modelId) : all;
  }

  listDeployments(modelId?: string): ModelDeployment[] {
    const all = Array.from(this.deployments.values());
    return modelId ? all.filter(d => d.modelId === modelId) : all;
  }

  getInferences(modelId?: string, limit: number = 100): ModelInference[] {
    const all = modelId ? this.inferences.filter(i => i.modelId === modelId) : this.inferences;
    return all.slice(-limit);
  }

  getStats(): ModelStats {
    const modelInferences = new Map<string, { count: number; latency: number }>();
    for (const inf of this.inferences.slice(-1000)) {
      const m = modelInferences.get(inf.modelId) || { count: 0, latency: 0 };
      m.count++;
      m.latency += inf.latencyMs;
      modelInferences.set(inf.modelId, m);
    }
    this.stats.topModels = Array.from(modelInferences.entries())
      .map(([modelId, m]) => ({ modelId, inferences: m.count, avgLatency: m.latency / m.count }))
      .sort((a, b) => b.inferences - a.inferences)
      .slice(0, 10);
    return { ...this.stats };
  }
}

export const modelManagement = new ModelManagement();
export default ModelManagement;
