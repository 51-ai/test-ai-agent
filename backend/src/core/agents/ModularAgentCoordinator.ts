/**
 * ModularAgentCoordinator - 模块化Agent协调器
 * 
 * 核心职责：
 * - 协调四个专用Agent的工作流程
 * - 管理任务状态和进度
 * - 处理Agent间的通信
 * - 实现完整的执行闭环
 * 
 * @module core/agents
 */

import { PlannerAgent, TaskPlan, PlanningResult, SubTask } from './PlannerAgent';
import { ExecutorAgent, ExecutionResult, ExecutionContext, ToolExecutor } from './ExecutorAgent';
import { ReflectorAgent, ReflectionResult } from './ReflectorAgent';
import { ValidatorAgent, ValidationResult, ValidationContext } from './ValidatorAgent';
import { ReActTemplate, ReActStep, ReActTrace } from '../react/ReActTemplate';

export interface AgentWorkflowResult {
  taskId: string;
  originalGoal: string;
  plan: TaskPlan;
  executionResults: ExecutionResult[];
  reflectionResult: ReflectionResult;
  validationResult: ValidationResult;
  finalOutput: string;
  success: boolean;
  totalExecutionTime: number;
  reActTrace: ReActTrace;
  metadata: Record<string, any>;
}

export interface WorkflowConfig {
  maxIterations: number;
  enableAutoRetry: boolean;
  enableParallelExecution: boolean;
  timeout: number;
  tools?: ToolExecutor[];
  constraints?: string[];
  safetyRules?: string[];
  userPermissions?: string[];
}

export class ModularAgentCoordinator {
  private plannerAgent: PlannerAgent;
  private executorAgent: ExecutorAgent;
  private reflectorAgent: ReflectorAgent;
  private validatorAgent: ValidatorAgent;
  private reactTemplate: ReActTemplate;

  private workflowCounter = 0;
  private activeWorkflows: Map<string, WorkflowState> = new Map();

  constructor(config?: WorkflowConfig) {
    this.plannerAgent = new PlannerAgent();
    this.executorAgent = new ExecutorAgent(config?.tools || []);
    this.reflectorAgent = new ReflectorAgent();
    this.validatorAgent = new ValidatorAgent();
    this.reactTemplate = new ReActTemplate({ language: 'zh' });
  }

  /**
   * 执行完整的Agent工作流程
   */
  async executeWorkflow(goal: string, config: WorkflowConfig): Promise<AgentWorkflowResult> {
    const startTime = Date.now();
    const taskId = this.generateWorkflowId();
    const reActSteps: ReActStep[] = [];

    // 初始化工作流状态
    const state: WorkflowState = {
      taskId,
      goal,
      phase: 'planning',
      iteration: 0,
      startTime
    };
    this.activeWorkflows.set(taskId, state);

    try {
      // === Phase 1: Planning ===
      const planningResult = await this.executePlanning(goal, config);
      reActSteps.push(this.plannerAgent.generateReActPlanStep(goal));
      state.phase = 'execution';

      // === Phase 2: Execution ===
      const executionResults = await this.executePlan(planningResult.plan, config);
      reActSteps.push(...executionResults.flatMap(r => 
        this.executorAgent.generateReActExecuteStep(
          planningResult.plan.subTasks.find(t => t.id === r.taskId) || planningResult.plan.subTasks[0],
          {}
        )
      ));
      state.phase = 'reflection';

      // === Phase 3: Reflection ===
      const reflectionResult = this.reflectorAgent.reflect(
        taskId,
        planningResult.plan,
        executionResults,
        goal
      );
      reActSteps.push(this.reflectorAgent.generateReActReflectStep(reflectionResult));

      // === Phase 4: Retry (if needed) ===
      if (reflectionResult.shouldRetry && config.enableAutoRetry && state.iteration < config.maxIterations) {
        state.iteration++;
        const retryResults = await this.handleRetry(reflectionResult, planningResult.plan, config);
        executionResults.push(...retryResults);
      }

      // === Phase 5: Validation ===
      state.phase = 'validation';
      const validationResult = this.validatorAgent.validate({
        originalGoal: goal,
        executionResults,
        reflectionResult,
        constraints: config.constraints,
        safetyRules: config.safetyRules,
        userPermissions: config.userPermissions
      });
      reActSteps.push(this.validatorAgent.generateReActValidateStep(validationResult));

      // === Phase 6: Final Output Generation ===
      const finalOutput = this.generateFinalOutput(executionResults, validationResult);

      // 创建ReAct轨迹
      const reActTrace = this.reactTemplate.createTrace(goal, reActSteps, validationResult.approvedForOutput);

      state.phase = 'completed';
      state.endTime = Date.now();

      return {
        taskId,
        originalGoal: goal,
        plan: planningResult.plan,
        executionResults,
        reflectionResult,
        validationResult,
        finalOutput,
        success: validationResult.approvedForOutput,
        totalExecutionTime: Date.now() - startTime,
        reActTrace,
        metadata: {
          iterations: state.iteration,
          planningWarnings: planningResult.warnings,
          planningConfidence: planningResult.confidence,
          reflectionConfidence: reflectionResult.confidence,
          validationScore: validationResult.score.overall
        }
      };

    } catch (error) {
      state.phase = 'failed';
      state.error = error instanceof Error ? error.message : '未知错误';

      return {
        taskId,
        originalGoal: goal,
        plan: {} as TaskPlan,
        executionResults: [],
        reflectionResult: {} as ReflectionResult,
        validationResult: {
          overallValid: false,
          approvedForOutput: false,
          requiresManualReview: true
        } as ValidationResult,
        finalOutput: `执行失败: ${state.error}`,
        success: false,
        totalExecutionTime: Date.now() - startTime,
        reActTrace: this.reactTemplate.createTrace(goal, reActSteps, false),
        metadata: {
          error: state.error,
          phase: state.phase
        }
      };
    }
  }

  /**
   * 执行规划阶段
   */
  private async executePlanning(goal: string, config: WorkflowConfig): Promise<PlanningResult> {
    const planningContext = {
      userGoal: goal,
      availableTools: this.executorAgent.listTools(),
      constraints: config.constraints || []
    };

    return this.plannerAgent.plan(planningContext);
  }

  /**
   * 执行计划阶段
   */
  private async executePlan(plan: TaskPlan, config: WorkflowConfig): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const previousResults = new Map<string, ExecutionResult>();

    // 按依赖顺序执行任务
    while (true) {
      const nextTask = this.plannerAgent.getNextExecutableTask(plan);
      if (!nextTask) break;

      const executionContext: ExecutionContext = {
        task: nextTask,
        availableTools: new Map(),
        previousResults,
        maxRetries: config.maxIterations,
        timeout: config.timeout,
        parallelEnabled: config.enableParallelExecution
      };

      const result = await this.executorAgent.execute(executionContext);
      results.push(result);
      previousResults.set(result.taskId, result);

      // 更新任务状态
      this.plannerAgent.updateTaskStatus(plan, nextTask.id, result.success ? 'completed' : 'failed', result.output);
    }

    return results;
  }

  /**
   * 处理重试
   */
  private async handleRetry(
    reflection: ReflectionResult,
    plan: TaskPlan,
    config: WorkflowConfig
  ): Promise<ExecutionResult[]> {
    const retryResults: ExecutionResult[] = [];

    if (!reflection.retryStrategy) return retryResults;

    const strategy = reflection.retryStrategy;

    // 根据重试策略调整计划
    let modifiedPlan = plan;
    if (strategy.modifiedPlan) {
      modifiedPlan = strategy.modifiedPlan;
    }

    // 调整参数
    if (strategy.adjustedParameters) {
      for (const [taskId, params] of Object.entries(strategy.adjustedParameters)) {
        const task = modifiedPlan.subTasks.find(t => t.id === taskId);
        if (task) {
          // 应用调整后的参数
        }
      }
    }

    // 执行重试
    const retryTasks = modifiedPlan.subTasks.filter(t => 
      !strategy.skipSteps?.includes(modifiedPlan.subTasks.indexOf(t))
    );

    for (const task of retryTasks) {
      const executionContext: ExecutionContext = {
        task,
        availableTools: new Map(),
        previousResults: new Map(),
        maxRetries: strategy.maxAttempts,
        timeout: config.timeout,
        parallelEnabled: false
      };

      const result = await this.executorAgent.execute(executionContext);
      retryResults.push(result);
    }

    return retryResults;
  }

  /**
   * 生成最终输出
   */
  private generateFinalOutput(results: ExecutionResult[], validation: ValidationResult): string {
    if (!validation.approvedForOutput) {
      return `输出未通过验证，需要${validation.requiresManualReview ? '人工审查' : '修正'}。\n问题: ${validation.issues.map(i => i.description).join('; ')}`;
    }

    const outputs = results.map(r => r.output).filter(o => o.trim());
    const combinedOutput = outputs.join('\n\n');

    // 如果有可自动修复的问题，进行修复
    if (validation.issues.some(i => i.autoFixable)) {
      return this.validatorAgent.autoFixIssues(combinedOutput, validation.issues);
    }

    return combinedOutput;
  }

  /**
   * 生成工作流ID
   */
  private generateWorkflowId(): string {
    this.workflowCounter++;
    return `workflow_${Date.now()}_${this.workflowCounter}`;
  }

  /**
   * 获取工作流状态
   */
  getWorkflowState(taskId: string): WorkflowState | undefined {
    return this.activeWorkflows.get(taskId);
  }

  /**
   * 注册自定义工具
   */
  registerTool(tool: ToolExecutor): void {
    this.executorAgent.registerTool(tool);
  }

  /**
   * 获取所有工具列表
   */
  getAvailableTools(): string[] {
    return this.executorAgent.listTools();
  }

  /**
   * 获取执行统计
   */
  getExecutionStatistics(): Record<string, any> {
    return {
      toolStatistics: this.executorAgent.getToolCallStatistics(),
      activeWorkflows: this.activeWorkflows.size,
      completedWorkflows: Array.from(this.activeWorkflows.values()).filter(s => s.phase === 'completed').length
    };
  }

  /**
   * 流式执行（支持实时反馈）
   */
  async executeWorkflowStream(
    goal: string,
    config: WorkflowConfig,
    onProgress?: (phase: string, data: any) => void
  ): Promise<AgentWorkflowResult> {
    const startTime = Date.now();
    const taskId = this.generateWorkflowId();

    // Phase 1: Planning
    onProgress?.('planning', { status: 'started' });
    const planningResult = await this.executePlanning(goal, config);
    onProgress?.('planning', { status: 'completed', plan: planningResult.plan });

    // Phase 2: Execution
    onProgress?.('execution', { status: 'started', tasks: planningResult.plan.subTasks.length });
    const executionResults = await this.executePlan(planningResult.plan, config);
    onProgress?.('execution', { status: 'completed', results: executionResults.length });

    // Phase 3: Reflection
    onProgress?.('reflection', { status: 'started' });
    const reflectionResult = this.reflectorAgent.reflect(
      taskId,
      planningResult.plan,
      executionResults,
      goal
    );
    onProgress?.('reflection', { status: 'completed', outcome: reflectionResult.overallOutcome });

    // Phase 4: Validation
    onProgress?.('validation', { status: 'started' });
    const validationResult = this.validatorAgent.validate({
      originalGoal: goal,
      executionResults,
      reflectionResult
    });
    onProgress?.('validation', { status: 'completed', approved: validationResult.approvedForOutput });

    // Phase 5: Final Output
    onProgress?.('output', { status: 'started' });
    const finalOutput = this.generateFinalOutput(executionResults, validationResult);
    onProgress?.('output', { status: 'completed', output: finalOutput.slice(0, 200) });

    return {
      taskId,
      originalGoal: goal,
      plan: planningResult.plan,
      executionResults,
      reflectionResult,
      validationResult,
      finalOutput,
      success: validationResult.approvedForOutput,
      totalExecutionTime: Date.now() - startTime,
      reActTrace: this.reactTemplate.createTrace(goal, [], validationResult.approvedForOutput),
      metadata: {}
    };
  }
}

// === 辅助接口 ===

interface WorkflowState {
  taskId: string;
  goal: string;
  phase: 'planning' | 'execution' | 'reflection' | 'validation' | 'completed' | 'failed';
  iteration: number;
  startTime: number;
  endTime?: number;
  error?: string;
}

export default ModularAgentCoordinator;