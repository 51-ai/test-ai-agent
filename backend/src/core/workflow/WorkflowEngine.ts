/**
 * 工作流引擎 - 支持复杂业务流程编排
 */

import { v4 as uuidv4 } from 'uuid';

export type WorkflowStatus = 'draft' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type NodeType = 'start' | 'end' | 'task' | 'condition' | 'parallel' | 'loop' | 'subworkflow';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  config: Record<string, unknown>;
  inputs?: string[];
  outputs?: string[];
  conditions?: Record<string, string>;
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  currentNode?: string;
  nodeStatuses: Map<string, ExecutionStatus>;
  variables: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  history: Array<{
    nodeId: string;
    status: ExecutionStatus;
    timestamp: Date;
    message?: string;
  }>;
}

export interface WorkflowInstance {
  executionId: string;
  workflowId: string;
  status: WorkflowStatus;
  startTime: Date;
  endTime?: Date;
  result?: Record<string, unknown>;
  error?: string;
}

export class WorkflowEngine {
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private nodeExecutors: Map<NodeType, (node: WorkflowNode, context: WorkflowContext) => Promise<unknown>> = new Map();
  private maxConcurrentExecutions = 10;
  private activeExecutions = 0;

  constructor() {
    this.registerDefaultExecutors();
  }

  /**
   * 注册默认的节点执行器
   */
  private registerDefaultExecutors(): void {
    // 任务节点执行器
    this.nodeExecutors.set('task', async (node, context) => {
      console.log(`[Workflow] Executing task: ${node.name}`);
      const handler = node.config.handler as ((input: unknown) => Promise<unknown>) | undefined;
      if (handler) {
        return await handler(context.variables);
      }
      return { success: true, node: node.id };
    });

    // 条件节点执行器
    this.nodeExecutors.set('condition', async (node, context) => {
      const condition = node.config.condition as string;
      try {
        // 简单条件评估
        const result = this.evaluateCondition(condition, context.variables);
        return { conditionMet: result, node: node.id };
      } catch (error) {
        throw new Error(`Condition evaluation failed: ${error}`);
      }
    });

    // 并行节点执行器
    this.nodeExecutors.set('parallel', async (node, context) => {
      const tasks = node.config.tasks as Array<() => Promise<unknown>>;
      if (tasks) {
        return await Promise.all(tasks.map(task => task()));
      }
      return { completed: true, node: node.id };
    });

    // 循环节点执行器
    this.nodeExecutors.set('loop', async (node, context) => {
      const maxIterations = node.config.maxIterations as number || 10;
      const loopVariable = node.config.loopVariable as string || 'loopCount';
      let iterations = 0;
      
      while (iterations < maxIterations) {
        iterations++;
        context.variables[loopVariable] = iterations;
        const body = node.config.body as () => Promise<boolean>;
        if (body) {
          const shouldContinue = await body();
          if (!shouldContinue) break;
        }
      }
      return { iterations, node: node.id };
    });
  }

  /**
   * 注册工作流
   */
  registerWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = `workflow_${uuidv4()}`;
    const newWorkflow: Workflow = {
      ...workflow,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.workflows.set(id, newWorkflow);
    console.log(`[Workflow] Registered workflow: ${newWorkflow.name} (${id})`);
    return id;
  }

  /**
   * 获取工作流
   */
  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  /**
   * 获取所有工作流
   */
  getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * 更新工作流
   */
  updateWorkflow(id: string, updates: Partial<Workflow>): boolean {
    const workflow = this.workflows.get(id);
    if (!workflow) return false;
    
    this.workflows.set(id, {
      ...workflow,
      ...updates,
      updatedAt: new Date()
    });
    return true;
  }

  /**
   * 删除工作流
   */
  deleteWorkflow(id: string): boolean {
    return this.workflows.delete(id);
  }

  /**
   * 执行工作流
   */
  async executeWorkflow(workflowId: string, inputVariables: Record<string, unknown> = {}): Promise<WorkflowInstance> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (this.activeExecutions >= this.maxConcurrentExecutions) {
      throw new Error('Maximum concurrent executions reached');
    }

    this.activeExecutions++;
    const executionId = `exec_${uuidv4()}`;
    
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'pending',
      nodeStatuses: new Map(),
      variables: { ...workflow.variables, ...inputVariables },
      startedAt: new Date(),
      history: []
    };

    this.executions.set(executionId, execution);

    // 异步执行工作流
    this.runWorkflowAsync(executionId, workflow).catch(error => {
      console.error(`[Workflow] Execution ${executionId} failed:`, error);
    });

    return {
      executionId,
      workflowId,
      status: 'running',
      startTime: execution.startedAt
    };
  }

  /**
   * 异步执行工作流
   */
  private async runWorkflowAsync(executionId: string, workflow: Workflow): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    try {
      execution.status = 'running';
      
      // 找到起始节点
      const startNode = workflow.nodes.find(n => n.type === 'start');
      if (!startNode) {
        throw new Error('No start node found');
      }

      // 获取起始节点的下一个节点
      const startEdge = workflow.edges.find(e => e.source === startNode.id);
      if (!startEdge) {
        throw new Error('No outgoing edge from start node');
      }

      // 执行工作流
      await this.executeNode(executionId, workflow, startEdge.target);

      execution.status = 'completed';
      execution.completedAt = new Date();
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
      execution.completedAt = new Date();
    } finally {
      this.activeExecutions--;
    }
  }

  /**
   * 执行单个节点
   */
  private async executeNode(
    executionId: string,
    workflow: Workflow,
    nodeId: string
  ): Promise<unknown> {
    const execution = this.executions.get(executionId);
    if (!execution) throw new Error('Execution not found');

    const node = workflow.nodes.find(n => n.id === nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);

    const context: WorkflowContext = {
      workflowId: workflow.id,
      executionId,
      variables: execution.variables,
      nodeHistory: execution.history
    };

    // 记录节点状态
    execution.currentNode = nodeId;
    execution.nodeStatuses.set(nodeId, 'running');
    execution.history.push({
      nodeId,
      status: 'running',
      timestamp: new Date()
    });

    try {
      const executor = this.nodeExecutors.get(node.type);
      if (!executor) {
        throw new Error(`No executor for node type: ${node.type}`);
      }

      const result = await executor(node, context);
      execution.variables[`${nodeId}_result`] = result;
      
      execution.nodeStatuses.set(nodeId, 'completed');
      execution.history.push({
        nodeId,
        status: 'completed',
        timestamp: new Date(),
        message: 'Node completed successfully'
      });

      // 如果是结束节点，返回结果
      if (node.type === 'end') {
        return result;
      }

      // 获取下一个节点
      const nextEdge = workflow.edges.find(e => e.source === nodeId);
      if (nextEdge) {
        // 检查条件
        if (nextEdge.condition) {
          const conditionMet = this.evaluateCondition(nextEdge.condition, execution.variables);
          if (!conditionMet) {
            // 跳过不满足条件的边
            const altEdge = workflow.edges.find(e => e.source === nodeId && e.id !== nextEdge.id);
            if (altEdge) {
              return await this.executeNode(executionId, workflow, altEdge.target);
            }
            return result;
          }
        }
        return await this.executeNode(executionId, workflow, nextEdge.target);
      }

      return result;
    } catch (error) {
      execution.nodeStatuses.set(nodeId, 'failed');
      execution.history.push({
        nodeId,
        status: 'failed',
        timestamp: new Date(),
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 评估条件
   */
  private evaluateCondition(condition: string, variables: Record<string, unknown>): boolean {
    try {
      // 简单的条件评估
      const parts = condition.split(/[=!<>]+/);
      if (parts.length >= 2) {
        const left = this.getVariableValue(parts[0].trim(), variables);
        const right = this.getVariableValue(parts[1].trim(), variables);
        const operator = condition.replace(/[^=!<>]+/g, '');
        
        switch (operator) {
          case '==':
          case '===':
            return left === right;
          case '!=':
          case '!==':
            return left !== right;
          case '>':
            return Number(left) > Number(right);
          case '>=':
            return Number(left) >= Number(right);
          case '<':
            return Number(left) < Number(right);
          case '<=':
            return Number(left) <= Number(right);
          default:
            return Boolean(left);
        }
      }
      return Boolean(this.getVariableValue(condition, variables));
    } catch {
      return false;
    }
  }

  /**
   * 获取变量值
   */
  private getVariableValue(path: string, variables: Record<string, unknown>): unknown {
    const keys = path.split('.');
    let value: unknown = variables;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * 获取执行状态
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * 暂停执行
   */
  pauseExecution(executionId: string): boolean {
    const execution = this.executions.get(executionId);
    if (execution && execution.status === 'running') {
      execution.status = 'pending';
      return true;
    }
    return false;
  }

  /**
   * 恢复执行
   */
  async resumeExecution(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution || !execution.currentNode) return false;

    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) return false;

    execution.status = 'running';
    try {
      await this.executeNode(executionId, workflow, execution.currentNode);
      execution.status = 'completed';
      execution.completedAt = new Date();
      return true;
    } catch {
      execution.status = 'failed';
      return false;
    }
  }

  /**
   * 取消执行
   */
  cancelExecution(executionId: string): boolean {
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.status = 'failed';
      execution.error = 'Execution cancelled by user';
      execution.completedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * 创建示例工作流
   */
  createSampleWorkflow(): string {
    const workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'> = {
      name: '数据处理流程',
      description: '示例数据处理工作流',
      version: '1.0.0',
      nodes: [
        { id: 'start', type: 'start', name: '开始', config: {} },
        { id: 'task1', type: 'task', name: '数据收集', config: { handler: async () => ({ data: [1, 2, 3] }) } },
        { id: 'condition1', type: 'condition', name: '数据检查', config: { condition: 'data != null' } },
        { id: 'task2', type: 'task', name: '数据处理', config: { handler: async (ctx: WorkflowContext) => ({ processed: ctx.variables.data }) } },
        { id: 'task3', type: 'task', name: '错误处理', config: { handler: async () => ({ error: 'handled' }) } },
        { id: 'end', type: 'end', name: '结束', config: {} }
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'task1' },
        { id: 'e2', source: 'task1', target: 'condition1' },
        { id: 'e3', source: 'condition1', target: 'task2', condition: 'data != null' },
        { id: 'e4', source: 'condition1', target: 'task3', condition: 'data == null' },
        { id: 'e5', source: 'task2', target: 'end' },
        { id: 'e6', source: 'task3', target: 'end' }
      ],
      variables: {}
    };

    return this.registerWorkflow(workflow);
  }

  /**
   * 获取工作流统计
   */
  getWorkflowStats(): {
    totalWorkflows: number;
    totalExecutions: number;
    activeExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
  } {
    let completed = 0, failed = 0;
    
    for (const exec of this.executions.values()) {
      if (exec.status === 'completed') completed++;
      else if (exec.status === 'failed') failed++;
    }

    return {
      totalWorkflows: this.workflows.size,
      totalExecutions: this.executions.size,
      activeExecutions: this.activeExecutions,
      completedExecutions: completed,
      failedExecutions: failed
    };
  }
}

interface WorkflowContext {
  workflowId: string;
  executionId: string;
  variables: Record<string, unknown>;
  nodeHistory: Array<{
    nodeId: string;
    status: ExecutionStatus;
    timestamp: Date;
    message?: string;
  }>;
}

export default WorkflowEngine;
