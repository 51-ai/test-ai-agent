/**
 * 自动化工作流模块 - Workflow Automation Module
 * 
 * 功能：
 * 1. 任务调度系统
 * 2. 触发器管理
 * 3. 工作流编排
 * 4. 定时任务执行
 * 
 * @module core/workflow
 */

import { EventEmitter } from 'events';

// ==================== 类型定义 ====================

export type TriggerType = 'cron' | 'interval' | 'event' | 'webhook' | 'manual';

export interface WorkflowTrigger {
  id: string;
  type: TriggerType;
  name: string;
  description: string;
  schedule?: string;
  interval?: number;
  eventName?: string;
  webhookPath?: string;
  enabled: boolean;
  lastTriggeredAt?: number;
  nextTriggerAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowAction {
  id: string;
  type: 'http' | 'function' | 'email' | 'notification' | 'delay' | 'condition';
  name: string;
  config: Record<string, any>;
  nextActionId?: string;
  elseActionId?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  triggerId: string;
  actions: WorkflowAction[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  runCount: number;
  lastRunAt?: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  actions: Array<{
    actionId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    output?: any;
    error?: string;
  }>;
  error?: string;
}

export interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string;
  handler: string;
  args: any[];
  enabled: boolean;
  lastRunAt?: number;
  nextRunAt?: number;
  runCount: number;
  createdAt: number;
}

export interface CronJob {
  id: string;
  expression: string;
  callback: () => void;
  scheduledTime: number;
  timeout?: NodeJS.Timeout;
}

// ==================== 触发器管理器 ====================

export class TriggerManager extends EventEmitter {
  private triggers: Map<string, WorkflowTrigger> = new Map();

  addTrigger(trigger: WorkflowTrigger): void {
    this.triggers.set(trigger.id, trigger);
    if (trigger.enabled) {
      this.activateTrigger(trigger);
    }
    this.emit('trigger:added', trigger);
  }

  getTrigger(id: string): WorkflowTrigger | undefined {
    return this.triggers.get(id);
  }

  getAllTriggers(): WorkflowTrigger[] {
    return Array.from(this.triggers.values());
  }

  updateTrigger(id: string, updates: Partial<WorkflowTrigger>): boolean {
    const trigger = this.triggers.get(id);
    if (!trigger) return false;

    const wasEnabled = trigger.enabled;
    const updated = { ...trigger, ...updates, updatedAt: Date.now() };
    
    this.triggers.set(id, updated);

    if (!wasEnabled && updated.enabled) {
      this.activateTrigger(updated);
    } else if (wasEnabled && !updated.enabled) {
      this.deactivateTrigger(id);
    }

    this.emit('trigger:updated', updated);
    return true;
  }

  deleteTrigger(id: string): boolean {
    this.deactivateTrigger(id);
    const success = this.triggers.delete(id);
    if (success) {
      this.emit('trigger:deleted', id);
    }
    return success;
  }

  activateTrigger(trigger: WorkflowTrigger): void {
    switch (trigger.type) {
      case 'cron':
        this.scheduleCronTrigger(trigger);
        break;
      case 'interval':
        this.scheduleIntervalTrigger(trigger);
        break;
      case 'event':
        this.subscribeToEvent(trigger);
        break;
      case 'webhook':
        this.registerWebhook(trigger);
        break;
    }
  }

  deactivateTrigger(id: string): void {
    this.emit('trigger:deactivate', id);
  }

  private scheduleCronTrigger(trigger: WorkflowTrigger): void {
    if (!trigger.schedule) return;
    this.emit('schedule:cron', { trigger, expression: trigger.schedule });
  }

  private scheduleIntervalTrigger(trigger: WorkflowTrigger): void {
    if (!trigger.interval) return;
    this.emit('schedule:interval', { trigger, interval: trigger.interval });
  }

  private subscribeToEvent(trigger: WorkflowTrigger): void {
    if (!trigger.eventName) return;
    this.on(trigger.eventName, () => this.handleEventTrigger(trigger.id));
  }

  private registerWebhook(trigger: WorkflowTrigger): void {
    if (!trigger.webhookPath) return;
    this.emit('webhook:register', { trigger, path: trigger.webhookPath });
  }

  private handleEventTrigger(triggerId: string): void {
    const trigger = this.triggers.get(triggerId);
    if (!trigger || !trigger.enabled) return;
    
    trigger.lastTriggeredAt = Date.now();
    this.emit('trigger:fired', trigger);
  }
}

// ==================== 工作流执行引擎 ====================

export class WorkflowEngine extends EventEmitter {
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();

  addWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
    this.emit('workflow:added', workflow);
  }

  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  updateWorkflow(id: string, updates: Partial<Workflow>): boolean {
    const workflow = this.workflows.get(id);
    if (!workflow) return false;

    this.workflows.set(id, { ...workflow, ...updates, updatedAt: Date.now() });
    this.emit('workflow:updated', this.workflows.get(id));
    return true;
  }

  deleteWorkflow(id: string): boolean {
    const success = this.workflows.delete(id);
    if (success) {
      this.emit('workflow:deleted', id);
    }
    return success;
  }

  async executeWorkflow(workflowId: string): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || !workflow.enabled) {
      throw new Error(`Workflow not found or disabled: ${workflowId}`);
    }

    const execution: WorkflowExecution = {
      id: `exec_${Date.now()}`,
      workflowId,
      status: 'running',
      startTime: Date.now(),
      actions: workflow.actions.map(action => ({
        actionId: action.id,
        status: 'pending'
      }))
    };

    this.executions.set(execution.id, execution);
    this.emit('workflow:start', execution);

    try {
      let currentActionId: string | undefined = workflow.actions[0]?.id;

      while (currentActionId) {
        const actionIndex = workflow.actions.findIndex(a => a.id === currentActionId);
        if (actionIndex === -1) break;

        const action = workflow.actions[actionIndex];
        const actionExecution = execution.actions.find(a => a.actionId === action.id);
        
        if (actionExecution) {
          actionExecution.status = 'running';
        }

        let output: any;
        let error: string | undefined;

        try {
          output = await this.executeAction(action);
          if (actionExecution) {
            actionExecution.status = 'completed';
            actionExecution.output = output;
          }
        } catch (e) {
          error = e instanceof Error ? e.message : 'Unknown error';
          if (actionExecution) {
            actionExecution.status = 'failed';
            actionExecution.error = error;
          }
          throw new Error(`Action ${action.id} failed: ${error}`);
        }

        if (action.type === 'condition') {
          const conditionResult = output?.result === true;
          currentActionId = conditionResult ? action.nextActionId : action.elseActionId;
        } else {
          currentActionId = action.nextActionId;
        }
      }

      execution.status = 'completed';
      execution.endTime = Date.now();
      
      workflow.runCount++;
      workflow.lastRunAt = Date.now();
      this.workflows.set(workflowId, workflow);

    } catch (e) {
      execution.status = 'failed';
      execution.endTime = Date.now();
      execution.error = e instanceof Error ? e.message : 'Unknown error';
    }

    this.emit('workflow:end', execution);
    return execution;
  }

  private async executeAction(action: WorkflowAction): Promise<any> {
    switch (action.type) {
      case 'http':
        return this.executeHttpAction(action);
      case 'function':
        return this.executeFunctionAction(action);
      case 'email':
        return this.executeEmailAction(action);
      case 'notification':
        return this.executeNotificationAction(action);
      case 'delay':
        return this.executeDelayAction(action);
      case 'condition':
        return this.executeConditionAction(action);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async executeHttpAction(action: WorkflowAction): Promise<any> {
    const { url, method = 'GET', headers, body } = action.config;
    return { status: 'simulated', url, method };
  }

  private async executeFunctionAction(action: WorkflowAction): Promise<any> {
    const { functionName, args } = action.config;
    return { status: 'simulated', functionName, args };
  }

  private async executeEmailAction(action: WorkflowAction): Promise<any> {
    const { to, subject, body } = action.config;
    return { status: 'simulated', to, subject };
  }

  private async executeNotificationAction(action: WorkflowAction): Promise<any> {
    const { channel, message } = action.config;
    return { status: 'simulated', channel, message };
  }

  private async executeDelayAction(action: WorkflowAction): Promise<any> {
    const { milliseconds } = action.config;
    await new Promise(resolve => setTimeout(resolve, milliseconds || 1000));
    return { status: 'completed', delay: milliseconds };
  }

  private async executeConditionAction(action: WorkflowAction): Promise<any> {
    const { condition, value } = action.config;
    const result = condition === 'equals' ? value === true : false;
    return { result };
  }

  getExecution(id: string): WorkflowExecution | undefined {
    return this.executions.get(id);
  }

  getExecutionsByWorkflow(workflowId: string): WorkflowExecution[] {
    return Array.from(this.executions.values()).filter(e => e.workflowId === workflowId);
  }
}

// ==================== 定时任务调度器 ====================

export class TaskScheduler extends EventEmitter {
  private tasks: Map<string, ScheduledTask> = new Map();
  private cronJobs: Map<string, CronJob> = new Map();

  addTask(task: ScheduledTask): void {
    this.tasks.set(task.id, task);
    
    if (task.enabled) {
      this.scheduleTask(task);
    }
    
    this.emit('task:added', task);
  }

  getTask(id: string): ScheduledTask | undefined {
    return this.tasks.get(id);
  }

  getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  updateTask(id: string, updates: Partial<ScheduledTask>): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;

    const wasEnabled = task.enabled;
    const updated = { ...task, ...updates };
    
    this.tasks.set(id, updated);

    if (!wasEnabled && updated.enabled) {
      this.scheduleTask(updated);
    } else if (wasEnabled && !updated.enabled) {
      this.unscheduleTask(id);
    } else if (wasEnabled && updated.enabled && updates.cronExpression) {
      this.unscheduleTask(id);
      this.scheduleTask(updated);
    }

    this.emit('task:updated', updated);
    return true;
  }

  deleteTask(id: string): boolean {
    this.unscheduleTask(id);
    const success = this.tasks.delete(id);
    if (success) {
      this.emit('task:deleted', id);
    }
    return success;
  }

  scheduleTask(task: ScheduledTask): void {
    const cronExpression = task.cronExpression;
    const nextRun = this.parseCron(cronExpression);
    
    const cronJob: CronJob = {
      id: task.id,
      expression: cronExpression,
      callback: () => this.executeTask(task.id),
      scheduledTime: nextRun,
      timeout: setTimeout(() => this.executeTask(task.id), nextRun - Date.now())
    };

    this.cronJobs.set(task.id, cronJob);
    task.nextRunAt = nextRun;
    this.emit('task:scheduled', task);
  }

  unscheduleTask(id: string): void {
    const cronJob = this.cronJobs.get(id);
    if (cronJob && cronJob.timeout) {
      clearTimeout(cronJob.timeout);
    }
    this.cronJobs.delete(id);
  }

  private parseCron(expression: string): number {
    const parts = expression.split(' ');
    if (parts.length === 5) {
      const [minute, hour, day, month, weekday] = parts;
      
      if (minute === '*' && hour === '*' && day === '*' && month === '*' && weekday === '*') {
        return Date.now() + 60000;
      }

      if (hour === '0' && minute === '0') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow.getTime();
      }
    }
    
    return Date.now() + 60000;
  }

  private async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || !task.enabled) return;

    this.emit('task:start', task);

    try {
      task.lastRunAt = Date.now();
      task.runCount++;
      
      this.emit('task:execute', { taskId, handler: task.handler, args: task.args });
      
      this.rescheduleTask(task);
      
      this.emit('task:complete', task);
    } catch (e) {
      this.emit('task:error', { taskId, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  private rescheduleTask(task: ScheduledTask): void {
    this.unscheduleTask(task.id);
    this.scheduleTask(task);
  }

  now(): number {
    return Date.now();
  }
}

// ==================== 导出单例 ====================

export const triggerManager = new TriggerManager();
export const workflowEngine = new WorkflowEngine();
export const taskScheduler = new TaskScheduler();

export default {
  TriggerManager,
  WorkflowEngine,
  TaskScheduler,
  triggerManager,
  workflowEngine,
  taskScheduler
};
