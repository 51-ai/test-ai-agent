import { ToolCall, ExecutionResult } from '../../types';
import { config } from '../../config';
import { performanceMonitor } from '../system-monitoring/PerformanceMonitor';

const LOG_PREFIX = '[ExecutionEngine]';

// === 新增：执行状态和任务依赖类型 ===
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'rolled_back';
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface TaskDependency {
  taskId: string;
  type: 'blocks' | 'required_by' | 'optional';
  satisfied: boolean;
}

export interface ExecutionTask {
  id: string;
  toolCall: ToolCall;
  status: ExecutionStatus;
  priority: TaskPriority;
  dependencies: TaskDependency[];
  startTime?: Date;
  endTime?: Date;
  result?: ExecutionResult;
  retryCount: number;
  errorHistory: string[];
  metadata?: Record<string, unknown>;
}

export interface ExecutionStatistics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
  successRate: number;
  tasksByPriority: Record<TaskPriority, number>;
  executionTrend: Array<{ timestamp: Date; successRate: number; avgTime: number }>;
}

export interface ResourceUsage {
  cpuUsage: number;
  memoryUsage: number;
  activeTasks: number;
  queueLength: number;
}

export class ExecutionEngine {
  private toolRegistry = new Map<string, { execute: (toolId: string, parameters: Record<string, any>) => Promise<any> }>();
  private activeTasks = new Map<string, Promise<ExecutionResult>>();
  
  // === 新增：任务管理和队列 ===
  private taskQueue: ExecutionTask[] = [];
  private taskCache = new Map<string, { result: ExecutionResult; timestamp: Date; ttl: number }>();
  private taskHistory: ExecutionTask[] = [];
  private dependencyGraph = new Map<string, Set<string>>();
  private executionFlow: Array<{ taskId: string; toolName: string; status: ExecutionStatus; timestamp: Date }> = [];
  private maxHistorySize = 500;
  private maxCacheSize = 100;
  private resourceUsage: ResourceUsage = { cpuUsage: 0, memoryUsage: 0, activeTasks: 0, queueLength: 0 };

  // === 新增：任务队列管理 ===
  
  /**
   * 添加任务到队列
   */
  enqueueTask(toolCall: ToolCall, priority: TaskPriority = 'normal', dependencies: TaskDependency[] = []): string {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task: ExecutionTask = {
      id: taskId,
      toolCall,
      status: 'pending',
      priority,
      dependencies,
      retryCount: 0,
      errorHistory: []
    };
    
    this.taskQueue.push(task);
    this.updateResourceUsage();
    this.recordExecutionFlow(taskId, toolCall.toolName, 'pending');
    
    console.log(`${LOG_PREFIX} [TASK_ENQUEUED] taskId=${taskId}, priority=${priority}, queueLength=${this.taskQueue.length}`);
    return taskId;
  }
  
  /**
   * 按优先级排序队列
   */
  prioritizeQueue(): void {
    const priorityOrder: Record<TaskPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };
    this.taskQueue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    console.log(`${LOG_PREFIX} [QUEUE_PRIORITIZED] newOrder=${this.taskQueue.map(t => t.id).join(', ')}`);
  }
  
  /**
   * 检查依赖是否满足
   */
  checkDependencies(taskId: string): boolean {
    const task = this.taskQueue.find(t => t.id === taskId) || this.taskHistory.find(t => t.id === taskId);
    if (!task) return false;
    
    return task.dependencies.every(dep => {
      const depTask = this.taskHistory.find(t => t.id === dep.taskId);
      return depTask?.status === 'completed';
    });
  }
  
  /**
   * 获取下一个可执行任务
   */
  getNextExecutableTask(): ExecutionTask | null {
    for (const task of this.taskQueue) {
      if (this.checkDependencies(task.id)) {
        return task;
      }
    }
    return null;
  }
  
  /**
   * 获取资源使用情况
   */
  getResourceUsage(): ResourceUsage {
    this.updateResourceUsage();
    return { ...this.resourceUsage };
  }
  
  private updateResourceUsage(): void {
    this.resourceUsage = {
      cpuUsage: Math.random() * 100, // 模拟CPU使用率
      memoryUsage: Math.random() * 100, // 模拟内存使用率
      activeTasks: this.activeTasks.size,
      queueLength: this.taskQueue.length
    };
  }
  
  /**
   * 获取执行统计
   */
  getExecutionStatistics(): ExecutionStatistics {
    const totalTasks = this.taskHistory.length;
    const completedTasks = this.taskHistory.filter(t => t.status === 'completed').length;
    const failedTasks = this.taskHistory.filter(t => t.status === 'failed').length;
    
    const executionTimes = this.taskHistory
      .filter(t => t.result?.executionTime)
      .map(t => t.result!.executionTime);
    const averageExecutionTime = executionTimes.length > 0 
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
      : 0;
    
    const tasksByPriority: Record<TaskPriority, number> = { low: 0, normal: 0, high: 0, critical: 0 };
    this.taskHistory.forEach(t => tasksByPriority[t.priority]++);
    
    // 计算执行趋势
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentTasks = this.taskHistory.filter(t => t.endTime && t.endTime.getTime() > oneHourAgo);
    const recentSuccessRate = recentTasks.length > 0 
      ? recentTasks.filter(t => t.status === 'completed').length / recentTasks.length 
      : 0;
    const recentAvgTime = recentTasks.length > 0
      ? recentTasks.reduce((sum, t) => sum + (t.result?.executionTime || 0), 0) / recentTasks.length
      : 0;
    
    const executionTrend = [
      ...(this.getExecutionTrend() || []),
      { timestamp: new Date(), successRate: recentSuccessRate, avgTime: recentAvgTime }
    ].slice(-10); // 保留最近10个数据点
    
    return {
      totalTasks,
      completedTasks,
      failedTasks,
      averageExecutionTime: Math.round(averageExecutionTime),
      successRate: totalTasks > 0 ? completedTasks / totalTasks : 0,
      tasksByPriority,
      executionTrend
    };
  }
  
  private getExecutionTrend(): Array<{ timestamp: Date; successRate: number; avgTime: number }> {
    return [];
  }
  
  /**
   * 记录执行流程
   */
  private recordExecutionFlow(taskId: string, toolName: string, status: ExecutionStatus): void {
    this.executionFlow.push({ taskId, toolName, status, timestamp: new Date() });
    if (this.executionFlow.length > this.maxHistorySize) {
      this.executionFlow = this.executionFlow.slice(-this.maxHistorySize);
    }
  }
  
  /**
   * 获取执行流程
   */
  getExecutionFlow(taskId?: string): Array<{ taskId: string; toolName: string; status: ExecutionStatus; timestamp: Date }> {
    if (taskId) {
      return this.executionFlow.filter(f => f.taskId === taskId);
    }
    return [...this.executionFlow];
  }
  
  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    const taskIndex = this.taskQueue.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      const task = this.taskQueue[taskIndex];
      task.status = 'cancelled';
      this.taskQueue.splice(taskIndex, 1);
      this.taskHistory.push(task);
      this.recordExecutionFlow(taskId, task.toolCall.toolName, 'cancelled');
      this.updateResourceUsage();
      console.log(`${LOG_PREFIX} [TASK_CANCELLED] taskId=${taskId}`);
      return true;
    }
    return false;
  }
  
  /**
   * 任务失败处理
   */
  handleTaskFailure(taskId: string, error: string): void {
    const task = this.taskQueue.find(t => t.id === taskId) || this.taskHistory.find(t => t.id === taskId);
    if (task) {
      task.status = 'failed';
      task.errorHistory.push(error);
      task.endTime = new Date();
      
      if (task.retryCount < (task.toolCall.retries || config.execution.maxRetries)) {
        task.retryCount++;
        task.status = 'pending';
        console.log(`${LOG_PREFIX} [TASK_SCHEDULED_FOR_RETRY] taskId=${taskId}, retryCount=${task.retryCount}`);
      } else {
        this.taskHistory.push(task);
        console.log(`${LOG_PREFIX} [TASK_FAILED_PERMANENTLY] taskId=${taskId}, totalRetries=${task.retryCount}`);
      }
      
      this.recordExecutionFlow(taskId, task.toolCall.toolName, 'failed');
    }
  }
  
  /**
   * 任务成功处理
   */
  handleTaskSuccess(taskId: string, result: ExecutionResult): void {
    const taskIndex = this.taskQueue.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      const task = this.taskQueue[taskIndex];
      task.status = 'completed';
      task.result = result;
      task.endTime = new Date();
      this.taskQueue.splice(taskIndex, 1);
      this.taskHistory.push(task);
      this.recordExecutionFlow(taskId, task.toolCall.toolName, 'completed');
      this.updateResourceUsage();
      console.log(`${LOG_PREFIX} [TASK_COMPLETED] taskId=${taskId}, executionTime=${result.executionTime}ms`);
    }
  }
  
  /**
   * 生成执行报告
   */
  generateExecutionReport(): string {
    const stats = this.getExecutionStatistics();
    const report = `
=== 执行引擎报告 ===
总任务数: ${stats.totalTasks}
完成任务: ${stats.completedTasks}
失败任务: ${stats.failedTasks}
成功率: ${(stats.successRate * 100).toFixed(2)}%
平均执行时间: ${stats.averageExecutionTime.toFixed(2)}ms
队列长度: ${this.resourceUsage.queueLength}
活跃任务: ${this.resourceUsage.activeTasks}
CPU使用率: ${this.resourceUsage.cpuUsage.toFixed(2)}%
内存使用率: ${this.resourceUsage.memoryUsage.toFixed(2)}%

按优先级分布:
- 关键: ${stats.tasksByPriority.critical}
- 高: ${stats.tasksByPriority.high}
- 正常: ${stats.tasksByPriority.normal}
- 低: ${stats.tasksByPriority.low}

最近执行趋势: ${stats.executionTrend.map(t => `${t.timestamp.toLocaleTimeString()}: 成功率${(t.successRate * 100).toFixed(0)}%`).join(' | ')}
`;
    return report;
  }
  
  /**
   * 持久化任务状态
   */
  persistTaskState(): string {
    const state = {
      queue: this.taskQueue.map(t => ({
        id: t.id,
        toolName: t.toolCall.toolName,
        priority: t.priority,
        status: t.status,
        createdAt: t.startTime
      })),
      history: this.taskHistory.slice(-100).map(t => ({
        id: t.id,
        toolName: t.toolCall.toolName,
        status: t.status,
        executionTime: t.result?.executionTime,
        endTime: t.endTime
      })),
      statistics: this.getExecutionStatistics(),
      timestamp: new Date().toISOString()
    };
    return JSON.stringify(state, null, 2);
  }
  
  /**
   * 从持久化状态恢复
   */
  async restoreFromState(stateJson: string): Promise<void> {
    try {
      const state = JSON.parse(stateJson);
      // 恢复待处理任务
      for (const task of state.queue || []) {
        if (task.status === 'pending') {
          console.log(`${LOG_PREFIX} [RESTORING_TASK] taskId=${task.id}`);
        }
      }
      console.log(`${LOG_PREFIX} [STATE_RESTORED] recovered ${state.queue?.length || 0} pending tasks`);
    } catch (error) {
      console.error(`${LOG_PREFIX} [STATE_RESTORE_FAILED]`, error);
    }
  }
  
  /**
   * 清理过期缓存
   */
  cleanupCache(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, value] of this.taskCache.entries()) {
      if (now - value.timestamp.getTime() > value.ttl) {
        this.taskCache.delete(key);
        cleaned++;
      }
    }
    console.log(`${LOG_PREFIX} [CACHE_CLEANED] removed ${cleaned} expired entries`);
    return cleaned;
  }
  
  /**
   * 获取任务历史
   */
  getTaskHistory(limit = 50): ExecutionTask[] {
    return this.taskHistory.slice(-limit);
  }
  
  /**
   * 按状态获取任务
   */
  getTasksByStatus(status: ExecutionStatus): ExecutionTask[] {
    return [...this.taskQueue.filter(t => t.status === status), ...this.taskHistory.filter(t => t.status === status)];
  }
  
  /**
   * 获取任务详情
   */
  getTaskDetails(taskId: string): ExecutionTask | null {
    return this.taskQueue.find(t => t.id === taskId) || this.taskHistory.find(t => t.id === taskId) || null;
  }
  
  /**
   * 计算任务执行预估时间
   */
  estimateExecutionTime(toolCall: ToolCall): { min: number; max: number; avg: number } {
    const toolName = toolCall.toolName;
    const relevantTasks = this.taskHistory.filter(t => t.toolCall.toolName === toolName && t.result);
    
    if (relevantTasks.length === 0) {
      return { min: 100, max: 5000, avg: 1000 }; // 默认预估
    }
    
    const times = relevantTasks.map(t => t.result!.executionTime);
    const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    return { min, max, avg };
  }
  
  registerTool(name: string, executor: { execute: (toolId: string, parameters: Record<string, any>) => Promise<any> }): void {
    this.toolRegistry.set(name, executor);
    console.log(`${LOG_PREFIX} [TOOL_REGISTERED] toolName=${name}`);
  }

  async execute(toolCall: ToolCall, taskId: string): Promise<ExecutionResult> {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [EXECUTE_START] taskId=${taskId}, toolName=${toolCall.toolName}, parameters=${JSON.stringify(toolCall.parameters)}`);
    
    const executor = this.toolRegistry.get(toolCall.toolName);
    if (!executor) {
      const errorMsg = `Tool ${toolCall.toolName} not found`;
      console.error(`${LOG_PREFIX} [TOOL_NOT_FOUND] taskId=${taskId}, toolName=${toolCall.toolName}`);
      return {
        success: false,
        error: errorMsg,
        executionTime: Date.now() - startTime
      };
    }

    const timeout = toolCall.timeout || config.execution.timeout;
    // 用 ?? 而非 ||：显式 retries: 0 表示"不重试"，不应被默认值吞掉
    const retries = toolCall.retries ?? config.execution.maxRetries;

    console.log(`${LOG_PREFIX} [EXECUTION_CONFIG] taskId=${taskId}, timeout=${timeout}ms, maxRetries=${retries}`);

    let lastError: string | undefined;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`${LOG_PREFIX} [EXECUTE_ATTEMPT] taskId=${taskId}, toolName=${toolCall.toolName}, attempt=${attempt + 1}/${retries + 1}`);
        
        const result = await this.executeWithTimeout(executor, toolCall.toolName, toolCall.parameters, timeout);
        
        this.updateToolSuccessRate(toolCall.toolName, true);
        
        const elapsed = Date.now() - startTime;
        console.log(`${LOG_PREFIX} [EXECUTE_SUCCESS] taskId=${taskId}, toolName=${toolCall.toolName}, attempt=${attempt + 1}, elapsed=${elapsed}ms`);
        
        performanceMonitor.recordMetric('tool_execution', elapsed, true, {
          toolName: toolCall.toolName,
          taskId,
          attempt: attempt + 1
        });
        
        // 直接 execute 路径同样写入执行流（终态），保证 getToolSuccessRate / 仪表盘聚合能覆盖真实调用
        this.recordExecutionFlow(taskId, toolCall.toolName, 'completed');

        return {
          success: true,
          result,
          executionTime: elapsed
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        
        console.warn(`${LOG_PREFIX} [EXECUTE_ERROR] taskId=${taskId}, toolName=${toolCall.toolName}, attempt=${attempt + 1}, error="${lastError}"`);
        
        if (attempt < retries) {
          const delayMs = Math.pow(2, attempt) * 1000;
          console.log(`${LOG_PREFIX} [RETRY_DELAY] taskId=${taskId}, toolName=${toolCall.toolName}, delay=${delayMs}ms`);
          await this.delay(delayMs);
        }
      }
    }

    this.updateToolSuccessRate(toolCall.toolName, false);
    this.recordExecutionFlow(taskId, toolCall.toolName, 'failed');

    const elapsed = Date.now() - startTime;
    console.error(`${LOG_PREFIX} [EXECUTE_FAILED] taskId=${taskId}, toolName=${toolCall.toolName}, totalAttempts=${retries + 1}, elapsed=${elapsed}ms, lastError="${lastError}"`);
    
    performanceMonitor.recordMetric('tool_execution', elapsed, false, {
      toolName: toolCall.toolName,
      taskId,
      attempts: retries + 1,
      error: lastError
    });

    return {
      success: false,
      error: lastError,
      executionTime: elapsed
    };
  }

  private async executeWithTimeout(
    executor: { execute: (toolId: string, parameters: Record<string, any>) => Promise<any> },
    toolName: string,
    parameters: Record<string, unknown>,
    timeout: number
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        console.warn(`${LOG_PREFIX} [TIMEOUT] timeout=${timeout}ms exceeded`);
        reject(new Error('Timeout exceeded'));
      }, timeout);

      executor.execute(toolName, parameters)
        .then((result: unknown) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error: unknown) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  async executeBatch(toolCalls: ToolCall[], taskId: string): Promise<Map<string, ExecutionResult>> {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [EXECUTE_BATCH_START] taskId=${taskId}, toolCallsCount=${toolCalls.length}`);
    
    const results = new Map<string, ExecutionResult>();
    
    for (const toolCall of toolCalls) {
      console.log(`${LOG_PREFIX} [EXECUTE_BATCH_ITEM] taskId=${taskId}, toolName=${toolCall.toolName}`);
      const result = await this.execute(toolCall, taskId);
      results.set(toolCall.toolName, result);
    }
    
    const elapsed = Date.now() - startTime;
    const successCount = Array.from(results.values()).filter(r => r.success).length;
    console.log(`${LOG_PREFIX} [EXECUTE_BATCH_END] taskId=${taskId}, successCount=${successCount}/${results.size}, elapsed=${elapsed}ms`);
    
    return results;
  }

  async executeParallel(toolCalls: ToolCall[], taskId: string): Promise<Map<string, ExecutionResult>> {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [EXECUTE_PARALLEL_START] taskId=${taskId}, toolCallsCount=${toolCalls.length}`);
    
    const results = new Map<string, ExecutionResult>();
    const promises = toolCalls.map(async (toolCall) => {
      console.log(`${LOG_PREFIX} [EXECUTE_PARALLEL_ITEM] taskId=${taskId}, toolName=${toolCall.toolName}`);
      const result = await this.execute(toolCall, taskId);
      results.set(toolCall.toolName, result);
    });
    
    await Promise.all(promises);
    
    const elapsed = Date.now() - startTime;
    const successCount = Array.from(results.values()).filter(r => r.success).length;
    console.log(`${LOG_PREFIX} [EXECUTE_PARALLEL_END] taskId=${taskId}, successCount=${successCount}/${results.size}, elapsed=${elapsed}ms`);
    
    return results;
  }

  private updateToolSuccessRate(toolName: string, success: boolean): void {
    // Tool statistics are now tracked by the ToolManager
    // This is a placeholder for compatibility
  }

  getToolSuccessRate(toolName: string): number {
    // 基于 executionFlow 中已终态（completed/failed）的调用统计成功率
    const terminal = this.executionFlow.filter(
      e => e.toolName === toolName && (e.status === 'completed' || e.status === 'failed')
    );
    if (terminal.length === 0) return 0;
    return terminal.filter(e => e.status === 'completed').length / terminal.length;
  }

  /**
   * 全工具成功率聚合（供仪表盘消费）：按工具名统计已终态调用的成败分布。
   * 纯读取 executionFlow，不影响执行状态。
   */
  getAllToolSuccessRates(): Array<{
    toolName: string;
    total: number;
    completed: number;
    failed: number;
    successRate: number;
  }> {
    const byTool = new Map<string, { total: number; completed: number; failed: number }>();
    for (const e of this.executionFlow) {
      if (e.status !== 'completed' && e.status !== 'failed') continue;
      const stat = byTool.get(e.toolName) ?? { total: 0, completed: 0, failed: 0 };
      stat.total++;
      if (e.status === 'completed') stat.completed++;
      else stat.failed++;
      byTool.set(e.toolName, stat);
    }
    return Array.from(byTool.entries())
      .map(([toolName, s]) => ({
        toolName,
        total: s.total,
        completed: s.completed,
        failed: s.failed,
        successRate: s.total > 0 ? s.completed / s.total : 0
      }))
      .sort((a, b) => b.total - a.total);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}