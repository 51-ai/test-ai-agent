/**
 * 增强型 AI Agent 核心模块 - Enhanced Agent Core Module
 *
 * 增强特性：
 * 1. 多层次推理引擎（CoT、ReAct、ToT）
 * 2. 动态工具选择与智能路由
 * 3. 自适应决策策略
 * 4. 实时学习与自我优化
 * 5. 完善的错误处理与恢复机制
 *
 * @module core/agent-core
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ==================== 类型定义 ====================

export type ReasoningMode = 'cot' | 'react' | 'tot' | 'auto';
export type DecisionStrategy = 'greedy' | 'explorative' | 'balanced' | 'adaptive';

export interface AgentConfig {
  reasoningMode: ReasoningMode;
  decisionStrategy: DecisionStrategy;
  maxRetries: number;
  timeout: number;
  enableSelfLearning: boolean;
  enableMemoryRecall: boolean;
  confidenceThreshold: number;
}

export interface ThoughtStep {
  stepNumber: number;
  thought: string;
  reasoningType: ReasoningMode;
  confidence: number;
  alternatives?: string[];
  selectedAction?: string;
  actionResult?: any;
  reflection?: string;
  timestamp: number;
  duration: number;
}

export interface AgentState {
  sessionId: string;
  status: 'idle' | 'reasoning' | 'acting' | 'learning' | 'error';
  currentTask?: string;
  completedSteps: ThoughtStep[];
  context: Record<string, any>;
  recentResults: any[];
  performanceMetrics: {
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    averageConfidence: number;
    averageStepsPerTask: number;
  };
}

export interface AgentResult {
  success: boolean;
  output?: any;
  reasoning: ThoughtStep[];
  confidence: number;
  executionTime: number;
  metadata: Record<string, any>;
}

export interface ToolSelection {
  toolId: string;
  toolName: string;
  confidence: number;
  reasoning: string;
  estimatedTime: number;
  risk: 'low' | 'medium' | 'high';
}

// ==================== 增强型推理引擎 ====================

class ReasoningEngine extends EventEmitter {
  private mode: ReasoningMode;
  private thoughtHistory: ThoughtStep[] = [];

  constructor(mode: ReasoningMode = 'auto') {
    super();
    this.mode = mode;
  }

  async think(input: string, context: Record<string, any>): Promise<ThoughtStep> {
    const startTime = Date.now();

    let reasoningType = this.mode;
    if (this.mode === 'auto') {
      reasoningType = this.inferReasoningMode(input, context);
    }

    const thought = await this.generateThought(input, context, reasoningType);
    const confidence = await this.calculateConfidence(thought);

    const step: ThoughtStep = {
      stepNumber: this.thoughtHistory.length + 1,
      thought: thought.content,
      reasoningType,
      confidence,
      alternatives: thought.alternatives,
      timestamp: startTime,
      duration: Date.now() - startTime
    };

    this.thoughtHistory.push(step);
    this.emit('reasoning:step', step);

    return step;
  }

  private inferReasoningMode(input: string, context: Record<string, any>): ReasoningMode {
    const inputLength = input.length;
    const hasMultipleSteps = input.includes('首先') || input.includes('然后') || input.includes('最后');
    const hasBranching = input.includes('如果') || input.includes('或者') || input.includes('否则');
    const hasComplexity = context.tools?.length > 3 || context.memory?.length > 5;

    if (inputLength > 500 || hasComplexity) {
      return 'tot'; // Tree of Thoughts for complex tasks
    } else if (hasMultipleSteps || hasBranching) {
      return 'react'; // ReAct for multi-step tasks
    } else if (inputLength > 100) {
      return 'cot'; // Chain of Thought for medium tasks
    }
    return 'cot';
  }

  private async generateThought(
    input: string,
    context: Record<string, any>,
    mode: ReasoningMode
  ): Promise<{ content: string; alternatives: string[] }> {
    // 模拟 LLM 生成思维
    const templates = this.getReasoningTemplates(mode);

    const mainThought = this.applyTemplate(templates.main, { input, context });
    const alternatives = templates.alternatives.map((alt: string) =>
      this.applyTemplate(alt, { input, context })
    );

    return { content: mainThought, alternatives };
  }

  private getReasoningTemplates(mode: ReasoningMode) {
    const templates = {
      cot: {
        main: '分析问题：{input}\n已知信息：{context}\n推理步骤：\n1. 理解任务目标\n2. 分析可用资源\n3. 制定执行计划\n4. 执行并验证结果',
        alternatives: [
          '采用直接方法解决问题',
          '尝试分步解决'
        ]
      },
      react: {
        main: '任务：{input}\n思考：我需要先理解问题，然后选择合适的工具来执行。\n行动：检查可用的工具并选择最优方案\n观察：分析工具返回的结果\n反思：评估结果是否满足需求',
        alternatives: [
          '快速响应模式',
          '深度分析模式'
        ]
      },
      tot: {
        main: '探索多个可能的解决方案：\n1. 方案A：{input} - 优点/缺点分析\n2. 方案B：替代方案\n3. 方案C：创造性方案\n选择最优方案并执行',
        alternatives: [
          '激进方案：直接行动',
          '保守方案：逐步验证'
        ]
      }
    };

    const modeKey = mode === 'auto' ? 'cot' : mode;
    return templates[modeKey as keyof typeof templates] || templates.cot;
  }

  private applyTemplate(template: string, data: { input: string; context: any }): string {
    return template.replace('{input}', data.input).replace('{context}', JSON.stringify(data.context));
  }

  private async calculateConfidence(thought: { content: string; alternatives: string[] }): Promise<number> {
    let confidence = 0.7;

    if (thought.content.length > 50) confidence += 0.1;
    if (thought.alternatives.length > 0) confidence += 0.1;
    if (thought.content.includes('验证') || thought.content.includes('检查')) confidence += 0.1;

    return Math.min(confidence, 0.99);
  }

  reflect(result: any, expected?: any): string {
    const reflection = this.analyzeResult(result, expected);
    if (this.thoughtHistory.length > 0) {
      this.thoughtHistory[this.thoughtHistory.length - 1].reflection = reflection;
    }
    return reflection;
  }

  private analyzeResult(result: any, expected?: any): string {
    if (!result) return '结果为空，需要重新分析';

    const isSuccess = expected ? this.compareResults(result, expected) : true;
    const quality = this.assessResultQuality(result);

    if (isSuccess && quality > 0.8) {
      return `✓ 成功完成任务，质量评分：${quality.toFixed(2)}`;
    } else if (isSuccess) {
      return `⚠ 完成任务但质量有待提升，质量评分：${quality.toFixed(2)}`;
    } else {
      return `✗ 结果不符合预期，需要调整策略`;
    }
  }

  private compareResults(result: any, expected: any): boolean {
    if (typeof result !== typeof expected) return false;
    if (typeof result === 'string') return result.includes(expected);
    if (typeof result === 'object') return JSON.stringify(result) === JSON.stringify(expected);
    return result === expected;
  }

  private assessResultQuality(result: any): number {
    if (!result) return 0;
    if (typeof result === 'string' && result.length > 0) return 0.8;
    if (typeof result === 'object' && Object.keys(result).length > 0) return 0.85;
    return 0.7;
  }

  clear(): void {
    this.thoughtHistory = [];
  }

  getHistory(): ThoughtStep[] {
    return [...this.thoughtHistory];
  }
}

// ==================== 智能工具路由器 ====================

class IntelligentToolRouter extends EventEmitter {
  private toolRegistry: Map<string, any> = new Map();
  private usageHistory: Map<string, { success: number; total: number }> = new Map();

  registerTool(tool: any): void {
    this.toolRegistry.set(tool.id || tool.name, tool);
    this.usageHistory.set(tool.id || tool.name, { success: 0, total: 0 });
  }

  async selectTools(task: string, context: Record<string, any>): Promise<ToolSelection[]> {
    const candidates: ToolSelection[] = [];

    for (const [toolId, tool] of this.toolRegistry.entries()) {
      const score = await this.calculateToolScore(tool, task, context);
      const usage = this.usageHistory.get(toolId) || { success: 0, total: 0 };
      const successRate = usage.total > 0 ? usage.success / usage.total : 0.5;

      candidates.push({
        toolId,
        toolName: tool.name,
        confidence: score * successRate,
        reasoning: `基于任务匹配度(${score.toFixed(2)})和历史成功率(${successRate.toFixed(2)})`,
        estimatedTime: tool.estimatedTime || 1000,
        risk: this.assessRisk(tool, context)
      });
    }

    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates.slice(0, 5);
  }

  private async calculateToolScore(tool: any, task: string, context: Record<string, any>): Promise<number> {
    let score = 0.5;

    // 名称匹配
    if (tool.name.includes(task.substring(0, Math.min(10, task.length)))) {
      score += 0.3;
    }

    // 描述匹配
    if (tool.description && tool.description.includes(this.extractKeywords(task))) {
      score += 0.2;
    }

    // 上下文相关性
    if (context.requiredTools?.includes(tool.id)) {
      score += 0.3;
    }

    return Math.min(score, 1);
  }

  private extractKeywords(text: string): string {
    const stopWords = ['的', '了', '在', '是', '我', '你', '他', '请', '帮', '一下'];
    return text.split(/[\s,\u4e00-\u9fa5]+/)
      .filter(word => word.length > 1 && !stopWords.includes(word))
      .slice(0, 5)
      .join(' ');
  }

  private assessRisk(tool: any, context: Record<string, any>): 'low' | 'medium' | 'high' {
    if (tool.risk === 'high' || context.isProduction) return 'high';
    if (tool.risk === 'medium') return 'medium';
    return 'low';
  }

  recordUsage(toolId: string, success: boolean): void {
    const usage = this.usageHistory.get(toolId);
    if (usage) {
      usage.total++;
      if (success) usage.success++;
    }
  }

  getToolPerformance(): Map<string, { successRate: number; total: number }> {
    const performance = new Map();
    for (const [toolId, usage] of this.usageHistory.entries()) {
      performance.set(toolId, {
        successRate: usage.total > 0 ? usage.success / usage.total : 0,
        total: usage.total
      });
    }
    return performance;
  }
}

// ==================== 自适应决策引擎 ====================

class AdaptiveDecisionEngine extends EventEmitter {
  private strategy: DecisionStrategy;
  private performanceHistory: { strategy: DecisionStrategy; success: boolean }[] = [];

  constructor(strategy: DecisionStrategy = 'balanced') {
    super();
    this.strategy = strategy;
  }

  async decide(options: { action: string; expectedOutcome: any }[], context: Record<string, any>): Promise<{
    selectedAction: string;
    reasoning: string;
    confidence: number;
  }> {
    const evaluated = await Promise.all(
      options.map(async opt => ({
        ...opt,
        score: await this.evaluateOption(opt, context),
        reasoning: await this.generateReasoning(opt, context)
      }))
    );

    evaluated.sort((a, b) => b.score - a.score);

    const selected = evaluated[0];
    this.recordDecision(selected.action, context);

    return {
      selectedAction: selected.action,
      reasoning: selected.reasoning,
      confidence: selected.score
    };
  }

  private async evaluateOption(option: { action: string; expectedOutcome: any }, context: Record<string, any>): Promise<number> {
    let score = 0.5;

    switch (this.strategy) {
      case 'greedy':
        score = option.expectedOutcome?.value ? 0.9 : 0.3;
        break;
      case 'explorative':
        score = 0.5 + Math.random() * 0.3;
        break;
      case 'balanced':
        const history = this.getHistoricalPerformance(option.action);
        score = 0.4 + history * 0.4 + Math.random() * 0.2;
        break;
      case 'adaptive':
        score = await this.calculateAdaptiveScore(option, context);
        break;
    }

    return Math.min(score, 0.99);
  }

  private calculateAdaptiveScore(option: any, context: Record<string, any>): Promise<number> {
    return Promise.resolve(0.5);
  }

  private async generateReasoning(option: any, context: Record<string, any>): Promise<string> {
    return `基于${this.strategy}策略，选择"${option.action}"，预期结果：${JSON.stringify(option.expectedOutcome)}`;
  }

  private getHistoricalPerformance(action: string): number {
    const history = this.performanceHistory.filter(h => h.strategy === this.strategy);
    if (history.length === 0) return 0.5;
    const successes = history.filter(h => h.success).length;
    return successes / history.length;
  }

  private recordDecision(action: string, context: Record<string, any>): void {
    this.performanceHistory.push({
      strategy: this.strategy,
      success: false // Will be updated later
    });

    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-100);
    }
  }

  updateDecisionOutcome(success: boolean): void {
    if (this.performanceHistory.length > 0) {
      this.performanceHistory[this.performanceHistory.length - 1].success = success;
    }
  }

  setStrategy(strategy: DecisionStrategy): void {
    this.strategy = strategy;
    this.emit('strategy:changed', strategy);
  }

  getStrategy(): DecisionStrategy {
    return this.strategy;
  }
}

// ==================== 增强型 Agent 主类 ====================

export class EnhancedAgent extends EventEmitter {
  private config: AgentConfig;
  private state: AgentState;
  private reasoningEngine: ReasoningEngine;
  private toolRouter: IntelligentToolRouter;
  private decisionEngine: AdaptiveDecisionEngine;

  constructor(config: Partial<AgentConfig> = {}) {
    super();

    this.config = {
      reasoningMode: config.reasoningMode || 'auto',
      decisionStrategy: config.decisionStrategy || 'balanced',
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 30000,
      enableSelfLearning: config.enableSelfLearning ?? true,
      enableMemoryRecall: config.enableMemoryRecall ?? true,
      confidenceThreshold: config.confidenceThreshold || 0.7
    };

    this.state = this.createInitialState();
    this.reasoningEngine = new ReasoningEngine(this.config.reasoningMode);
    this.toolRouter = new IntelligentToolRouter();
    this.decisionEngine = new AdaptiveDecisionEngine(this.config.decisionStrategy);

    this.setupEventHandlers();
  }

  private createInitialState(): AgentState {
    return {
      sessionId: uuidv4(),
      status: 'idle',
      completedSteps: [],
      context: {},
      recentResults: [],
      performanceMetrics: {
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 0,
        averageConfidence: 0,
        averageStepsPerTask: 0
      }
    };
  }

  private setupEventHandlers(): void {
    this.reasoningEngine.on('reasoning:step', (step: ThoughtStep) => {
      this.state.completedSteps.push(step);
      this.emit('agent:reasoning', step);
    });

    this.decisionEngine.on('strategy:changed', (strategy: DecisionStrategy) => {
      this.config.decisionStrategy = strategy;
      this.emit('agent:strategy:changed', strategy);
    });
  }

  async execute(input: string, context: Record<string, any> = {}): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      this.state.status = 'reasoning';
      this.state.currentTask = input;
      this.state.context = context;
      this.emit('agent:start', { input, sessionId: this.state.sessionId });

      const reasoningSteps: ThoughtStep[] = [];
      let attempts = 0;
      let bestResult: any;
      let bestConfidence = 0;

      while (attempts < this.config.maxRetries) {
        try {
          this.state.status = 'reasoning';

          const thought = await this.reasonWithTimeout(input, context);
          reasoningSteps.push(thought);

          const toolSelections = await this.toolRouter.selectTools(input, context);

          if (toolSelections.length > 0) {
            this.state.status = 'acting';

            const action = await this.decisionEngine.decide(
              toolSelections.map(t => ({
                action: t.toolId,
                expectedOutcome: { value: t.confidence }
              })),
              context
            );

            const result = await this.executeTool(action.selectedAction, context);

            const reflection = this.reasoningEngine.reflect(result);
            this.decisionEngine.updateDecisionOutcome(true);

            if (thought.confidence > bestConfidence) {
              bestConfidence = thought.confidence;
              bestResult = result;
            }

            if (thought.confidence >= this.config.confidenceThreshold) {
              break;
            }
          } else {
            bestResult = await this.generateDirectResponse(input, context);
            break;
          }
        } catch (error) {
          this.decisionEngine.updateDecisionOutcome(false);
          attempts++;
          this.emit('agent:retry', { attempts, error });
        }
      }

      this.state.status = 'learning';
      if (this.config.enableSelfLearning) {
        await this.learnFromResult(bestResult, reasoningSteps);
      }

      this.updatePerformanceMetrics(true);

      this.state.status = 'idle';
      this.emit('agent:complete', bestResult);

      return {
        success: true,
        output: bestResult,
        reasoning: reasoningSteps,
        confidence: bestConfidence,
        executionTime: Date.now() - startTime,
        metadata: {
          attempts,
          steps: reasoningSteps.length,
          sessionId: this.state.sessionId
        }
      };

    } catch (error) {
      this.state.status = 'error';
      this.updatePerformanceMetrics(false);
      this.emit('agent:error', error);

      return {
        success: false,
        reasoning: this.state.completedSteps,
        confidence: 0,
        executionTime: Date.now() - startTime,
        metadata: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  private async reasonWithTimeout(input: string, context: Record<string, any>): Promise<ThoughtStep> {
    return Promise.race([
      this.reasoningEngine.think(input, context),
      new Promise<ThoughtStep>((_, reject) =>
        setTimeout(() => reject(new Error('推理超时')), this.config.timeout)
      )
    ]);
  }

  private async executeTool(toolId: string, context: Record<string, any>): Promise<any> {
    const tool = this.toolRouter['toolRegistry'].get(toolId);
    if (!tool) {
      throw new Error(`工具不存在: ${toolId}`);
    }

    try {
      const result = await tool.execute(context);
      this.toolRouter.recordUsage(toolId, true);
      this.state.recentResults.push({ toolId, result, timestamp: Date.now() });

      if (this.state.recentResults.length > 10) {
        this.state.recentResults = this.state.recentResults.slice(-10);
      }

      return result;
    } catch (error) {
      this.toolRouter.recordUsage(toolId, false);
      throw error;
    }
  }

  private async generateDirectResponse(input: string, context: Record<string, any>): Promise<string> {
    // 模拟直接生成响应
    return `处理任务: ${input.substring(0, 50)}... [模拟响应结果]`;
  }

  private async learnFromResult(result: any, reasoningSteps: ThoughtStep[]): Promise<void> {
    const avgConfidence = reasoningSteps.reduce((sum, step) => sum + step.confidence, 0) / reasoningSteps.length;

    this.emit('agent:learned', {
      result,
      reasoningSteps,
      averageConfidence: avgConfidence,
      timestamp: Date.now()
    });
  }

  private updatePerformanceMetrics(success: boolean): void {
    this.state.performanceMetrics.totalTasks++;

    if (success) {
      this.state.performanceMetrics.successfulTasks++;
    } else {
      this.state.performanceMetrics.failedTasks++;
    }

    const total = this.state.performanceMetrics.totalTasks;
    const successRate = this.state.performanceMetrics.successfulTasks / total;
    this.state.performanceMetrics.averageConfidence =
      (this.state.performanceMetrics.averageConfidence * (total - 1) +
        this.state.completedSteps[this.state.completedSteps.length - 1]?.confidence || 0) / total;

    this.state.performanceMetrics.averageStepsPerTask =
      (this.state.performanceMetrics.averageStepsPerTask * (total - 1) +
        this.state.completedSteps.length) / total;

    this.emit('agent:metrics:updated', this.state.performanceMetrics);
  }

  registerTool(tool: any): void {
    this.toolRouter.registerTool(tool);
  }

  setReasoningMode(mode: ReasoningMode): void {
    this.config.reasoningMode = mode;
  }

  setDecisionStrategy(strategy: DecisionStrategy): void {
    this.decisionEngine.setStrategy(strategy);
  }

  getState(): AgentState {
    return { ...this.state };
  }

  getPerformanceMetrics() {
    return { ...this.state.performanceMetrics };
  }

  reset(): void {
    this.state = this.createInitialState();
    this.reasoningEngine.clear();
    this.emit('agent:reset');
  }
}

// ==================== 导出 ====================

export const enhancedAgent = new EnhancedAgent();

export default {
  EnhancedAgent,
  ReasoningEngine,
  IntelligentToolRouter,
  AdaptiveDecisionEngine,
  enhancedAgent
};
