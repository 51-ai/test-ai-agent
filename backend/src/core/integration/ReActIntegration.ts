/**
 * ReAct集成模块
 * 
 * 将ReAct结构化提示词模板和模块化Agent系统集成到Agent核心流程
 * 
 * 核心目标：
 * - 工具调用准确率提升50%
 * - 格式错误率降低80%
 * - 任务完成率提升40%
 * - 死循环率降低90%
 * 
 * @module core/integration
 */

import { ReActTemplate, ReActStep, ReActTrace } from '../react/ReActTemplate';
import { 
  ModularAgentCoordinator, 
  AgentWorkflowResult, 
  WorkflowConfig 
} from '../agents';
import { TaskPlan, SubTask } from '../agents/PlannerAgent';
import { ExecutionResult } from '../agents/ExecutorAgent';
import { ReflectionResult } from '../agents/ReflectorAgent';
import { ValidationResult } from '../agents/ValidatorAgent';

export interface ReActIntegrationConfig {
  enabled: boolean;
  maxIterations: number;
  enableAutoRetry: boolean;
  enableParallelExecution: boolean;
  timeout: number;
  language: 'zh' | 'en';
}

export interface ReActExecutionResult {
  success: boolean;
  output: string;
  trace: ReActTrace;
  workflowResult?: AgentWorkflowResult;
  steps: ReActStep[];
  metadata: {
    totalSteps: number;
    toolCalls: number;
    executionTime: number;
    iterations: number;
    confidence: number;
  };
}

export class ReActIntegration {
  private reactTemplate: ReActTemplate;
  private modularCoordinator: ModularAgentCoordinator;
  private config: ReActIntegrationConfig;
  private executionHistory: Map<string, ReActExecutionResult[]> = new Map();

  constructor(config?: Partial<ReActIntegrationConfig>) {
    this.config = {
      enabled: true,
      maxIterations: 10,
      enableAutoRetry: true,
      enableParallelExecution: true,
      timeout: 60000,
      language: 'zh',
      ...config
    };

    this.reactTemplate = new ReActTemplate({
      maxIterations: this.config.maxIterations,
      language: this.config.language
    });

    this.modularCoordinator = new ModularAgentCoordinator({
      maxIterations: this.config.maxIterations,
      enableAutoRetry: this.config.enableAutoRetry,
      enableParallelExecution: this.config.enableParallelExecution,
      timeout: this.config.timeout
    });
  }

  /**
   * 执行ReAct流程
   */
  async execute(goal: string, context?: string): Promise<ReActExecutionResult> {
    const startTime = Date.now();
    const steps: ReActStep[] = [];

    if (!this.config.enabled) {
      // 如果ReAct未启用，返回简单结果
      return {
        success: true,
        output: `直接执行: ${goal}`,
        trace: this.reactTemplate.createTrace(goal, [], true),
        steps,
        metadata: {
          totalSteps: 0,
          toolCalls: 0,
          executionTime: Date.now() - startTime,
          iterations: 0,
          confidence: 0.5
        }
      };
    }

    try {
      // 1. 生成ReAct提示词
      const prompt = this.reactTemplate.generatePrompt(goal, context);

      // 2. 执行模块化Agent工作流
      const workflowResult = await this.modularCoordinator.executeWorkflow(goal, {
        maxIterations: this.config.maxIterations,
        enableAutoRetry: this.config.enableAutoRetry,
        enableParallelExecution: this.config.enableParallelExecution,
        timeout: this.config.timeout
      });

      // 3. 从工作流结果中提取ReAct步骤
      steps.push(...workflowResult.reActTrace.steps);

      // 4. 创建执行轨迹
      const trace = this.reactTemplate.createTrace(
        goal,
        steps,
        workflowResult.success
      );

      // 5. 记录执行历史
      const result: ReActExecutionResult = {
        success: workflowResult.success,
        output: workflowResult.finalOutput,
        trace,
        workflowResult,
        steps,
        metadata: {
          totalSteps: steps.length,
          toolCalls: workflowResult.reActTrace.toolCalls,
          executionTime: Date.now() - startTime,
          iterations: workflowResult.metadata.iterations,
          confidence: workflowResult.metadata.validationScore
        }
      };

      this.recordExecution(goal, result);

      return result;

    } catch (error) {
      // 错误处理
      const errorStep: ReActStep = {
        thought: '执行过程中发生错误',
        action: null,
        actionInput: null,
        observation: error instanceof Error ? error.message : '未知错误',
        reflection: '需要检查错误原因并重新执行'
      };

      steps.push(errorStep);

      return {
        success: false,
        output: `执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
        trace: this.reactTemplate.createTrace(goal, steps, false),
        steps,
        metadata: {
          totalSteps: 1,
          toolCalls: 0,
          executionTime: Date.now() - startTime,
          iterations: 0,
          confidence: 0
        }
      };
    }
  }

  /**
   * 流式执行ReAct流程
   */
  async executeStream(
    goal: string,
    context?: string,
    onStep?: (step: ReActStep) => void,
    onProgress?: (phase: string, data: any) => void
  ): Promise<ReActExecutionResult> {
    const startTime = Date.now();
    const steps: ReActStep[] = [];

    try {
      // 执行流式工作流
      const workflowResult = await this.modularCoordinator.executeWorkflowStream(
        goal,
        {
          maxIterations: this.config.maxIterations,
          enableAutoRetry: this.config.enableAutoRetry,
          enableParallelExecution: this.config.enableParallelExecution,
          timeout: this.config.timeout
        },
        (phase, data) => {
          onProgress?.(phase, data);

          // 为每个阶段生成ReAct步骤
          const phaseStep = this.generatePhaseStep(phase, data);
          if (phaseStep) {
            steps.push(phaseStep);
            onStep?.(phaseStep);
          }
        }
      );

      const trace = this.reactTemplate.createTrace(goal, steps, workflowResult.success);

      return {
        success: workflowResult.success,
        output: workflowResult.finalOutput,
        trace,
        workflowResult,
        steps,
        metadata: {
          totalSteps: steps.length,
          toolCalls: workflowResult.reActTrace.toolCalls,
          executionTime: Date.now() - startTime,
          iterations: workflowResult.metadata.iterations,
          confidence: workflowResult.metadata.validationScore
        }
      };

    } catch (error) {
      return {
        success: false,
        output: `执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
        trace: this.reactTemplate.createTrace(goal, steps, false),
        steps,
        metadata: {
          totalSteps: steps.length,
          toolCalls: 0,
          executionTime: Date.now() - startTime,
          iterations: 0,
          confidence: 0
        }
      };
    }
  }

  /**
   * 为执行阶段生成ReAct步骤
   */
  private generatePhaseStep(phase: string, data: any): ReActStep | null {
    const phaseThoughts: Record<string, string> = {
      'planning': '正在规划任务执行路径',
      'execution': '正在执行任务步骤',
      'reflection': '正在反思执行结果',
      'validation': '正在验证最终输出',
      'output': '正在生成最终输出'
    };

    const thought = phaseThoughts[phase] || `正在执行 ${phase} 阶段`;

    return {
      thought,
      action: null,
      actionInput: null,
      observation: JSON.stringify(data),
      reflection: null
    };
  }

  /**
   * 解析LLM响应为ReAct步骤
   */
  parseResponse(response: string): ReActStep[] {
    return this.reactTemplate.parseResponse(response);
  }

  /**
   * 格式化ReAct步骤为输出
   */
  formatSteps(steps: ReActStep[]): string {
    return steps.map(step => this.reactTemplate.formatStep(step)).join('\n---\n');
  }

  /**
   * 验证ReAct步骤格式
   */
  validateSteps(steps: ReActStep[]): { valid: boolean; errors: string[] } {
    const allErrors: string[] = [];

    for (const step of steps) {
      const validation = this.reactTemplate.validateStep(step);
      if (!validation.valid) {
        allErrors.push(...validation.errors);
      }
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors
    };
  }

  /**
   * 获取ReAct提示词
   */
  getPrompt(goal: string, context?: string): string {
    return this.reactTemplate.generatePrompt(goal, context);
  }

  /**
   * 记录执行历史
   */
  private recordExecution(goal: string, result: ReActExecutionResult): void {
    const history = this.executionHistory.get(goal) || [];
    history.push(result);
    this.executionHistory.set(goal, history);
  }

  /**
   * 获取执行历史
   */
  getExecutionHistory(goal: string): ReActExecutionResult[] {
    return this.executionHistory.get(goal) || [];
  }

  /**
   * 获取执行统计
   */
  getStatistics(): {
    totalExecutions: number;
    successRate: number;
    avgSteps: number;
    avgToolCalls: number;
    avgExecutionTime: number;
  } {
    const allResults = Array.from(this.executionHistory.values()).flat();
    
    if (allResults.length === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        avgSteps: 0,
        avgToolCalls: 0,
        avgExecutionTime: 0
      };
    }

    const successCount = allResults.filter(r => r.success).length;
    const totalSteps = allResults.reduce((sum, r) => sum + r.metadata.totalSteps, 0);
    const totalToolCalls = allResults.reduce((sum, r) => sum + r.metadata.toolCalls, 0);
    const totalTime = allResults.reduce((sum, r) => sum + r.metadata.executionTime, 0);

    return {
      totalExecutions: allResults.length,
      successRate: successCount / allResults.length,
      avgSteps: totalSteps / allResults.length,
      avgToolCalls: totalToolCalls / allResults.length,
      avgExecutionTime: totalTime / allResults.length
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ReActIntegrationConfig>): void {
    this.config = { ...this.config, ...config };
    
    this.reactTemplate.updateConfig({
      maxIterations: this.config.maxIterations,
      language: this.config.language
    });
  }

  /**
   * 注册自定义工具
   */
  registerTool(tool: {
    name: string;
    execute: (params: Record<string, any>) => Promise<string>;
    validateParams: (params: Record<string, any>) => boolean;
    getSchema: () => any;
  }): void {
    this.modularCoordinator.registerTool(tool);
    this.reactTemplate.addToolDescription({
      name: tool.name,
      description: tool.getSchema().description,
      parameters: tool.getSchema().parameters,
      returns: tool.getSchema().returns
    });
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): string[] {
    return this.modularCoordinator.getAvailableTools();
  }

  /**
   * 创建ReAct执行报告
   */
  createExecutionReport(result: ReActExecutionResult): string {
    const parts: string[] = [];

    parts.push('=== ReAct执行报告 ===');
    parts.push(`目标: ${result.trace.goal}`);
    parts.push(`结果: ${result.success ? '成功' : '失败'}`);
    parts.push(`总步骤: ${result.metadata.totalSteps}`);
    parts.push(`工具调用: ${result.metadata.toolCalls}`);
    parts.push(`执行时间: ${result.metadata.executionTime}ms`);
    parts.push(`迭代次数: ${result.metadata.iterations}`);
    parts.push(`置信度: ${(result.metadata.confidence * 100).toFixed(0)}%`);

    if (result.workflowResult) {
      parts.push('\n=== 详细信息 ===');
      parts.push(`规划置信度: ${(result.workflowResult.metadata.planningConfidence * 100).toFixed(0)}%`);
      parts.push(`反思置信度: ${(result.workflowResult.metadata.reflectionConfidence * 100).toFixed(0)}%`);
      parts.push(`验证分数: ${(result.workflowResult.metadata.validationScore * 100).toFixed(0)}%`);
    }

    parts.push('\n=== 执行步骤 ===');
    for (const step of result.steps) {
      parts.push(`思考: ${step.thought}`);
      if (step.action) {
        parts.push(`行动: ${step.action}`);
        parts.push(`参数: ${JSON.stringify(step.actionInput)}`);
      }
      if (step.observation) {
        parts.push(`观察: ${step.observation.slice(0, 100)}...`);
      }
      if (step.reflection) {
        parts.push(`反思: ${step.reflection}`);
      }
      parts.push('---');
    }

    parts.push('\n=== 最终输出 ===');
    parts.push(result.output);

    return parts.join('\n');
  }
}

/**
 * ReAct集成助手类
 * 提供简化的接口用于快速集成
 */
export class ReActIntegrationHelper {
  private integration: ReActIntegration;

  constructor(config?: Partial<ReActIntegrationConfig>) {
    this.integration = new ReActIntegration(config);
  }

  /**
   * 快速执行ReAct任务
   */
  async quickExecute(goal: string): Promise<string> {
    const result = await this.integration.execute(goal);
    return result.output;
  }

  /**
   * 执行并获取详细报告
   */
  async executeWithReport(goal: string): Promise<{ output: string; report: string }> {
    const result = await this.integration.execute(goal);
    return {
      output: result.output,
      report: this.integration.createExecutionReport(result)
    };
  }

  /**
   * 执行并实时反馈
   */
  async executeWithFeedback(
    goal: string,
    onFeedback: (feedback: string) => void
  ): Promise<string> {
    const result = await this.integration.executeStream(
      goal,
      undefined,
      (step) => onFeedback(`步骤: ${step.thought}`),
      (phase, data) => onFeedback(`阶段 ${phase}: ${JSON.stringify(data)}`)
    );

    return result.output;
  }

  /**
   * 获取集成实例
   */
  getIntegration(): ReActIntegration {
    return this.integration;
  }
}

export default ReActIntegration;