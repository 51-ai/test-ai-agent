/**
 * AI能力增强模块 - AI Enhancement Module
 * 
 * 功能：
 * 1. 提示词模板管理
 * 2. 模型配置和切换
 * 3. 提示词优化建议
 * 4. 模型性能监控
 * 
 * @module core/ai-enhance
 */

import { EventEmitter } from 'events';

// ==================== 类型定义 ====================

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: Array<{ name: string; description: string; defaultValue?: string }>;
  category: string;
  tags: string[];
  version: string;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'local' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  enabled: boolean;
  priority: number;
  createdAt: number;
  updatedAt: number;
}

export interface PromptVariable {
  name: string;
  value: string;
}

export interface PromptResult {
  templateId: string;
  resolvedPrompt: string;
  variables: PromptVariable[];
  timestamp: number;
  tokenCount: number;
}

export interface ModelPerformance {
  modelId: string;
  requests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  totalTokens: number;
  avgTokens: number;
  lastUsedAt: number;
  errorRates: Record<string, number>;
}

export interface OptimizationSuggestion {
  type: 'length' | 'clarity' | 'format' | 'context' | 'tokens';
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
  score: number;
}

export interface FineTuneJob {
  id: string;
  name: string;
  modelId: string;
  status: 'pending' | 'training' | 'completed' | 'failed';
  dataset: string;
  epochs: number;
  batchSize: number;
  learningRate: number;
  createdAt: number;
  completedAt?: number;
  metrics?: FineTuneMetrics;
}

export interface FineTuneMetrics {
  trainLoss: number[];
  valLoss: number[];
  accuracy: number;
  f1Score: number;
}

// ==================== 提示词模板管理器 ====================

export class PromptTemplateManager extends EventEmitter {
  private templates: Map<string, PromptTemplate> = new Map();

  addTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
    this.emit('template:added', template);
  }

  getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByCategory(category: string): PromptTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.category === category);
  }

  updateTemplate(id: string, updates: Partial<PromptTemplate>): boolean {
    const template = this.templates.get(id);
    if (!template) return false;

    this.templates.set(id, {
      ...template,
      ...updates,
      updatedAt: Date.now()
    });
    
    this.emit('template:updated', this.templates.get(id));
    return true;
  }

  deleteTemplate(id: string): boolean {
    const success = this.templates.delete(id);
    if (success) {
      this.emit('template:deleted', id);
    }
    return success;
  }

  resolveTemplate(templateId: string, variables: PromptVariable[]): PromptResult {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    let resolvedPrompt = template.template;
    
    template.variables.forEach(variable => {
      const value = variables.find(v => v.name === variable.name)?.value || variable.defaultValue || '';
      resolvedPrompt = resolvedPrompt.replace(new RegExp(`{{${variable.name}}}`, 'g'), value);
    });

    template.usageCount++;
    this.templates.set(templateId, { ...template, updatedAt: Date.now() });

    const tokenCount = this.countTokens(resolvedPrompt);

    return {
      templateId,
      resolvedPrompt,
      variables,
      timestamp: Date.now(),
      tokenCount
    };
  }

  private countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  searchTemplates(query: string): PromptTemplate[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.templates.values()).filter(t => 
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }
}

// ==================== 模型配置管理器 ====================

export class ModelConfigManager extends EventEmitter {
  private configs: Map<string, ModelConfig> = new Map();
  private activeModelId: string | null = null;

  addConfig(config: ModelConfig): void {
    this.configs.set(config.id, config);
    
    if (config.enabled && (!this.activeModelId || config.priority > (this.getActiveConfig()?.priority || 0))) {
      this.setActiveModel(config.id);
    }
    
    this.emit('config:added', config);
  }

  getConfig(id: string): ModelConfig | undefined {
    return this.configs.get(id);
  }

  getAllConfigs(): ModelConfig[] {
    return Array.from(this.configs.values());
  }

  getActiveConfig(): ModelConfig | undefined {
    if (!this.activeModelId) return undefined;
    return this.configs.get(this.activeModelId);
  }

  setActiveModel(id: string): boolean {
    const config = this.configs.get(id);
    if (!config || !config.enabled) return false;
    
    this.activeModelId = id;
    this.emit('model:activated', config);
    return true;
  }

  updateConfig(id: string, updates: Partial<ModelConfig>): boolean {
    const config = this.configs.get(id);
    if (!config) return false;

    const updated = { ...config, ...updates, updatedAt: Date.now() };
    this.configs.set(id, updated);

    if (id === this.activeModelId && updates.enabled === false) {
      this.autoSelectActiveModel();
    }
    
    this.emit('config:updated', updated);
    return true;
  }

  deleteConfig(id: string): boolean {
    const success = this.configs.delete(id);
    if (success) {
      if (id === this.activeModelId) {
        this.autoSelectActiveModel();
      }
      this.emit('config:deleted', id);
    }
    return success;
  }

  private autoSelectActiveModel(): void {
    const enabledConfigs = Array.from(this.configs.values())
      .filter(c => c.enabled)
      .sort((a, b) => b.priority - a.priority);
    
    this.activeModelId = enabledConfigs[0]?.id || null;
  }
}

// ==================== 提示词优化器 ====================

export class PromptOptimizer {
  optimize(prompt: string): { optimizedPrompt: string; suggestions: OptimizationSuggestion[] } {
    const suggestions: OptimizationSuggestion[] = [];

    if (prompt.length > 2000) {
      suggestions.push({
        type: 'length',
        severity: 'high',
        suggestion: '提示词过长，建议精简内容或分批次处理',
        score: 0.3
      });
    } else if (prompt.length > 1000) {
      suggestions.push({
        type: 'length',
        severity: 'medium',
        suggestion: '提示词较长，考虑优化结构提高效率',
        score: 0.6
      });
    }

    if (!prompt.includes('明确')) {
      suggestions.push({
        type: 'clarity',
        severity: 'low',
        suggestion: '建议在提示词中明确说明期望的输出格式',
        score: 0.8
      });
    }

    if (!prompt.includes('步骤') && prompt.length > 500) {
      suggestions.push({
        type: 'format',
        severity: 'low',
        suggestion: '建议使用结构化格式（如编号步骤）提高可读性',
        score: 0.75
      });
    }

    const tokenCount = Math.ceil(prompt.length / 4);
    if (tokenCount > 4096) {
      suggestions.push({
        type: 'tokens',
        severity: 'high',
        suggestion: '提示词token数超过常规模型限制',
        score: 0.2
      });
    }

    let optimizedPrompt = prompt.trim();
    
    optimizedPrompt = optimizedPrompt.replace(/\s+/g, ' ');
    
    if (!optimizedPrompt.endsWith('。') && !optimizedPrompt.endsWith('?') && !optimizedPrompt.endsWith('!')) {
      optimizedPrompt += '。';
    }

    return { optimizedPrompt, suggestions };
  }

  analyze(prompt: string): {
    length: number;
    tokenCount: number;
    readingTime: number;
    complexity: 'simple' | 'medium' | 'complex';
  } {
    const length = prompt.length;
    const tokenCount = Math.ceil(length / 4);
    const readingTime = Math.ceil(length / 300);
    const complexity = length < 500 ? 'simple' : length < 2000 ? 'medium' : 'complex';

    return { length, tokenCount, readingTime, complexity };
  }
}

// ==================== 模型性能监控器 ====================

export class ModelPerformanceMonitor extends EventEmitter {
  private performances: Map<string, ModelPerformance> = new Map();

  recordRequest(modelId: string, success: boolean, responseTime: number, tokens: number): void {
    let perf = this.performances.get(modelId);
    
    if (!perf) {
      perf = {
        modelId,
        requests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        totalTokens: 0,
        avgTokens: 0,
        lastUsedAt: 0,
        errorRates: {}
      };
    }

    perf.requests++;
    perf.lastUsedAt = Date.now();

    if (success) {
      perf.successfulRequests++;
      perf.totalTokens += tokens;
      perf.avgTokens = perf.totalTokens / perf.successfulRequests;
      perf.avgResponseTime = (perf.avgResponseTime * (perf.successfulRequests - 1) + responseTime) / perf.successfulRequests;
    } else {
      perf.failedRequests++;
    }

    this.performances.set(modelId, perf);
    this.emit('performance:updated', perf);
  }

  recordError(modelId: string, errorType: string): void {
    const perf = this.performances.get(modelId);
    if (!perf) return;

    perf.errorRates[errorType] = (perf.errorRates[errorType] || 0) + 1;
    this.performances.set(modelId, perf);
  }

  getPerformance(modelId: string): ModelPerformance | undefined {
    return this.performances.get(modelId);
  }

  getAllPerformances(): ModelPerformance[] {
    return Array.from(this.performances.values());
  }

  getBestPerformingModel(): ModelPerformance | undefined {
    const performances = Array.from(this.performances.values()).filter(p => p.requests > 0);
    
    if (performances.length === 0) return undefined;

    return performances.reduce((best, current) => {
      const bestScore = (best.successfulRequests / best.requests) * (1 - best.avgResponseTime / 1000);
      const currentScore = (current.successfulRequests / current.requests) * (1 - current.avgResponseTime / 1000);
      return currentScore > bestScore ? current : best;
    });
  }

  resetPerformance(modelId: string): void {
    this.performances.delete(modelId);
  }
}

// ==================== 微调管理器 ====================

export class FineTuneManager extends EventEmitter {
  private jobs: Map<string, FineTuneJob> = new Map();

  createJob(job: FineTuneJob): void {
    this.jobs.set(job.id, job);
    this.emit('job:created', job);
  }

  getJob(id: string): FineTuneJob | undefined {
    return this.jobs.get(id);
  }

  getAllJobs(): FineTuneJob[] {
    return Array.from(this.jobs.values());
  }

  updateJobStatus(id: string, status: FineTuneJob['status'], metrics?: FineTuneMetrics): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;

    const updated: FineTuneJob = {
      ...job,
      status,
      completedAt: status === 'completed' ? Date.now() : job.completedAt,
      metrics: metrics || job.metrics
    };

    this.jobs.set(id, updated);
    this.emit('job:updated', updated);
    return true;
  }

  deleteJob(id: string): boolean {
    const success = this.jobs.delete(id);
    if (success) {
      this.emit('job:deleted', id);
    }
    return success;
  }

  simulateTraining(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'pending') return;

    this.updateJobStatus(jobId, 'training');

    const progressInterval = setInterval(() => {
      const currentJob = this.jobs.get(jobId);
      if (!currentJob || currentJob.status !== 'training') {
        clearInterval(progressInterval);
        return;
      }

      const trainLoss = Array.from({ length: 10 }, () => Math.random() * 0.5 + 0.1);
      const valLoss = Array.from({ length: 10 }, () => Math.random() * 0.6 + 0.15);
      
      this.updateJobStatus(jobId, 'completed', {
        trainLoss,
        valLoss,
        accuracy: 0.7 + Math.random() * 0.25,
        f1Score: 0.65 + Math.random() * 0.3
      });

      clearInterval(progressInterval);
    }, 1000);
  }
}

// ==================== 导出单例 ====================

export const promptTemplateManager = new PromptTemplateManager();
export const modelConfigManager = new ModelConfigManager();
export const promptOptimizer = new PromptOptimizer();
export const modelPerformanceMonitor = new ModelPerformanceMonitor();
export const fineTuneManager = new FineTuneManager();

export default {
  PromptTemplateManager,
  ModelConfigManager,
  PromptOptimizer,
  ModelPerformanceMonitor,
  FineTuneManager,
  promptTemplateManager,
  modelConfigManager,
  promptOptimizer,
  modelPerformanceMonitor,
  fineTuneManager
};
