/**
 * 任务调度器 - 定时任务和调度管理
 */

import { v4 as uuidv4 } from 'uuid';

export type TaskStatus = 'scheduled' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled' | 'timeout';
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  task: () => Promise<void> | void;
  schedule: {
    type: 'once' | 'interval' | 'cron';
    runAt?: Date;
    intervalMs?: number;
    cronExpression?: string;
  };
  priority: TaskPriority;
  status: TaskStatus;
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
    retryOn: string[];
  };
  timeoutMs?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  lastRunAt?: Date;
  nextRunAt?: Date;
  runCount: number;
  totalRuns?: number;
  lastError?: string;
  dependencies?: string[];
  onComplete?: (task: ScheduledTask) => void;
  onError?: (task: ScheduledTask, error: Error) => void;
}

export interface TaskExecutionRecord {
  id: string;
  taskId: string;
  status: TaskStatus;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  error?: string;
  output?: string;
}

export interface TaskGroup {
  id: string;
  name: string;
  tasks: string[];
  concurrency: number;
  dependencies?: string[];
}

class TaskScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private taskHistory: TaskExecutionRecord[] = [];
  private taskGroups: Map<string, TaskGroup> = new Map();
  private runningTimers: Map<string, NodeJS.Timeout> = new Map();
  private maxConcurrentTasks = 10;
  private maxHistorySize = 5000;
  private isRunning = true;
  private listeners: Map<string, Array<(task: ScheduledTask) => void>> = new Map();
  private pausedTasks: Set<string> = new Set();
  private executionQueue: string[] = [];
  private taskStats: Map<string, TaskExecutionRecord[]> = new Map();
  private schedulerInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startSchedulerLoop();
  }

  private startSchedulerLoop(): void {
    this.schedulerInterval = setInterval(() => {
      if (this.isRunning) {
        this.checkScheduledTasks();
        this.processQueue();
      }
    }, 1000);
    // 不阻塞进程退出
    this.schedulerInterval.unref();
  }

  private checkScheduledTasks(): void {
    const now = new Date();
    
    for (const task of this.tasks.values()) {
      if (task.status !== 'scheduled' && task.status !== 'completed') {
        if (task.nextRunAt && now >= task.nextRunAt) {
          if (task.priority === 'critical' || task.priority === 'high') {
            this.executionQueue.unshift(task.id);
          } else {
            this.executionQueue.push(task.id);
          }
        }
      }
    }
  }

  private processQueue(): void {
    const currentRunning = this.taskHistory.filter(
      r => r.status === 'running'
    ).length;
    
    while (this.executionQueue.length > 0 && currentRunning < this.maxConcurrentTasks) {
      const taskId = this.executionQueue.shift()!;
      this.executeTask(taskId);
    }
  }

  /**
   * 调度单次任务
   */
  scheduleTask(task: Omit<ScheduledTask, 'id' | 'createdAt' | 'status' | 'runCount' | 'priority'> & {
    priority?: TaskPriority;
  }): string {
    const id = uuidv4();
    const fullTask: ScheduledTask = {
      ...task,
      id,
      status: 'scheduled',
      priority: task.priority || 'normal',
      runCount: 0,
      createdAt: new Date(),
      nextRunAt: task.schedule.type === 'once' ? task.schedule.runAt : new Date(Date.now() + 1000),
      retryConfig: task.retryConfig || {
        maxRetries: 0,
        retryDelay: 1000,
        retryOn: []
      },
      timeoutMs: task.timeoutMs || 30000,
      tags: task.tags || []
    };

    this.tasks.set(id, fullTask);
    this.notify('scheduled', fullTask);
    
    if (task.schedule.type === 'interval') {
      this.setupIntervalTask(fullTask);
    } else if (task.schedule.type === 'cron') {
      this.setupCronTask(fullTask);
    }
    
    return id;
  }

  /**
   * 调度一次性任务
   */
  scheduleOnce(task: () => Promise<void> | void, delayMs: number, options?: {
    name?: string;
    priority?: TaskPriority;
    timeoutMs?: number;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): string {
    return this.scheduleTask({
      ...options,
      name: options?.name || 'One-time task',
      task,
      schedule: {
        type: 'once',
        runAt: new Date(Date.now() + delayMs)
      },
      priority: options?.priority || 'normal',
      retryConfig: { maxRetries: 0, retryDelay: 0, retryOn: [] }
    });
  }

  /**
   * 调度周期任务
   */
  scheduleInterval(task: () => Promise<void> | void, intervalMs: number, options?: {
    name?: string;
    priority?: TaskPriority;
    totalRuns?: number;
    timeoutMs?: number;
    tags?: string[];
  }): string {
    return this.scheduleTask({
      ...options,
      name: options?.name || 'Interval task',
      task,
      schedule: {
        type: 'interval',
        intervalMs
      },
      priority: options?.priority || 'normal',
      retryConfig: { maxRetries: 0, retryDelay: 0, retryOn: [] }
    });
  }

  /**
   * 调度CRON任务
   */
  scheduleCron(task: () => Promise<void> | void, cronExpression: string, options?: {
    name?: string;
    priority?: TaskPriority;
    timeoutMs?: number;
    tags?: string[];
  }): string {
    return this.scheduleTask({
      ...options,
      name: options?.name || 'Cron task',
      task,
      schedule: {
        type: 'cron',
        cronExpression
      },
      priority: options?.priority || 'normal',
      retryConfig: { maxRetries: 0, retryDelay: 0, retryOn: [] }
    });
  }

  private setupIntervalTask(task: ScheduledTask): void {
    const timer = setInterval(() => {
      if (this.isRunning && !this.pausedTasks.has(task.id)) {
        this.executeTask(task.id);
      }
    }, task.schedule.intervalMs || 1000);
    timer.unref();
    this.runningTimers.set(task.id, timer);
  }

  private setupCronTask(task: ScheduledTask): void {
    // 简化版cron解析（简化版（简化cron
    // 每秒钟检查一次是否满足
    const timer = setInterval(() => {
      if (this.isRunning && !this.pausedTasks.has(task.id)) {
        if (this.checkCronExpression(task.schedule.cronExpression, new Date())) {
          this.executeTask(task.id);
        }
      }
    }, 60000);
    timer.unref();
    this.runningTimers.set(task.id, timer);
  }

  private checkCronExpression(expression: string | undefined, date: Date): boolean {
    if (!expression) return false;
    // 简化的 cron解析（每分钟
    const parts = expression.split(' ');
    if (parts.length < 5) return false;
    
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const now = new Date();
    
    const matches = (expr: string, value: number) => {
      if (expr === '*') return true;
      if (expr.includes(',')) {
        return expr.split(',').some(v => Number(v) === value);
      }
      if (expr.includes('-')) {
        const [start, end] = expr.split('-').map(Number);
        return value >= start && value <= end;
      }
      return Number(expr) === value;
    };

    return (
      matches(minute, now.getMinutes()) &&
      matches(hour, now.getHours()) &&
      matches(dayOfMonth, now.getDate()) &&
      matches(month, now.getMonth() + 1) &&
      matches(dayOfWeek, now.getDay())
    );
  }

  /**
   * 执行任务
   */
  private async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status === 'completed' || task.status === 'cancelled') {
      return;
    }

    const executionRecord: TaskExecutionRecord = {
      id: uuidv4(),
      taskId,
      status: 'running',
      startedAt: new Date()
    };

    // 检查依赖
    if (task.dependencies && task.dependencies.length > 0) {
      const dependenciesMet = task.dependencies.every(depId => {
        const depTask = this.tasks.get(depId);
        return depTask && depTask.status === 'completed';
      });
      
      if (!dependenciesMet) {
        // 重新排队
        const requeueTimer = setTimeout(() => {
          if (!this.executionQueue.includes(taskId)) {
            this.executionQueue.push(taskId);
          }
        }, 5000);
        requeueTimer.unref();
        return;
      }
    }

    task.status = 'running';
    task.lastRunAt = new Date();
    task.runCount++;

    const executions = this.taskStats.get(taskId) || [];
    executions.push(executionRecord);
    if (executions.length > 50) executions.shift();
    this.taskStats.set(taskId, executions);

    try {
      // 设置超时
      let timeoutHandle: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<void>((_, reject) => {
        if (task.timeoutMs) {
          timeoutHandle = setTimeout(() => {
            reject(new Error('Task timeout'));
          }, task.timeoutMs);
          timeoutHandle.unref();
        }
      });

      await Promise.race([
        task.task(),
        timeoutPromise
      ]);

      if (timeoutHandle) clearTimeout(timeoutHandle);

      executionRecord.status = 'completed';
      executionRecord.completedAt = new Date();
      executionRecord.durationMs = executionRecord.completedAt.getTime() - executionRecord.startedAt.getTime();
      task.status = 'completed';

      this.notify('completed', task);
      
      if (task.onComplete) {
        task.onComplete(task);
      }

    } catch (error) {
      executionRecord.status = 'failed';
      executionRecord.error = error instanceof Error ? error.message : String(error);
      
      // 处理重试
      if (task.runCount < task.retryConfig.maxRetries) {
        task.status = 'scheduled';
        task.nextRunAt = new Date(Date.now() + task.retryConfig.retryDelay);
        this.executionQueue.push(taskId);
      } else {
        task.status = 'failed';
        task.lastError = executionRecord.error;
        this.notify('error', task);
        if (task.onError) {
          task.onError(task, error as Error);
        }
      }
    } finally {
      this.taskHistory.push(executionRecord);
      if (this.taskHistory.length > this.maxHistorySize) {
        this.taskHistory = this.taskHistory.slice(-this.maxHistorySize);
      }
    }
  }

  /**
   * 暂停任务
   */
  pauseTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      this.pausedTasks.add(taskId);
      return false;
    }
    if (task.status === 'running') return false;
    task.status = 'paused';
    this.pausedTasks.add(taskId);
    return true;
  }

  /**
   * 恢复任务
   */
  resumeTask(taskId: string): boolean {
    if (this.pausedTasks.has(taskId)) {
      this.pausedTasks.delete(taskId);
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'scheduled';
        return true;
      }
    }
    return false;
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'cancelled';
      this.pausedTasks.delete(taskId);
      const timer = this.runningTimers.get(taskId);
      if (timer) {
        clearInterval(timer);
        this.runningTimers.delete(taskId);
      }
      this.notify('cancelled', task);
      return true;
    }
    return false;
  }

  /**
   * 删除任务
   */
  removeTask(taskId: string): boolean {
    this.cancelTask(taskId);
    return this.tasks.delete(taskId);
  }

  /**
   * 立即执行任务
   */
  runNow(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task) {
      this.executionQueue.unshift(taskId);
      return true;
    }
    return false;
  }

  /**
   * 暂停所有任务
   */
  pauseAll(): void {
    for (const task of this.tasks.values()) {
      this.pausedTasks.add(task.id);
    }
    this.isRunning = false;
  }

  /**
   * 恢复所有任务
   */
  resumeAll(): void {
    this.pausedTasks.clear();
    this.isRunning = true;
  }

  /**
   * 获取任务状态
   */
  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取任务的执行历史
   */
  getTaskHistory(taskId: string): TaskExecutionRecord[] {
    return this.taskStats.get(taskId) || [];
  }

  /**
   * 获取所有执行记录
   */
  getExecutionHistory(limit: number = 100): TaskExecutionRecord[] {
    return this.taskHistory.slice(-limit);
  }

  /**
   * 创建任务组
   */
  createTaskGroup(name: string, tasks: string[], concurrency: number = 1): string {
    const id = uuidv4();
    this.taskGroups.set(id, {
      id,
      name,
      tasks,
      concurrency
    });
    return id;
  }

  /**
   * 按状态筛选任务
   */
  getTasksByStatus(status: TaskStatus): ScheduledTask[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  /**
   * 按优先级筛选任务
   */
  getTasksByPriority(priority: TaskPriority): ScheduledTask[] {
    return Array.from(this.tasks.values()).filter(task => task.priority === priority);
  }

  /**
   * 按标签筛选任务
   */
  getTasksByTag(tag: string): ScheduledTask[] {
    return Array.from(this.tasks.values()).filter(task => task.tags?.includes(tag));
  }

  /**
   * 获取失败的任务
   */
  getFailedTasks(): ScheduledTask[] {
    return this.getTasksByStatus('failed');
  }

  /**
   * 重试运行失败的任务
   */
  retryFailedTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'failed') {
      task.status = 'scheduled';
      task.nextRunAt = new Date();
      task.lastError = undefined;
      this.executionQueue.unshift(taskId);
      return true;
    }
    return false;
  }

  /**
   * 获取调度统计
   */
  getStats(): {
    totalTasks: number;
    scheduledTasks: number;
    runningTasks: number;
    completedTasks: number;
    failedTasks: number;
    queueSize: number;
    averageExecutionTime: number;
    byPriority: Record<TaskPriority, number>;
    successRate: number;
    } {
    const totalExecutions = this.taskHistory.length;
    const successfulExecutions = this.taskHistory.filter(r => r.status === 'completed').length;
    const totalDuration = this.taskHistory.reduce((sum, r) => sum + (r.durationMs || 0), 0);

    return {
      totalTasks: this.tasks.size,
      scheduledTasks: this.getTasksByStatus('scheduled').length,
      runningTasks: this.taskHistory.filter(r => r.status === 'running').length,
      completedTasks: this.getTasksByStatus('completed').length,
      failedTasks: this.getTasksByStatus('failed').length,
      queueSize: this.executionQueue.length,
      averageExecutionTime: totalExecutions > 0 ? totalDuration / totalExecutions : 0,
      byPriority: {
        low: this.getTasksByPriority('low').length,
        normal: this.getTasksByPriority('normal').length,
        high: this.getTasksByPriority('high').length,
        critical: this.getTasksByPriority('critical').length
      },
      successRate: totalExecutions > 0 ? successfulExecutions / totalExecutions : 0
    };
  }

  /**
   * 注册事件监听器
   */
  on(event: 'scheduled' | 'completed' | 'error' | 'cancelled', callback: (task: ScheduledTask) => void): string {
    const listenerId = uuidv4();
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
    return listenerId;
  }

  private notify(event: string, task: ScheduledTask): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(task);
        } catch (e) {
          console.error('[Scheduler] Listener error', e);
        }
      }
    }
  }

  /**
   * 设置并发任务的数量
   */
  setMaxConcurrentTasks(count: number): void {
    this.maxConcurrentTasks = Math.max(1, count);
  }

  /**
   * 等待所有任务完成
   */
  async waitForAll(): Promise<void> {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (
          this.executionQueue.length === 0 &&
          this.getTasksByStatus('running').length === 0
        ) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500);
    });
  }

  /**
   * 导出任务定义
   */
  exportTasks(): string {
    const tasks = this.getAllTasks().map(task => ({
      id: task.id,
      name: task.name,
      description: task.description,
      priority: task.priority,
      status: task.status,
      schedule: task.schedule,
      tags: task.tags,
      lastRunAt: task.lastRunAt,
      runCount: task.runCount
    }));
    return JSON.stringify(tasks, null, 2);
  }

  /**
   * 清空所有任务
   */
  clear(): void {
    for (const timer of this.runningTimers.values()) {
      clearInterval(timer);
    }
    this.tasks.clear();
    this.runningTimers.clear();
    this.executionQueue = [];
    this.pausedTasks.clear();
    this.taskStats.clear();
  }

  /**
   * 销毁调度器
   */
  destroy(): void {
    this.clear();
    if (this.schedulerInterval) clearInterval(this.schedulerInterval);
    this.isRunning = false;
  }
}

export const taskScheduler = new TaskScheduler();
export default TaskScheduler;
