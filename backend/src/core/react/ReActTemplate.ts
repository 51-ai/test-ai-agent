/**
 * ReAct结构化提示词模板系统
 * 
 * 核心目标：
 * - 强制模型按"思考→行动→结果→反思"固定格式输出
 * - 提升工具调用准确率50%
 * - 降低格式错误率80%
 * 
 * @module core/react
 */

export interface ReActStep {
  thought: string;        // 思考过程：分析当前状态，确定下一步行动
  action: string | null;  // 工具名称（如 web_search, code_executor）
  actionInput: Record<string, any> | null; // 工具参数
  observation: string | null; // 工具返回结果
  reflection: string | null;  // 反思总结：评估结果，决定是否继续
}

export interface ReActTrace {
  taskId: string;
  goal: string;
  steps: ReActStep[];
  finalAnswer: string;
  success: boolean;
  totalSteps: number;
  toolCalls: number;
  executionTime: number;
}

export interface ReActPromptConfig {
  maxIterations: number;
  availableTools: string[];
  toolDescriptions: Record<string, ToolDescription>;
  language: 'zh' | 'en';
}

export interface ToolDescription {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required: boolean;
    default?: any;
  }>;
  returns: string;
}

export class ReActTemplate {
  private config: ReActPromptConfig;
  private stepCounter = 0;

  constructor(config?: Partial<ReActPromptConfig>) {
    this.config = {
      maxIterations: 10,
      availableTools: [
        'web_search',
        'code_executor',
        'document_tool',
        'data_analysis',
        'cloud_service'
      ],
      toolDescriptions: this.getDefaultToolDescriptions(),
      language: 'zh',
      ...config
    };
  }

  /**
   * 生成完整的ReAct提示词
   */
  generatePrompt(goal: string, context?: string): string {
    const toolSection = this.generateToolSection();
    const formatSection = this.generateFormatSection();
    const exampleSection = this.generateExampleSection();
    
    const language = this.config.language === 'zh' ? this.getZhPrompt() : this.getEnPrompt();
    
    return `
${language.header}

**目标**: ${goal}
${context ? `\n**上下文**: ${context}` : ''}

---

## 可用工具
${toolSection}

---

## 输出格式规范
${formatSection}

---

## 示例演示
${exampleSection}

---

现在请开始执行任务。严格按照上述格式输出每一步。
`;
  }

  /**
   * 解析ReAct响应
   */
  parseResponse(response: string): ReActStep[] {
    const steps: ReActStep[] = [];
    const lines = response.split('\n');
    
    let currentStep: Partial<ReActStep> = {};
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // 解析思考部分
      if (trimmedLine.startsWith('思考:') || trimmedLine.startsWith('Thought:')) {
        if (currentStep.thought) {
          steps.push(this.completeStep(currentStep));
          currentStep = {};
        }
        currentStep.thought = trimmedLine.replace(/^(思考:|Thought:)\s*/, '');
      }
      
      // 解析行动部分
      else if (trimmedLine.startsWith('行动:') || trimmedLine.startsWith('Action:')) {
        currentStep.action = trimmedLine.replace(/^(行动:|Action:)\s*/, '');
      }
      
      // 解析行动输入部分
      else if (trimmedLine.startsWith('行动输入:') || trimmedLine.startsWith('Action Input:')) {
        const inputStr = trimmedLine.replace(/^(行动输入:|Action Input:)\s*/, '');
        try {
          currentStep.actionInput = JSON.parse(inputStr);
        } catch {
          currentStep.actionInput = { query: inputStr };
        }
      }
      
      // 解析观察部分
      else if (trimmedLine.startsWith('观察:') || trimmedLine.startsWith('Observation:')) {
        currentStep.observation = trimmedLine.replace(/^(观察:|Observation:)\s*/, '');
      }
      
      // 解析反思部分
      else if (trimmedLine.startsWith('反思:') || trimmedLine.startsWith('Reflection:')) {
        currentStep.reflection = trimmedLine.replace(/^(反思:|Reflection:)\s*/, '');
        steps.push(this.completeStep(currentStep));
        currentStep = {};
      }
      
      // 解析最终答案
      else if (trimmedLine.startsWith('最终答案:') || trimmedLine.startsWith('Final Answer:')) {
        // 标记任务完成
        const finalStep: ReActStep = {
          thought: '任务已完成，输出最终答案',
          action: null,
          actionInput: null,
          observation: trimmedLine.replace(/^(最终答案:|Final Answer:)\s*/, ''),
          reflection: '任务执行成功'
        };
        steps.push(finalStep);
      }
      
      // 处理多行内容
      else if (trimmedLine && currentStep.observation) {
        currentStep.observation += '\n' + trimmedLine;
      }
    }
    
    // 处理未完成的步骤
    if (currentStep.thought) {
      steps.push(this.completeStep(currentStep));
    }
    
    return steps;
  }

  /**
   * 格式化ReAct步骤为输出字符串
   */
  formatStep(step: ReActStep): string {
    const lang = this.config.language;
    const prefix = lang === 'zh' ? {
      thought: '思考:',
      action: '行动:',
      actionInput: '行动输入:',
      observation: '观察:',
      reflection: '反思:'
    } : {
      thought: 'Thought:',
      action: 'Action:',
      actionInput: 'Action Input:',
      observation: 'Observation:',
      reflection: 'Reflection:'
    };
    
    let output = `${prefix.thought} ${step.thought}\n`;
    
    if (step.action) {
      output += `${prefix.action} ${step.action}\n`;
      output += `${prefix.actionInput} ${JSON.stringify(step.actionInput || {})}\n`;
    }
    
    if (step.observation) {
      output += `${prefix.observation} ${step.observation}\n`;
    }
    
    if (step.reflection) {
      output += `${prefix.reflection} ${step.reflection}\n`;
    }
    
    return output;
  }

  /**
   * 生成工具描述部分
   */
  private generateToolSection(): string {
    const descriptions: string[] = [];
    
    for (const toolName of this.config.availableTools) {
      const tool = this.config.toolDescriptions[toolName];
      if (tool) {
        const params = Object.entries(tool.parameters)
          .map(([name, param]) => {
            const required = param.required ? '(必需)' : '(可选)';
            return `  - ${name}: ${param.type} ${required} - ${param.description}`;
          })
          .join('\n');
        
        descriptions.push(`
### ${tool.name}
${tool.description}

参数:
${params}

返回: ${tool.returns}
`);
      }
    }
    
    return descriptions.join('\n---\n');
  }

  /**
   * 生成格式规范部分
   */
  private generateFormatSection(): string {
    if (this.config.language === 'zh') {
      return `
每一步必须严格遵循以下格式：

思考: [分析当前状态，确定下一步行动]
行动: [工具名称，如 web_search]
行动输入: {"参数名": "参数值"}
观察: [工具返回的结果]
反思: [评估结果，决定是否继续或输出最终答案]

最终答案: [任务完成后的最终输出]

**重要规则**:
1. 每次只能调用一个工具
2. 行动输入必须是有效的JSON格式
3. 如果认为任务已完成，输出"最终答案:"
4. 最多执行 ${this.config.maxIterations} 个步骤
5. 如果工具调用失败，在反思中说明原因并尝试替代方案
`;
    }
    
    return `
Each step must strictly follow this format:

Thought: [Analyze current state, determine next action]
Action: [Tool name, e.g., web_search]
Action Input: {"param_name": "param_value"}
Observation: [Tool returned result]
Reflection: [Evaluate result, decide whether to continue or output final answer]

Final Answer: [Final output after task completion]

**Important Rules**:
1. Only one tool call per step
2. Action Input must be valid JSON
3. If task is complete, output "Final Answer:"
4. Maximum ${this.config.maxIterations} steps
5. If tool call fails, explain in reflection and try alternative
`;
  }

  /**
   * 生成示例部分
   */
  private generateExampleSection(): string {
    if (this.config.language === 'zh') {
      return `
**示例任务**: 搜索2024年诺贝尔物理学奖获得者

思考: 用户想了解2024年诺贝尔物理学奖获得者，需要搜索最新信息
行动: web_search
行动输入: {"query": "2024年诺贝尔物理学奖获得者", "numResults": 5}
观察: [搜索结果: 2024年诺贝尔物理学奖授予John Hopfield和Geoffrey Hinton...]
反思: 已获取所需信息，可以输出最终答案
最终答案: 2024年诺贝尔物理学奖获得者是John Hopfield和Geoffrey Hinton，他们在人工智能和神经网络领域做出了开创性贡献。
`;
    }
    
    return `
**Example Task**: Search for 2024 Nobel Physics Prize winners

Thought: User wants to know 2024 Nobel Physics Prize winners, need to search latest info
Action: web_search
Action Input: {"query": "2024 Nobel Physics Prize winners", "numResults": 5}
Observation: [Search results: 2024 Nobel Physics Prize awarded to John Hopfield and Geoffrey Hinton...]
Reflection: Got required information, can output final answer
Final Answer: The 2024 Nobel Physics Prize winners are John Hopfield and Geoffrey Hinton for their pioneering work in AI and neural networks.
`;
  }

  /**
   * 获取中文提示词头部
   */
  private getZhPrompt(): { header: string } {
    return {
      header: `
# ReAct智能体框架

你是一个具备ReAct能力的AI智能体。ReAct代表"推理+行动"，是一种将推理和行动紧密结合的方法。

**核心能力**:
1. **推理(Reasoning)**: 分析问题，制定计划，评估结果
2. **行动(Acting)**: 调用工具，执行操作，获取信息
3. **反思(Reflection)**: 评估执行结果，调整策略

**执行流程**:
- 思考 → 行动 → 观察 → 反思 → [继续或完成]
`
    };
  }

  /**
   * 获取英文提示词头部
   */
  private getEnPrompt(): { header: string } {
    return {
      header: `
# ReAct Agent Framework

You are an AI agent with ReAct capabilities. ReAct stands for "Reasoning + Acting", a method that tightly integrates reasoning and action.

**Core Capabilities**:
1. **Reasoning**: Analyze problems, make plans, evaluate results
2. **Acting**: Call tools, execute operations, get information
3. **Reflection**: Evaluate execution results, adjust strategy

**Execution Flow**:
- Thought → Action → Observation → Reflection → [Continue or Complete]
`
    };
  }

  /**
   * 获取默认工具描述
   */
  private getDefaultToolDescriptions(): Record<string, ToolDescription> {
    return {
      web_search: {
        name: 'web_search',
        description: '网络搜索工具，用于获取实时信息和最新数据',
        parameters: {
          query: { type: 'string', description: '搜索关键词', required: true },
          numResults: { type: 'number', description: '返回结果数量', required: false, default: 5 }
        },
        returns: '搜索结果列表，包含标题、摘要、链接'
      },
      code_executor: {
        name: 'code_executor',
        description: '代码执行工具，支持Python和JavaScript的安全沙箱执行',
        parameters: {
          code: { type: 'string', description: '要执行的代码', required: true },
          language: { type: 'string', description: '编程语言(python/javascript)', required: false, default: 'javascript' }
        },
        returns: '代码执行结果'
      },
      document_tool: {
        name: 'document_tool',
        description: '文档处理工具，支持PDF/Word/Excel文件的读取和解析',
        parameters: {
          action: { type: 'string', description: '操作类型(read/write/parse)', required: true },
          fileName: { type: 'string', description: '文件名', required: true },
          content: { type: 'string', description: '内容(用于write操作)', required: false }
        },
        returns: '文档内容或操作结果'
      },
      data_analysis: {
        name: 'data_analysis',
        description: '数据分析工具，支持SQL查询与数据可视化',
        parameters: {
          query: { type: 'string', description: '分析查询', required: true },
          dataset: { type: 'string', description: '数据集名称', required: false }
        },
        returns: '分析结果和可视化数据'
      },
      cloud_service: {
        name: 'cloud_service',
        description: '云服务工具，支持AWS和Azure的常用操作',
        parameters: {
          service: { type: 'string', description: '云服务商(aws/azure)', required: true },
          action: { type: 'string', description: '操作类型', required: true },
          resource: { type: 'string', description: '资源类型', required: true }
        },
        returns: '云服务操作结果'
      }
    };
  }

  /**
   * 完成步骤构建
   */
  private completeStep(partial: Partial<ReActStep>): ReActStep {
    return {
      thought: partial.thought || '',
      action: partial.action || null,
      actionInput: partial.actionInput || null,
      observation: partial.observation || null,
      reflection: partial.reflection || null
    };
  }

  /**
   * 创建ReAct执行轨迹
   */
  createTrace(goal: string, steps: ReActStep[], success: boolean): ReActTrace {
    const toolCalls = steps.filter(s => s.action !== null).length;
    const finalAnswer = steps.find(s => s.observation && s.action === null)?.observation || '';
    
    return {
      taskId: `react_${Date.now()}_${++this.stepCounter}`,
      goal,
      steps,
      finalAnswer,
      success,
      totalSteps: steps.length,
      toolCalls,
      executionTime: 0
    };
  }

  /**
   * 验证步骤格式
   */
  validateStep(step: ReActStep): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!step.thought || step.thought.trim().length < 5) {
      errors.push('思考内容过短或缺失');
    }
    
    if (step.action && !this.config.availableTools.includes(step.action)) {
      errors.push(`未知工具: ${step.action}`);
    }
    
    if (step.action && !step.actionInput) {
      errors.push('工具调用缺少参数');
    }
    
    if (step.action && step.actionInput) {
      try {
        JSON.stringify(step.actionInput);
      } catch {
        errors.push('工具参数不是有效的JSON');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 获取配置
   */
  getConfig(): ReActPromptConfig {
    return this.config;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ReActPromptConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 添加自定义工具描述
   */
  addToolDescription(tool: ToolDescription): void {
    this.config.toolDescriptions[tool.name] = tool;
    if (!this.config.availableTools.includes(tool.name)) {
      this.config.availableTools.push(tool.name);
    }
  }
}

export default ReActTemplate;