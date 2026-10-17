import { z } from 'zod';

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  enum?: string[];
  default?: any;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  returns: string;
  category: string;
  enabled: boolean;
}

export interface ToolCall {
  toolName: string;
  parameters: Record<string, any>;
  id: string;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  result: any;
  error?: string;
  executionTime: number;
}

export interface ToolMetadata {
  callCount: number;
  successCount: number;
  totalExecutionTime: number;
  lastUsed: number;
}

export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract parameters: ToolParameter[];
  abstract returns: string;
  abstract category: string;

  async execute(parameters: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      const validation = this.validateParameters(parameters);
      if (!validation.valid) {
        return {
          toolCallId: parameters.__callId || 'unknown',
          success: false,
          result: null,
          error: validation.error,
          executionTime: Date.now() - startTime
        };
      }

      const result = await this._execute(parameters);
      return {
        toolCallId: parameters.__callId || 'unknown',
        success: true,
        result,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        toolCallId: parameters.__callId || 'unknown',
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  protected abstract _execute(parameters: Record<string, any>): Promise<any>;

  validateParameters(parameters: Record<string, any>): { valid: boolean; error?: string } {
    const schema = this.buildSchema();
    const result = schema.safeParse(parameters);
    
    if (!result.success) {
      return {
        valid: false,
        error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
      };
    }
    return { valid: true };
  }

  private buildSchema(): z.ZodObject<any> {
    const shape: Record<string, z.ZodTypeAny> = {};
    
    for (const param of this.parameters) {
      let type: z.ZodTypeAny;
      
      switch (param.type) {
        case 'string':
          type = param.enum 
            ? z.enum(param.enum as [string, ...string[]])
            : z.string();
          break;
        case 'number':
          type = z.number();
          break;
        case 'boolean':
          type = z.boolean();
          break;
        case 'array':
          type = z.array(z.any());
          break;
        case 'object':
          type = z.object({});
          break;
        default:
          type = z.any();
      }
      
      shape[param.name] = param.required ? type : type.optional();
    }
    
    return z.object(shape);
  }

  toDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
      returns: this.returns,
      category: this.category,
      enabled: true
    };
  }
}

export class ToolManager {
  private tools: Map<string, BaseTool> = new Map();
  private metadata: Map<string, ToolMetadata> = new Map();
  private enabledTools: Set<string> = new Set();

  registerTool(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
    this.enabledTools.add(tool.name);
    this.metadata.set(tool.name, {
      callCount: 0,
      successCount: 0,
      totalExecutionTime: 0,
      lastUsed: 0
    });
  }

  unregisterTool(toolName: string): void {
    this.tools.delete(toolName);
    this.enabledTools.delete(toolName);
    this.metadata.delete(toolName);
  }

  enableTool(toolName: string): void {
    if (this.tools.has(toolName)) {
      this.enabledTools.add(toolName);
    }
  }

  disableTool(toolName: string): void {
    this.enabledTools.delete(toolName);
  }

  async callTool(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.toolName);
    
    if (!tool) {
      return {
        toolCallId: toolCall.id,
        success: false,
        result: null,
        error: `Tool ${toolCall.toolName} not found`,
        executionTime: 0
      };
    }

    if (!this.enabledTools.has(toolCall.toolName)) {
      return {
        toolCallId: toolCall.id,
        success: false,
        result: null,
        error: `Tool ${toolCall.toolName} is disabled`,
        executionTime: 0
      };
    }

    const meta = this.metadata.get(toolCall.toolName)!;
    meta.callCount++;
    meta.lastUsed = Date.now();

    const result = await tool.execute({ ...toolCall.parameters, __callId: toolCall.id });
    
    if (result.success) {
      meta.successCount++;
    }
    meta.totalExecutionTime += result.executionTime;

    return result;
  }

  async callToolsParallel(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const promises = toolCalls.map(call => this.callTool(call));
    return Promise.all(promises);
  }

  getToolDefinition(toolName: string): ToolDefinition | null {
    const tool = this.tools.get(toolName);
    return tool ? tool.toDefinition() : null;
  }

  getEnabledTools(): ToolDefinition[] {
    return Array.from(this.enabledTools)
      .map(name => this.getToolDefinition(name))
      .filter((t): t is ToolDefinition => t !== null);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values())
      .map(tool => tool.toDefinition());
  }

  searchTools(query: string): ToolDefinition[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.tools.values())
      .filter(tool => 
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery) ||
        tool.category.toLowerCase().includes(lowerQuery)
      )
      .map(tool => tool.toDefinition())
      .slice(0, 5);
  }

  getToolMetadata(toolName: string): ToolMetadata | null {
    return this.metadata.get(toolName) || null;
  }

  getAllMetadata(): Map<string, ToolMetadata> {
    return new Map(this.metadata);
  }

  getStats(): {
    totalTools: number;
    enabledTools: number;
    totalCalls: number;
    successRate: number;
    avgExecutionTime: number;
  } {
    const totalCalls = Array.from(this.metadata.values())
      .reduce((acc, m) => acc + m.callCount, 0);
    const successCalls = Array.from(this.metadata.values())
      .reduce((acc, m) => acc + m.successCount, 0);
    const totalTime = Array.from(this.metadata.values())
      .reduce((acc, m) => acc + m.totalExecutionTime, 0);

    return {
      totalTools: this.tools.size,
      enabledTools: this.enabledTools.size,
      totalCalls,
      successRate: totalCalls > 0 ? successCalls / totalCalls : 0,
      avgExecutionTime: totalCalls > 0 ? totalTime / totalCalls : 0
    };
  }
}