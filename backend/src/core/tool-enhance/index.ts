/**
 * 工具调用增强模块 - Tool Calling Enhancement Module
 * 
 * 功能：
 * 1. JSON Schema 工具定义
 * 2. 动态工具检索与匹配
 * 3. 工具调用优化（并行、重试、缓存）
 * 4. 工具参数验证
 * 
 * @module core/tool-enhance
 */

import { EventEmitter } from 'events';

// ==================== JSON Schema 类型定义 ====================

export interface JsonSchema {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';
  title?: string;
  description?: string;
  format?: string;
  default?: any;
  enum?: any[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  $ref?: string;
}

export interface ToolParameter {
  name: string;
  description: string;
  schema: JsonSchema;
  required: boolean;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: ToolParameter[];
  returnType: JsonSchema;
  examples?: Array<{
    input: Record<string, any>;
    output: any;
  }>;
  tags: string[];
  enabled: boolean;
  usageCount: number;
  lastUsedAt?: number;
}

export interface ToolCall {
  id: string;
  toolId: string;
  parameters: Record<string, any>;
  timestamp: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  duration?: number;
}

export interface ToolCallResult {
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

// ==================== 工具注册表 ====================

export class ToolRegistry extends EventEmitter {
  private tools: Map<string, ToolDefinition> = new Map();

  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
    this.emit('tool:registered', tool);
  }

  getTool(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getToolsByCategory(category: string): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(t => t.category === category);
  }

  getEnabledTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(t => t.enabled);
  }

  updateTool(id: string, updates: Partial<ToolDefinition>): boolean {
    const tool = this.tools.get(id);
    if (!tool) return false;

    this.tools.set(id, { ...tool, ...updates });
    this.emit('tool:updated', this.tools.get(id));
    return true;
  }

  unregisterTool(id: string): boolean {
    const success = this.tools.delete(id);
    if (success) {
      this.emit('tool:unregistered', id);
    }
    return success;
  }

  incrementUsage(id: string): void {
    const tool = this.tools.get(id);
    if (tool) {
      tool.usageCount++;
      tool.lastUsedAt = Date.now();
      this.tools.set(id, tool);
    }
  }

  validateParameters(toolId: string, parameters: Record<string, any>): {
    valid: boolean;
    errors: string[];
  } {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return { valid: false, errors: [`Tool ${toolId} not found`] };
    }

    const errors: string[] = [];

    tool.parameters.forEach(param => {
      if (param.required && !(param.name in parameters)) {
        errors.push(`参数 ${param.name} 是必填的`);
      }

      if (param.name in parameters) {
        const value = parameters[param.name];
        const validation = this.validateSchema(value, param.schema);
        if (!validation.valid) {
          errors.push(...validation.errors.map(e => `${param.name}: ${e}`));
        }
      }
    });

    Object.keys(parameters).forEach(key => {
      if (!tool.parameters.some(p => p.name === key)) {
        errors.push(`未知参数: ${key}`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  private validateSchema(value: any, schema: JsonSchema): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (schema.type && typeof value !== schema.type) {
      errors.push(`期望类型 ${schema.type}，实际类型 ${typeof value}`);
    }

    if (schema.minLength !== undefined && typeof value === 'string' && value.length < schema.minLength) {
      errors.push(`长度不足，最小需要 ${schema.minLength} 字符`);
    }

    if (schema.maxLength !== undefined && typeof value === 'string' && value.length > schema.maxLength) {
      errors.push(`长度超限，最大允许 ${schema.maxLength} 字符`);
    }

    if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum) {
      errors.push(`值太小，最小允许 ${schema.minimum}`);
    }

    if (schema.maximum !== undefined && typeof value === 'number' && value > schema.maximum) {
      errors.push(`值太大，最大允许 ${schema.maximum}`);
    }

    if (schema.pattern && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) {
      errors.push(`格式不匹配正则表达式 ${schema.pattern}`);
    }

    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`值必须是以下之一: ${schema.enum.join(', ')}`);
    }

    if (schema.type === 'object' && schema.properties && typeof value === 'object') {
      Object.keys(schema.properties).forEach(key => {
        const propSchema = schema.properties![key];
        if (propSchema.required && !(key in value)) {
          errors.push(`对象属性 ${key} 是必填的`);
        }
        if (key in value) {
          const nested = this.validateSchema(value[key], propSchema);
          if (!nested.valid) {
            errors.push(...nested.errors.map(e => `${key}.${e}`));
          }
        }
      });
    }

    if (schema.type === 'array' && schema.items && Array.isArray(value)) {
      value.forEach((item, index) => {
        const itemValidation = this.validateSchema(item, schema.items!);
        if (!itemValidation.valid) {
          errors.push(...itemValidation.errors.map(e => `[${index}].${e}`));
        }
      });
    }

    return { valid: errors.length === 0, errors };
  }
}

// ==================== 工具检索器 ====================

export class ToolRetriever {
  private toolRegistry: ToolRegistry;

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
  }

  retrieveTools(query: string, topN: number = 5): ToolDefinition[] {
    const tools = this.toolRegistry.getEnabledTools();
    
    const scoredTools = tools.map(tool => ({
      tool,
      score: this.calculateRelevance(query, tool)
    }))
    .filter(t => t.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

    return scoredTools.map(t => t.tool);
  }

  private calculateRelevance(query: string, tool: ToolDefinition): number {
    let score = 0;
    const queryLower = query.toLowerCase();
    
    if (tool.name.toLowerCase().includes(queryLower)) {
      score += 0.4;
    }
    
    if (tool.description.toLowerCase().includes(queryLower)) {
      score += 0.3;
    }
    
    tool.tags.forEach(tag => {
      if (tag.toLowerCase().includes(queryLower)) {
        score += 0.1;
      }
    });
    
    tool.parameters.forEach(param => {
      if (param.name.toLowerCase().includes(queryLower)) {
        score += 0.05;
      }
      if (param.description.toLowerCase().includes(queryLower)) {
        score += 0.05;
      }
    });

    return Math.min(score, 1);
  }

  retrieveByCategory(category: string): ToolDefinition[] {
    return this.toolRegistry.getToolsByCategory(category);
  }

  retrieveByParameter(parameterName: string): ToolDefinition[] {
    return this.toolRegistry.getEnabledTools().filter(tool =>
      tool.parameters.some(p => p.name.toLowerCase() === parameterName.toLowerCase())
    );
  }
}

// ==================== 工具调用执行器 ====================

export class ToolExecutor extends EventEmitter {
  private toolRegistry: ToolRegistry;
  private toolCalls: Map<string, ToolCall> = new Map();
  private cache: Map<string, { result: any; timestamp: number; ttl: number }> = new Map();

  constructor(toolRegistry: ToolRegistry) {
    super();
    this.toolRegistry = toolRegistry;
  }

  async execute(toolId: string, parameters: Record<string, any>, options?: {
    cache?: boolean;
    cacheTTL?: number;
    retries?: number;
    timeout?: number;
  }): Promise<ToolCallResult> {
    const { cache = false, cacheTTL = 300000, retries = 1, timeout = 30000 } = options || {};

    const cacheKey = `${toolId}:${JSON.stringify(parameters)}`;
    
    if (cache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return { success: true, result: cached.result, duration: 0 };
      }
    }

    const validation = this.toolRegistry.validateParameters(toolId, parameters);
    if (!validation.valid) {
      return {
        success: false,
        error: `参数验证失败: ${validation.errors.join('; ')}`,
        duration: 0
      };
    }

    const toolCall: ToolCall = {
      id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      toolId,
      parameters,
      timestamp: Date.now(),
      status: 'running'
    };

    this.toolCalls.set(toolCall.id, toolCall);
    this.emit('tool:call:start', toolCall);

    let attempts = 0;
    let lastError: string | undefined;

    while (attempts <= retries) {
      try {
        const startTime = Date.now();
        
        const result = await this.executeTool(toolId, parameters, timeout);
        
        const duration = Date.now() - startTime;

        if (cache) {
          this.cache.set(cacheKey, { result, timestamp: Date.now(), ttl: cacheTTL });
        }

        toolCall.status = 'completed';
        toolCall.result = result;
        toolCall.duration = duration;

        this.emit('tool:call:complete', toolCall);
        this.toolRegistry.incrementUsage(toolId);

        return { success: true, result, duration };

      } catch (error) {
        attempts++;
        lastError = error instanceof Error ? error.message : String(error);
        
        if (attempts <= retries) {
          await this.delay(Math.pow(2, attempts) * 1000);
        }
      }
    }

    toolCall.status = 'failed';
    toolCall.error = lastError;
    this.emit('tool:call:error', toolCall);

    return { success: false, error: lastError, duration: Date.now() - toolCall.timestamp };
  }

  async executeParallel(calls: Array<{ toolId: string; parameters: Record<string, any> }>): Promise<ToolCallResult[]> {
    const promises = calls.map(call => this.execute(call.toolId, call.parameters));
    return Promise.all(promises);
  }

  async executeSequence(calls: Array<{ toolId: string; parameters: Record<string, any>; dependsOn?: string }>): Promise<ToolCallResult[]> {
    const results: ToolCallResult[] = [];
    const callResults = new Map<string, any>();

    for (const call of calls) {
      let parameters = { ...call.parameters };
      
      if (call.dependsOn) {
        const depResult = callResults.get(call.dependsOn);
        if (depResult !== undefined) {
          parameters = this.replaceDependencies(parameters, depResult);
        }
      }

      const result = await this.execute(call.toolId, parameters);
      results.push(result);
      callResults.set(call.toolId, result.result);
    }

    return results;
  }

  private replaceDependencies(parameters: Record<string, any>, dependencyResult: any): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(parameters)) {
      if (typeof value === 'string' && value.startsWith('$result.')) {
        const path = value.slice(8);
        result[key] = this.getNestedValue(dependencyResult, path);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async executeTool(toolId: string, parameters: Record<string, any>, timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`工具调用超时 (${timeout}ms)`));
      }, timeout);

      setTimeout(() => {
        clearTimeout(timer);
        
        const mockResults: Record<string, any> = {
          search: { results: ['搜索结果1', '搜索结果2', '搜索结果3'] },
          calculate: { result: 42 },
          weather: { temperature: 25, condition: 'sunny' },
          database: { rows: [{ id: 1, name: 'test' }] },
          webhook: { status: 'sent' }
        };

        const category = toolId.toLowerCase();
        const result = mockResults[category] || mockResults.search || { success: true, data: parameters };
        
        resolve(result);
      }, 500 + Math.random() * 1500);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCallStatus(callId: string): ToolCall | undefined {
    return this.toolCalls.get(callId);
  }
}

// ==================== 示例工具定义 ====================

export const sampleTools: ToolDefinition[] = [
  {
    id: 'web_search',
    name: '网络搜索',
    description: '执行网络搜索，获取最新信息',
    category: 'search',
    parameters: [
      {
        name: 'query',
        description: '搜索关键词',
        schema: { type: 'string', minLength: 1, maxLength: 500 },
        required: true
      },
      {
        name: 'count',
        description: '返回结果数量',
        schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
        required: false
      }
    ],
    returnType: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              url: { type: 'string', format: 'uri' },
              snippet: { type: 'string' }
            }
          }
        }
      }
    },
    examples: [
      {
        input: { query: 'AI Agent 最新进展' },
        output: { results: [{ title: 'AI Agent 概述', url: 'https://example.com', snippet: 'AI Agent 是...' }] }
      }
    ],
    tags: ['搜索', '信息', 'web'],
    enabled: true,
    usageCount: 1245
  },
  {
    id: 'database_query',
    name: '数据库查询',
    description: '执行数据库查询操作',
    category: 'database',
    parameters: [
      {
        name: 'query',
        description: 'SQL查询语句',
        schema: { type: 'string', minLength: 1 },
        required: true
      },
      {
        name: 'params',
        description: '查询参数',
        schema: { type: 'object' },
        required: false
      }
    ],
    returnType: {
      type: 'object',
      properties: {
        rows: { type: 'array', items: { type: 'object' } },
        count: { type: 'integer' }
      }
    },
    tags: ['数据库', 'SQL', '查询'],
    enabled: true,
    usageCount: 892
  },
  {
    id: 'calculator',
    name: '计算器',
    description: '执行数学计算',
    category: 'utility',
    parameters: [
      {
        name: 'expression',
        description: '数学表达式',
        schema: { type: 'string', pattern: '^[\\d+\\-*/().\\s]+$' },
        required: true
      }
    ],
    returnType: {
      type: 'object',
      properties: {
        result: { type: 'number' },
        expression: { type: 'string' }
      }
    },
    tags: ['计算', '数学', '工具'],
    enabled: true,
    usageCount: 2341
  },
  {
    id: 'weather',
    name: '天气查询',
    description: '获取指定地点的天气信息',
    category: 'api',
    parameters: [
      {
        name: 'city',
        description: '城市名称',
        schema: { type: 'string', minLength: 1 },
        required: true
      },
      {
        name: 'unit',
        description: '温度单位',
        schema: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'celsius' },
        required: false
      }
    ],
    returnType: {
      type: 'object',
      properties: {
        temperature: { type: 'number' },
        condition: { type: 'string' },
        humidity: { type: 'number' },
        windSpeed: { type: 'number' }
      }
    },
    tags: ['天气', 'API', '查询'],
    enabled: true,
    usageCount: 567
  },
  {
    id: 'email_send',
    name: '发送邮件',
    description: '发送电子邮件',
    category: 'communication',
    parameters: [
      {
        name: 'to',
        description: '收件人邮箱',
        schema: { type: 'string', format: 'email' },
        required: true
      },
      {
        name: 'subject',
        description: '邮件主题',
        schema: { type: 'string', minLength: 1 },
        required: true
      },
      {
        name: 'body',
        description: '邮件正文',
        schema: { type: 'string' },
        required: true
      }
    ],
    returnType: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        messageId: { type: 'string' }
      }
    },
    tags: ['邮件', '发送', '通知'],
    enabled: true,
    usageCount: 123
  }
];

// ==================== 导出单例 ====================

export const toolRegistry = new ToolRegistry();
export const toolRetriever = new ToolRetriever(toolRegistry);
export const toolExecutor = new ToolExecutor(toolRegistry);

sampleTools.forEach(tool => toolRegistry.registerTool(tool));

export default {
  ToolRegistry,
  ToolRetriever,
  ToolExecutor,
  toolRegistry,
  toolRetriever,
  toolExecutor,
  sampleTools
};
