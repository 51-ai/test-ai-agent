/**
 * ExecutorAgent - 执行智能体
 * 
 * 核心职责：
 * - 工具调用与执行
 * - 参数规范化
 * - 结果处理与传递
 * - 异常处理与重试
 * 
 * 目标：工具调用准确率提升40%，参数错误率降低70%
 * 
 * @module core/agents
 */

import { ReActTemplate, ReActStep, ReActTrace } from '../react/ReActTemplate';
import { SubTask, TaskType } from './PlannerAgent';

export interface ExecutionResult {
  taskId: string;
  success: boolean;
  output: string;
  toolCalls: ToolCallRecord[];
  errors: ExecutionError[];
  executionTime: number;
  retryCount: number;
  metadata: Record<string, any>;
}

export interface ToolCallRecord {
  toolName: string;
  parameters: Record<string, any>;
  result: string;
  success: boolean;
  timestamp: number;
  retryCount: number;
}

export interface ExecutionError {
  type: 'tool_not_found' | 'parameter_error' | 'execution_failed' | 'timeout' | 'unknown' | 'tool_failure';
  message: string;
  toolName?: string;
  timestamp: number;
  recoverable: boolean;
  suggestedFix?: string;
}

export interface ExecutionContext {
  task: SubTask;
  availableTools: Map<string, ToolExecutor>;
  previousResults: Map<string, ExecutionResult>;
  maxRetries: number;
  timeout: number;
  parallelEnabled: boolean;
}

export interface ToolExecutor {
  name: string;
  execute(params: Record<string, any>): Promise<string>;
  validateParams(params: Record<string, any>): boolean;
  getSchema(): ToolSchema;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required: boolean;
    default?: any;
    validation?: (value: any) => boolean;
  }>;
  returns: {
    type: string;
    description: string;
  };
}

export class ExecutorAgent {
  private reactTemplate: ReActTemplate;
  private toolRegistry: Map<string, ToolExecutor> = new Map();
  private executionHistory: Map<string, ExecutionResult[]> = new Map();
  private executionCounter = 0;

  constructor(tools?: ToolExecutor[]) {
    this.reactTemplate = new ReActTemplate({ language: 'zh' });
    
    if (tools) {
      for (const tool of tools) {
        this.registerTool(tool);
      }
    }

    this.initializeDefaultTools();
  }

  /**
   * 核心执行方法
   */
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const toolCalls: ToolCallRecord[] = [];
    const errors: ExecutionError[] = [];
    let retryCount = 0;
    let output = '';
    let success = false;

    try {
      // 1. 准备执行环境
      const preparedTask = this.prepareTask(context.task, context.previousResults);

      // 2. 选择合适的工具
      const selectedTools = this.selectTools(preparedTask);

      // 3. 执行工具调用
      for (const toolName of selectedTools) {
        const tool = this.toolRegistry.get(toolName);
        
        if (!tool) {
          errors.push({
            type: 'tool_not_found',
            message: `工具 ${toolName} 未注册`,
            toolName,
            timestamp: Date.now(),
            recoverable: false,
            suggestedFix: '检查工具注册状态'
          });
          continue;
        }

        // 4. 生成规范化参数
        const params = this.generateParameters(preparedTask, tool.getSchema(), context.previousResults);

        // 5. 参数验证
        if (!tool.validateParams(params)) {
          const fixedParams = this.fixParameters(params, tool.getSchema());
          
          if (!tool.validateParams(fixedParams)) {
            errors.push({
              type: 'parameter_error',
              message: `参数验证失败: ${JSON.stringify(params)}`,
              toolName,
              timestamp: Date.now(),
              recoverable: true,
              suggestedFix: `使用默认参数: ${JSON.stringify(fixedParams)}`
            });
            continue;
          }
          
          // 使用修正后的参数
          Object.assign(params, fixedParams);
        }

        // 6. 执行工具调用（带重试机制）
        const callResult = await this.executeWithRetry(
          tool,
          params,
          context.maxRetries,
          context.timeout
        );

        toolCalls.push(callResult.record);

        if (!callResult.success) {
          errors.push({
            type: 'execution_failed',
            message: callResult.error || '执行失败',
            toolName,
            timestamp: Date.now(),
            recoverable: callResult.retryCount < context.maxRetries,
            suggestedFix: '尝试替代工具或调整参数'
          });
          retryCount += callResult.retryCount;
        } else {
          output += callResult.record.result + '\n';
          success = true;
        }
      }

      // 7. 处理输出结果
      output = this.processOutput(output, context.task);

    } catch (error) {
      errors.push({
        type: 'unknown',
        message: error instanceof Error ? error.message : '未知错误',
        timestamp: Date.now(),
        recoverable: false
      });
    }

    const result: ExecutionResult = {
      taskId: context.task.id,
      success: success && errors.filter(e => !e.recoverable).length === 0,
      output,
      toolCalls,
      errors,
      executionTime: Date.now() - startTime,
      retryCount,
      metadata: {
        taskType: context.task.type,
        toolCount: toolCalls.length,
        errorCount: errors.length
      }
    };

    // 记录执行历史
    this.recordExecution(context.task.id, result);

    return result;
  }

  /**
   * 批量并行执行
   */
  async executeParallel(tasks: SubTask[], context: ExecutionContext): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    // 识别可并行执行的任务
    const parallelGroups = this.identifyParallelGroups(tasks);

    for (const group of parallelGroups) {
      // 并行执行组内任务
      const groupResults = await Promise.all(
        group.map(task => this.execute({
          ...context,
          task,
          previousResults: new Map(results.map(r => [r.taskId, r]))
        }))
      );

      results.push(...groupResults);
    }

    return results;
  }

  /**
   * 准备任务执行环境
   */
  private prepareTask(task: SubTask, previousResults: Map<string, ExecutionResult>): PreparedTask {
    // 从之前的结果中提取上下文
    const contextData: Record<string, any> = {};
    
    for (const depId of task.dependencies) {
      const prevResult = previousResults.get(depId);
      if (prevResult && prevResult.success) {
        contextData[depId] = prevResult.output;
      }
    }

    return {
      ...task,
      contextData,
      preparedParameters: this.extractParametersFromDescription(task.description)
    };
  }

  /**
   * 从描述中提取参数
   */
  private extractParametersFromDescription(description: string): Record<string, any> {
    const params: Record<string, any> = {};

    // 提取查询关键词
    const queryMatch = description.match(/搜索|查找|查询|search|find|query[:：]?\s*["']?([^"'\n]+)/i);
    if (queryMatch) {
      params.query = queryMatch[1].trim();
    }

    // 提取文件名
    const fileMatch = description.match(/文件|file[:：]?\s*["']?([^"'\n]+\.[a-zA-Z0-9]+)/i);
    if (fileMatch) {
      params.fileName = fileMatch[1].trim();
    }

    // 提取数据集
    const datasetMatch = description.match(/数据集|dataset[:：]?\s*["']?([^"'\n]+)/i);
    if (datasetMatch) {
      params.dataset = datasetMatch[1].trim();
    }

    return params;
  }

  /**
   * 工具选择策略
   */
  private selectTools(task: PreparedTask): string[] {
    const selected: string[] = [];

    // 优先使用任务指定的工具
    if (task.requiredTools.length > 0) {
      for (const toolName of task.requiredTools) {
        if (this.toolRegistry.has(toolName)) {
          selected.push(toolName);
        }
      }
    }

    // 根据任务类型自动选择工具
    if (selected.length === 0) {
      selected.push(...this.selectToolsByType(task.type));
    }

    // 确保至少有一个工具
    if (selected.length === 0) {
      selected.push('default_executor');
    }

    return selected;
  }

  private selectToolsByType(type: TaskType): string[] {
    const typeToolMap: Record<TaskType, string[]> = {
      'search': ['web_search', 'document_tool'],
      'analysis': ['data_analysis', 'code_executor'],
      'code': ['code_executor'],
      'document': ['document_tool'],
      'data': ['data_analysis'],
      'cloud': ['cloud_service'],
      'communication': [],
      'custom': ['default_executor']
    };

    return typeToolMap[type] || [];
  }

  /**
   * 参数生成与规范化
   */
  private generateParameters(
    task: PreparedTask,
    schema: ToolSchema,
    previousResults: Map<string, ExecutionResult>
  ): Record<string, any> {
    const params: Record<string, any> = {};

    // 从schema中获取必需参数
    for (const [paramName, paramDef] of Object.entries(schema.parameters)) {
      if (paramDef.required) {
        // 尝试从任务描述中获取
        if (task.preparedParameters[paramName]) {
          params[paramName] = task.preparedParameters[paramName];
        }
        // 尝试从上下文数据中获取
        else if (task.contextData[paramName]) {
          params[paramName] = task.contextData[paramName];
        }
        // 使用默认值
        else if (paramDef.default !== undefined) {
          params[paramName] = paramDef.default;
        }
        // 生成智能默认值
        else {
          params[paramName] = this.generateSmartDefault(paramName, paramDef, task);
        }
      } else {
        // 可选参数：有值就用，没有就跳过
        if (task.preparedParameters[paramName]) {
          params[paramName] = task.preparedParameters[paramName];
        } else if (paramDef.default !== undefined) {
          params[paramName] = paramDef.default;
        }
      }
    }

    return params;
  }

  /**
   * 生成智能默认参数
   */
  private generateSmartDefault(
    paramName: string,
    paramDef: ToolSchema['parameters'][string],
    task: PreparedTask
  ): any {
    // 根据参数名和类型生成默认值
    switch (paramName) {
      case 'query':
        return task.description.slice(0, 100);
      case 'numResults':
        return 5;
      case 'language':
        return 'javascript';
      case 'action':
        return 'read';
      case 'service':
        return 'aws';
      case 'resource':
        return 'default';
      default:
        // 根据类型生成
        switch (paramDef.type) {
          case 'string':
            return '';
          case 'number':
            return 0;
          case 'boolean':
            return false;
          case 'array':
            return [];
          case 'object':
            return {};
          default:
            return null;
        }
    }
  }

  /**
   * 参数修正
   */
  private fixParameters(
    params: Record<string, any>,
    schema: ToolSchema
  ): Record<string, any> {
    const fixed = { ...params };

    for (const [paramName, paramDef] of Object.entries(schema.parameters)) {
      // 类型修正
      if (fixed[paramName] !== undefined) {
        fixed[paramName] = this.fixType(fixed[paramName], paramDef.type);
      }

      // 验证函数修正
      if (paramDef.validation && !paramDef.validation(fixed[paramName])) {
        fixed[paramName] = paramDef.default;
      }
    }

    return fixed;
  }

  private fixType(value: any, targetType: string): any {
    switch (targetType) {
      case 'string':
        return String(value);
      case 'number':
        const num = Number(value);
        return isNaN(num) ? 0 : num;
      case 'boolean':
        return Boolean(value);
      case 'array':
        return Array.isArray(value) ? value : [value];
      case 'object':
        return typeof value === 'object' ? value : {};
      default:
        return value;
    }
  }

  /**
   * 带重试的执行
   */
  private async executeWithRetry(
    tool: ToolExecutor,
    params: Record<string, any>,
    maxRetries: number,
    timeout: number
  ): Promise<{ success: boolean; record: ToolCallRecord; error?: string; retryCount: number }> {
    let retryCount = 0;
    let lastError: string | undefined;

    while (retryCount <= maxRetries) {
      try {
        const startTime = Date.now();
        
        // 执行工具调用（带超时）
        const result = await this.executeWithTimeout(tool.execute(params), timeout);

        return {
          success: true,
          record: {
            toolName: tool.name,
            parameters: params,
            result,
            success: true,
            timestamp: startTime,
            retryCount
          },
          retryCount
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : '执行失败';
        retryCount++;

        // 如果是可恢复错误，调整参数后重试
        if (retryCount <= maxRetries) {
          params = this.adjustParametersForRetry(params, retryCount);
        }
      }
    }

    return {
      success: false,
      record: {
        toolName: tool.name,
        parameters: params,
        result: '',
        success: false,
        timestamp: Date.now(),
        retryCount
      },
      error: lastError,
      retryCount
    };
  }

  /**
   * 带超时的执行
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`执行超时 (${timeout}ms)`));
      }, timeout);

      promise
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * 重试参数调整
   */
  private adjustParametersForRetry(params: Record<string, any>, retryCount: number): Record<string, any> {
    const adjusted = { ...params };

    // 根据重试次数调整参数
    if (retryCount === 1) {
      // 第一次重试：简化参数
      if (adjusted.query && adjusted.query.length > 50) {
        adjusted.query = adjusted.query.slice(0, 50);
      }
    } else if (retryCount === 2) {
      // 第二次重试：使用更保守的参数
      if (adjusted.numResults) {
        adjusted.numResults = Math.max(1, adjusted.numResults - 2);
      }
    }

    return adjusted;
  }

  /**
   * 输出结果处理
   */
  private processOutput(rawOutput: string, task: SubTask): string {
    let output = rawOutput;

    // 清理多余空白
    output = output.trim();

    // 根据任务类型格式化输出
    switch (task.type) {
      case 'search':
        output = this.formatSearchOutput(output);
        break;
      case 'analysis':
        output = this.formatAnalysisOutput(output);
        break;
      case 'code':
        output = this.formatCodeOutput(output);
        break;
      case 'document':
        output = this.formatDocumentOutput(output);
        break;
    }

    // 截断过长输出
    if (output.length > 2000) {
      output = output.slice(0, 2000) + '\n...[输出已截断]';
    }

    return output;
  }

  private formatSearchOutput(output: string): string {
    // 格式化搜索结果
    const lines = output.split('\n');
    const formatted: string[] = ['搜索结果:'];
    
    for (const line of lines) {
      if (line.trim()) {
        formatted.push(`- ${line.trim()}`);
      }
    }

    return formatted.join('\n');
  }

  private formatAnalysisOutput(output: string): string {
    // 格式化分析结果
    return `分析结果:\n${output}`;
  }

  private formatCodeOutput(output: string): string {
    // 格式化代码执行结果
    return `执行结果:\n${output}`;
  }

  private formatDocumentOutput(output: string): string {
    // 格式化文档处理结果
    return `文档内容:\n${output}`;
  }

  /**
   * 识别可并行执行的任务组
   */
  private identifyParallelGroups(tasks: SubTask[]): SubTask[][] {
    const groups: SubTask[][] = [];
    const visited = new Set<string>();

    // 找出无依赖的任务作为第一组
    const noDepTasks = tasks.filter(t => t.dependencies.length === 0);
    if (noDepTasks.length > 0) {
      groups.push(noDepTasks);
      noDepTasks.forEach(t => visited.add(t.id));
    }

    // 按依赖层级分组
    while (visited.size < tasks.length) {
      const nextGroup = tasks.filter(t => 
        !visited.has(t.id) && 
        t.dependencies.every(d => visited.has(d))
      );

      if (nextGroup.length === 0) break;
      
      groups.push(nextGroup);
      nextGroup.forEach(t => visited.add(t.id));
    }

    return groups;
  }

  /**
   * 注册工具
   */
  registerTool(tool: ToolExecutor): void {
    this.toolRegistry.set(tool.name, tool);
  }

  /**
   * 获取工具
   */
  getTool(name: string): ToolExecutor | undefined {
    return this.toolRegistry.get(name);
  }

  /**
   * 列出所有工具
   */
  listTools(): string[] {
    return Array.from(this.toolRegistry.keys());
  }

  /**
   * 记录执行历史
   */
  private recordExecution(taskId: string, result: ExecutionResult): void {
    const history = this.executionHistory.get(taskId) || [];
    history.push(result);
    this.executionHistory.set(taskId, history);
  }

  /**
   * 获取执行历史
   */
  getExecutionHistory(taskId: string): ExecutionResult[] {
    return this.executionHistory.get(taskId) || [];
  }

  /**
   * 初始化默认工具
   */
  private initializeDefaultTools(): void {
    // 默认执行器
    this.registerTool({
      name: 'default_executor',
      execute: async (params: Record<string, any>) => {
        return `执行默认操作: ${JSON.stringify(params)}`;
      },
      validateParams: () => true,
      getSchema: () => ({
        name: 'default_executor',
        description: '默认执行工具',
        parameters: {
          action: { type: 'string', description: '执行动作', required: true }
        },
        returns: { type: 'string', description: '执行结果' }
      })
    });

    // 模拟搜索工具
    this.registerTool({
      name: 'web_search',
      execute: async (params: Record<string, any>) => {
        const query = params.query || '';
        const numResults = params.numResults || 5;
        return `搜索 "${query}" 返回 ${numResults} 条结果`;
      },
      validateParams: (params) => typeof params.query === 'string',
      getSchema: () => ({
        name: 'web_search',
        description: '网络搜索工具',
        parameters: {
          query: { type: 'string', description: '搜索关键词', required: true },
          numResults: { type: 'number', description: '结果数量', required: false, default: 5 }
        },
        returns: { type: 'string', description: '搜索结果' }
      })
    });

    // 模拟代码执行工具
    this.registerTool({
      name: 'code_executor',
      execute: async (params: Record<string, any>) => {
        const code = params.code || '';
        return `执行代码: ${code.slice(0, 100)}...`;
      },
      validateParams: (params) => typeof params.code === 'string',
      getSchema: () => ({
        name: 'code_executor',
        description: '代码执行工具',
        parameters: {
          code: { type: 'string', description: '代码内容', required: true },
          language: { type: 'string', description: '编程语言', required: false, default: 'javascript' }
        },
        returns: { type: 'string', description: '执行结果' }
      })
    });
  }

  /**
   * 生成ReAct执行步骤
   */
  generateReActExecuteStep(task: SubTask, params: Record<string, any>): ReActStep {
    return {
      thought: `执行任务 "${task.name}"，使用工具 ${task.requiredTools.join(', ')}`,
      action: task.requiredTools[0] || 'default_executor',
      actionInput: params,
      observation: null,
      reflection: null
    };
  }

  /**
   * 创建执行轨迹
   */
  createExecutionTrace(task: SubTask, steps: ReActStep[]): ReActTrace {
    return this.reactTemplate.createTrace(
      task.description,
      steps,
      steps.every(s => s.observation !== null)
    );
  }

  /**
   * 获取工具调用统计
   */
  getToolCallStatistics(): Record<string, { calls: number; successRate: number; avgTime: number }> {
    const stats: Record<string, { calls: number; successes: number; totalTime: number }> = {};

    for (const [, history] of this.executionHistory) {
      for (const result of history) {
        for (const call of result.toolCalls) {
          if (!stats[call.toolName]) {
            stats[call.toolName] = { calls: 0, successes: 0, totalTime: 0 };
          }
          stats[call.toolName].calls++;
          if (call.success) stats[call.toolName].successes++;
          stats[call.toolName].totalTime += result.executionTime;
        }
      }
    }

    const result: Record<string, { calls: number; successRate: number; avgTime: number }> = {};
    for (const [tool, data] of Object.entries(stats)) {
      result[tool] = {
        calls: data.calls,
        successRate: data.calls > 0 ? data.successes / data.calls : 0,
        avgTime: data.calls > 0 ? data.totalTime / data.calls : 0
      };
    }

    return result;
  }
}

// === 辅助接口 ===

interface PreparedTask extends SubTask {
  contextData: Record<string, any>;
  preparedParameters: Record<string, any>;
}

export default ExecutorAgent;