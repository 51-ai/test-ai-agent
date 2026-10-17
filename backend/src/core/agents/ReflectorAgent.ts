/**
 * ReflectorAgent - 反思智能体
 * 
 * 核心职责：
 * - 结果分析与评估
 * - 错误诊断与纠错
 * - 改进建议生成
 * - 策略调整建议
 * 
 * 目标：自省纠错能力提升，错误修正成功率提升40%
 * 
 * @module core/agents
 */

import { ReActTemplate, ReActStep } from '../react/ReActTemplate';
import { ExecutionResult } from './ExecutorAgent';
import { TaskPlan, SubTask } from './PlannerAgent';

export interface ReflectionResult {
  id: string;
  taskId: string;
  overallOutcome: 'success' | 'partial' | 'failure';
  analysis: ReflectionAnalysis;
  corrections: Correction[];
  suggestions: ImprovementSuggestion[];
  confidence: number;
  shouldRetry: boolean;
  retryStrategy?: RetryStrategy;
  metadata: Record<string, any>;
}

export interface ReflectionAnalysis {
  goalAchievement: number;
  executionQuality: number;
  resourceEfficiency: number;
  errorPatterns: ErrorPattern[];
  successFactors: string[];
  failureFactors: string[];
  timelineAnalysis: TimelineAnalysis;
}

export interface ErrorPattern {
  type: ErrorType;
  frequency: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedSteps: number[];
  rootCause: string;
  preventionStrategy: string;
}

export type ErrorType = 
  | 'parameter_error'
  | 'tool_failure'
  | 'logic_error'
  | 'timeout'
  | 'dependency_violation'
  | 'resource_limit'
  | 'unexpected_result'
  | 'hallucination'
  | 'tool_not_found'
  | 'execution_failed'
  | 'unknown';

export interface Correction {
  type: 'retry' | 'alternative_tool' | 'parameter_adjustment' | 'strategy_change' | 'manual_intervention';
  description: string;
  targetStep: number;
  newParameters?: Record<string, any>;
  alternativeTool?: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  estimatedImpact: number;
}

export interface ImprovementSuggestion {
  category: 'planning' | 'execution' | 'tool_selection' | 'parameter_optimization' | 'workflow';
  description: string;
  rationale: string;
  expectedImprovement: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  priority: 'high' | 'medium' | 'low';
}

export interface RetryStrategy {
  type: 'full_retry' | 'partial_retry' | 'adjusted_retry' | 'alternative_path';
  modifiedPlan?: TaskPlan;
  adjustedParameters?: Record<string, any>;
  skipSteps?: number[];
  additionalSteps?: SubTask[];
  maxAttempts: number;
}

export interface TimelineAnalysis {
  totalTime: number;
  stepTimes: number[];
  bottlenecks: string[];
  parallelizableSteps: number[];
  optimizationPotential: number;
}

export class ReflectorAgent {
  private reactTemplate: ReActTemplate;
  private reflectionCounter = 0;
  private reflectionHistory: Map<string, ReflectionResult[]> = new Map();
  private errorPatternLibrary: Map<ErrorType, ErrorPatternTemplate> = new Map();

  constructor() {
    this.reactTemplate = new ReActTemplate({ language: 'zh' });
    this.initializeErrorPatternLibrary();
  }

  /**
   * 核心反思方法
   */
  reflect(
    taskId: string,
    plan: TaskPlan,
    executionResults: ExecutionResult[],
    originalGoal: string
  ): ReflectionResult {
    const startTime = Date.now();

    // 1. 分析执行结果
    const analysis = this.analyzeExecution(plan, executionResults, originalGoal);

    // 2. 识别错误模式
    const errorPatterns = this.identifyErrorPatterns(executionResults);

    // 3. 生成纠错方案
    const corrections = this.generateCorrections(errorPatterns, executionResults);

    // 4. 生成改进建议
    const suggestions = this.generateSuggestions(analysis, errorPatterns);

    // 5. 判断是否需要重试
    const shouldRetry = this.shouldRetryExecution(analysis, corrections);
    const retryStrategy = shouldRetry ? this.createRetryStrategy(plan, corrections) : undefined;

    // 6. 确定整体结果
    const overallOutcome = this.determineOutcome(analysis);

    // 7. 计算置信度
    const confidence = this.calculateConfidence(analysis, corrections);

    const result: ReflectionResult = {
      id: this.generateReflectionId(),
      taskId,
      overallOutcome,
      analysis: {
        ...analysis,
        errorPatterns
      },
      corrections,
      suggestions,
      confidence,
      shouldRetry,
      retryStrategy,
      metadata: {
        reflectionTime: Date.now() - startTime,
        resultCount: executionResults.length,
        errorCount: errorPatterns.length
      }
    };

    // 记录反思历史
    this.recordReflection(taskId, result);

    return result;
  }

  /**
   * 执行结果分析
   */
  private analyzeExecution(
    plan: TaskPlan,
    results: ExecutionResult[],
    originalGoal: string
  ): ReflectionAnalysis {
    // 目标达成度分析
    const goalAchievement = this.calculateGoalAchievement(results, originalGoal);

    // 执行质量分析
    const executionQuality = this.calculateExecutionQuality(results);

    // 资源效率分析
    const resourceEfficiency = this.calculateResourceEfficiency(results);

    // 时间线分析
    const timelineAnalysis = this.analyzeTimeline(results);

    // 成功因素识别
    const successFactors = this.identifySuccessFactors(results);

    // 失败因素识别
    const failureFactors = this.identifyFailureFactors(results);

    return {
      goalAchievement,
      executionQuality,
      resourceEfficiency,
      errorPatterns: [],
      successFactors,
      failureFactors,
      timelineAnalysis
    };
  }

  /**
   * 目标达成度计算
   */
  private calculateGoalAchievement(results: ExecutionResult[], goal: string): number {
    const goalKeywords = goal.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const successfulResults = results.filter(r => r.success);

    if (goalKeywords.length === 0) return 0;

    let matchedKeywords = 0;
    for (const result of successfulResults) {
      const outputText = result.output.toLowerCase();
      for (const keyword of goalKeywords) {
        if (outputText.includes(keyword)) {
          matchedKeywords++;
          break;
        }
      }
    }

    const keywordScore = matchedKeywords / goalKeywords.length;
    const completionScore = successfulResults.length / results.length;

    return (keywordScore * 0.6 + completionScore * 0.4);
  }

  /**
   * 执行质量计算
   */
  private calculateExecutionQuality(results: ExecutionResult[]): number {
    if (results.length === 0) return 0;

    const successRate = results.filter(r => r.success).length / results.length;
    const errorRate = results.reduce((sum, r) => sum + r.errors.length, 0) / results.length;
    const retryRate = results.reduce((sum, r) => sum + r.retryCount, 0) / results.length;

    const qualityScore = successRate * 0.5 + (1 - Math.min(1, errorRate / 3)) * 0.3 + (1 - Math.min(1, retryRate / 5)) * 0.2;

    return Math.max(0, Math.min(1, qualityScore));
  }

  /**
   * 资源效率计算
   */
  private calculateResourceEfficiency(results: ExecutionResult[]): number {
    if (results.length === 0) return 0;

    const totalTime = results.reduce((sum, r) => sum + r.executionTime, 0);
    const totalToolCalls = results.reduce((sum, r) => sum + r.toolCalls.length, 0);

    // 时间效率：期望每个任务在30秒内完成
    const expectedTime = results.length * 30000;
    const timeEfficiency = totalTime < expectedTime ? 1 : expectedTime / totalTime;

    // 工具调用效率：期望每个任务平均2次工具调用
    const expectedCalls = results.length * 2;
    const toolEfficiency = totalToolCalls <= expectedCalls ? 1 : expectedCalls / totalToolCalls;

    return (timeEfficiency * 0.6 + toolEfficiency * 0.4);
  }

  /**
   * 时间线分析
   */
  private analyzeTimeline(results: ExecutionResult[]): TimelineAnalysis {
    const stepTimes = results.map(r => r.executionTime);
    const totalTime = stepTimes.reduce((sum, t) => sum + t, 0);

    // 识别瓶颈步骤（耗时超过平均值的2倍）
    const avgTime = totalTime / results.length;
    const bottlenecks = results
      .filter(r => r.executionTime > avgTime * 2)
      .map(r => `步骤 ${r.taskId} 耗时 ${r.executionTime}ms`);

    // 识别可并行化的步骤（无依赖关系的失败步骤）
    const parallelizableSteps = results
      .filter(r => !r.success && r.errors.length === 0)
      .map((_, i) => i);

    // 计算优化潜力
    const optimizationPotential = bottlenecks.length > 0 ? 0.3 : parallelizableSteps.length > 0 ? 0.2 : 0;

    return {
      totalTime,
      stepTimes,
      bottlenecks,
      parallelizableSteps,
      optimizationPotential
    };
  }

  /**
   * 成功因素识别
   */
  private identifySuccessFactors(results: ExecutionResult[]): string[] {
    const factors: string[] = [];

    const successfulResults = results.filter(r => r.success);

    if (successfulResults.length === results.length) {
      factors.push('所有任务步骤执行成功');
    }

    if (results.every(r => r.retryCount === 0)) {
      factors.push('无需重试，执行流畅');
    }

    if (results.every(r => r.errors.length === 0)) {
      factors.push('无执行错误');
    }

    const avgTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
    if (avgTime < 20000) {
      factors.push('执行速度快，平均耗时低于20秒');
    }

    const toolUsage = results.flatMap(r => r.toolCalls.map(c => c.toolName));
    const uniqueTools = new Set(toolUsage);
    if (uniqueTools.size <= 3) {
      factors.push('工具使用精简，避免了过度调用');
    }

    return factors;
  }

  /**
   * 失败因素识别
   */
  private identifyFailureFactors(results: ExecutionResult[]): string[] {
    const factors: string[] = [];

    const failedResults = results.filter(r => !r.success);
    if (failedResults.length > 0) {
      factors.push(`${failedResults.length} 个步骤执行失败`);
    }

    const highRetryResults = results.filter(r => r.retryCount > 2);
    if (highRetryResults.length > 0) {
      factors.push(`${highRetryResults.length} 个步骤重试次数过多`);
    }

    const errorTypes = new Set(results.flatMap(r => r.errors.map(e => e.type)));
    if (errorTypes.has('parameter_error')) {
      factors.push('存在参数错误');
    }
    if (errorTypes.has('tool_failure')) {
      factors.push('存在工具调用失败');
    }
    if (errorTypes.has('timeout')) {
      factors.push('存在执行超时');
    }

    const avgTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
    if (avgTime > 60000) {
      factors.push('执行速度慢，平均耗时超过60秒');
    }

    return factors;
  }

  /**
   * 错误模式识别
   */
  private identifyErrorPatterns(results: ExecutionResult[]): ErrorPattern[] {
    const patterns: ErrorPattern[] = [];
    const errorCounts = new Map<ErrorType, { count: number; steps: number[] }>();

    // 统计错误类型
    for (const result of results) {
      for (const error of result.errors) {
        const existing = errorCounts.get(error.type) || { count: 0, steps: [] };
        existing.count++;
        existing.steps.push(results.indexOf(result));
        errorCounts.set(error.type, existing);
      }
    }

    // 生成错误模式
    for (const [type, data] of errorCounts) {
      const template = this.errorPatternLibrary.get(type);
      
      patterns.push({
        type,
        frequency: data.count,
        severity: this.determineSeverity(type, data.count),
        affectedSteps: data.steps,
        rootCause: template?.rootCause || '未知原因',
        preventionStrategy: template?.preventionStrategy || '检查执行日志'
      });
    }

    return patterns.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private determineSeverity(type: ErrorType, frequency: number): 'critical' | 'high' | 'medium' | 'low' {
    if (frequency >= 3) return 'critical';
    
    const severityMap: Record<ErrorType, 'high' | 'medium' | 'low'> = {
      'parameter_error': 'medium',
      'tool_failure': 'high',
      'logic_error': 'high',
      'timeout': 'medium',
      'dependency_violation': 'high',
      'resource_limit': 'medium',
      'unexpected_result': 'low',
      'hallucination': 'high',
      'tool_not_found': 'high',
      'execution_failed': 'high',
      'unknown': 'medium'
    };

    return severityMap[type] || 'low';
  }

  /**
   * 生成纠错方案
   */
  private generateCorrections(
    errorPatterns: ErrorPattern[],
    results: ExecutionResult[]
  ): Correction[] {
    const corrections: Correction[] = [];

    for (const pattern of errorPatterns) {
      switch (pattern.type) {
        case 'parameter_error':
          corrections.push({
            type: 'parameter_adjustment',
            description: '调整参数格式和值',
            targetStep: pattern.affectedSteps[0],
            newParameters: this.suggestParameterFix(results[pattern.affectedSteps[0]]),
            priority: 'immediate',
            estimatedImpact: 0.8
          });
          break;

        case 'tool_failure':
          corrections.push({
            type: 'alternative_tool',
            description: '使用替代工具',
            targetStep: pattern.affectedSteps[0],
            alternativeTool: this.suggestAlternativeTool(results[pattern.affectedSteps[0]]),
            priority: 'high',
            estimatedImpact: 0.7
          });
          break;

        case 'timeout':
          corrections.push({
            type: 'parameter_adjustment',
            description: '简化参数以减少执行时间',
            targetStep: pattern.affectedSteps[0],
            newParameters: { simplified: true },
            priority: 'medium',
            estimatedImpact: 0.6
          });
          break;

        case 'logic_error':
          corrections.push({
            type: 'strategy_change',
            description: '调整执行策略',
            targetStep: pattern.affectedSteps[0],
            priority: 'high',
            estimatedImpact: 0.5
          });
          break;

        case 'hallucination':
          corrections.push({
            type: 'manual_intervention',
            description: '需要人工验证结果',
            targetStep: pattern.affectedSteps[0],
            priority: 'immediate',
            estimatedImpact: 0.9
          });
          break;
      }
    }

    return corrections;
  }

  private suggestParameterFix(result: ExecutionResult): Record<string, any> {
    // 分析失败的工具调用，建议参数修正
    const failedCall = result.toolCalls.find(c => !c.success);
    if (!failedCall) return {};

    const params = failedCall.parameters;
    const fixed: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.length > 100) {
        fixed[key] = value.slice(0, 100);
      } else if (typeof value === 'number' && value > 100) {
        fixed[key] = Math.min(value, 10);
      } else {
        fixed[key] = value;
      }
    }

    return fixed;
  }

  private suggestAlternativeTool(result: ExecutionResult): string {
    // 根据失败的工具类型建议替代工具
    const failedCall = result.toolCalls.find(c => !c.success);
    if (!failedCall) return 'default_executor';

    const alternatives: Record<string, string> = {
      'web_search': 'document_tool',
      'code_executor': 'data_analysis',
      'data_analysis': 'code_executor',
      'document_tool': 'web_search',
      'cloud_service': 'default_executor'
    };

    return alternatives[failedCall.toolName] || 'default_executor';
  }

  /**
   * 生成改进建议
   */
  private generateSuggestions(
    analysis: ReflectionAnalysis,
    errorPatterns: ErrorPattern[]
  ): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];

    // 基于执行质量
    if (analysis.executionQuality < 0.7) {
      suggestions.push({
        category: 'execution',
        description: '优化执行流程，减少失败步骤',
        rationale: '当前执行质量低于70%，存在改进空间',
        expectedImprovement: 0.3,
        implementationComplexity: 'medium',
        priority: 'high'
      });
    }

    // 基于资源效率
    if (analysis.resourceEfficiency < 0.6) {
      suggestions.push({
        category: 'workflow',
        description: '优化资源使用，减少冗余工具调用',
        rationale: '资源效率较低，可通过优化工具调用策略提升',
        expectedImprovement: 0.25,
        implementationComplexity: 'low',
        priority: 'medium'
      });
    }

    // 基于时间线分析
    if (analysis.timelineAnalysis.bottlenecks.length > 0) {
      suggestions.push({
        category: 'execution',
        description: '解决执行瓶颈，优化耗时步骤',
        rationale: `发现 ${analysis.timelineAnalysis.bottlenecks.length} 个瓶颈步骤`,
        expectedImprovement: 0.2,
        implementationComplexity: 'medium',
        priority: 'high'
      });
    }

    // 基于错误模式
    for (const pattern of errorPatterns) {
      suggestions.push({
        category: 'tool_selection',
        description: pattern.preventionStrategy,
        rationale: `防止 ${pattern.type} 类型错误再次发生`,
        expectedImprovement: 0.15,
        implementationComplexity: 'low',
        priority: pattern.severity === 'critical' ? 'high' : 'medium'
      });
    }

    // 基于失败因素
    if (analysis.failureFactors.length > 2) {
      suggestions.push({
        category: 'planning',
        description: '改进任务规划，减少失败因素',
        rationale: '存在多个失败因素，需要系统性改进',
        expectedImprovement: 0.35,
        implementationComplexity: 'high',
        priority: 'high'
      });
    }

    return suggestions;
  }

  /**
   * 判断是否需要重试
   */
  private shouldRetryExecution(analysis: ReflectionAnalysis, corrections: Correction[]): boolean {
    // 目标达成度低于50%时需要重试
    if (analysis.goalAchievement < 0.5) return true;

    // 存在可立即修复的错误时需要重试
    const immediateCorrections = corrections.filter(c => c.priority === 'immediate');
    if (immediateCorrections.length > 0 && immediateCorrections.every(c => c.estimatedImpact > 0.7)) {
      return true;
    }

    // 执行质量低于60%且存在纠错方案时需要重试
    if (analysis.executionQuality < 0.6 && corrections.length > 0) {
      return true;
    }

    return false;
  }

  /**
   * 创建重试策略
   */
  private createRetryStrategy(plan: TaskPlan, corrections: Correction[]): RetryStrategy {
    // 分析需要重试的步骤
    const failedSteps = corrections.map(c => c.targetStep);
    const skipSteps = plan.subTasks
      .filter((_, i) => !failedSteps.includes(i) && corrections.every(c => c.targetStep !== i))
      .map(t => plan.subTasks.indexOf(t));

    // 生成调整后的参数
    const adjustedParameters: Record<string, any> = {};
    for (const correction of corrections) {
      if (correction.newParameters) {
        adjustedParameters[correction.targetStep] = correction.newParameters;
      }
    }

    // 判断重试类型
    const retryType = this.determineRetryType(corrections);

    return {
      type: retryType,
      skipSteps,
      adjustedParameters,
      maxAttempts: 2
    };
  }

  private determineRetryType(corrections: Correction[]): RetryStrategy['type'] {
    if (corrections.some(c => c.type === 'strategy_change')) {
      return 'alternative_path';
    }
    if (corrections.every(c => c.type === 'parameter_adjustment')) {
      return 'adjusted_retry';
    }
    if (corrections.length < 3) {
      return 'partial_retry';
    }
    return 'full_retry';
  }

  /**
   * 确定整体结果
   */
  private determineOutcome(analysis: ReflectionAnalysis): 'success' | 'partial' | 'failure' {
    if (analysis.goalAchievement >= 0.8 && analysis.executionQuality >= 0.8) {
      return 'success';
    }
    if (analysis.goalAchievement >= 0.5 || analysis.executionQuality >= 0.5) {
      return 'partial';
    }
    return 'failure';
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(analysis: ReflectionAnalysis, corrections: Correction[]): number {
    let confidence = 1.0;

    // 根据目标达成度调整
    confidence -= (1 - analysis.goalAchievement) * 0.3;

    // 根据执行质量调整
    confidence -= (1 - analysis.executionQuality) * 0.2;

    // 根据错误数量调整
    confidence -= analysis.errorPatterns.length * 0.05;

    // 根据纠错方案的可信度调整
    const avgCorrectionImpact = corrections.length > 0
      ? corrections.reduce((sum, c) => sum + c.estimatedImpact, 0) / corrections.length
      : 0;
    confidence += avgCorrectionImpact * 0.1;

    return Math.max(0.3, Math.min(1.0, confidence));
  }

  /**
   * 初始化错误模式库
   */
  private initializeErrorPatternLibrary(): void {
    this.errorPatternLibrary.set('parameter_error', {
      type: 'parameter_error',
      rootCause: '参数格式不符合工具要求或参数值超出范围',
      preventionStrategy: '在调用前验证参数格式，使用工具schema检查'
    });

    this.errorPatternLibrary.set('tool_failure', {
      type: 'tool_failure',
      rootCause: '工具服务不可用或返回异常',
      preventionStrategy: '检查工具状态，准备替代工具'
    });

    this.errorPatternLibrary.set('logic_error', {
      type: 'logic_error',
      rootCause: '执行逻辑与预期不符',
      preventionStrategy: '增加中间验证步骤，检查状态传递'
    });

    this.errorPatternLibrary.set('timeout', {
      type: 'timeout',
      rootCause: '执行时间超过限制',
      preventionStrategy: '简化参数，减少数据量，或增加超时阈值'
    });

    this.errorPatternLibrary.set('hallucination', {
      type: 'hallucination',
      rootCause: '模型生成不准确或虚构的内容',
      preventionStrategy: '增加验证步骤，使用外部数据源验证'
    });
  }

  /**
   * 记录反思历史
   */
  private recordReflection(taskId: string, result: ReflectionResult): void {
    const history = this.reflectionHistory.get(taskId) || [];
    history.push(result);
    this.reflectionHistory.set(taskId, history);
  }

  /**
   * 获取反思历史
   */
  getReflectionHistory(taskId: string): ReflectionResult[] {
    return this.reflectionHistory.get(taskId) || [];
  }

  /**
   * 生成反思ID
   */
  private generateReflectionId(): string {
    this.reflectionCounter++;
    return `reflection_${Date.now()}_${this.reflectionCounter}`;
  }

  /**
   * 生成ReAct反思步骤
   */
  generateReActReflectStep(result: ReflectionResult): ReActStep {
    const outcomeText = result.overallOutcome === 'success' ? '成功' : 
                        result.overallOutcome === 'partial' ? '部分完成' : '失败';

    return {
      thought: `反思执行结果: ${outcomeText}`,
      action: null,
      actionInput: null,
      observation: `目标达成度: ${(result.analysis.goalAchievement * 100).toFixed(0)}%，执行质量: ${(result.analysis.executionQuality * 100).toFixed(0)}%`,
      reflection: result.shouldRetry ? 
        `建议重试，置信度: ${(result.confidence * 100).toFixed(0)}%` : 
        `任务完成，置信度: ${(result.confidence * 100).toFixed(0)}%`
    };
  }

  /**
   * 生成反思摘要
   */
  summarizeReflection(result: ReflectionResult): string {
    const parts: string[] = [];

    parts.push(`任务执行结果: ${result.overallOutcome === 'success' ? '成功' : result.overallOutcome === 'partial' ? '部分完成' : '失败'}`);
    parts.push(`目标达成度: ${(result.analysis.goalAchievement * 100).toFixed(0)}%`);
    parts.push(`执行质量: ${(result.analysis.executionQuality * 100).toFixed(0)}%`);
    parts.push(`置信度: ${(result.confidence * 100).toFixed(0)}%`);

    if (result.analysis.errorPatterns.length > 0) {
      parts.push(`错误模式: ${result.analysis.errorPatterns.map(p => p.type).join(', ')}`);
    }

    if (result.corrections.length > 0) {
      parts.push(`纠错方案: ${result.corrections.length} 个`);
    }

    if (result.shouldRetry) {
      parts.push(`建议: 重试执行`);
    }

    return parts.join('\n');
  }

  /**
   * 学习错误模式（用于持续改进）
   */
  learnFromReflections(taskId: string): void {
    const history = this.getReflectionHistory(taskId);
    
    if (history.length < 3) return;

    // 分析重复出现的错误模式
    const errorFrequency = new Map<ErrorType, number>();
    for (const result of history) {
      for (const pattern of result.analysis.errorPatterns) {
        errorFrequency.set(pattern.type, (errorFrequency.get(pattern.type) || 0) + 1);
      }
    }

    // 更新错误模式库
    for (const [type, frequency] of errorFrequency) {
      if (frequency >= 2) {
        const existing = this.errorPatternLibrary.get(type);
        if (existing) {
          existing.preventionStrategy = `高频错误(${frequency}次): ${existing.preventionStrategy}`;
        }
      }
    }
  }
}

// === 辅助接口 ===

interface ErrorPatternTemplate {
  type: ErrorType;
  rootCause: string;
  preventionStrategy: string;
}

export default ReflectorAgent;