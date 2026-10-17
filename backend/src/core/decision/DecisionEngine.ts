import { Task, Subtask, ToolCall } from '../../types';
import { v4 as uuidv4 } from 'uuid';

const LOG_PREFIX = '[DecisionEngine]';

// === 工作流相关类型定义（用于复杂工作流引擎） ===
type WorkflowNode =
  | { type: 'stage'; name: string; action: (ctx: WorkflowContext) => Promise<unknown>; description?: string }
  | { type: 'condition'; condition: (ctx: WorkflowContext) => boolean; trueBranch: WorkflowNode[]; falseBranch?: WorkflowNode[] }
  | { type: 'parallel'; branches: WorkflowNode[][]; failFast?: boolean }
  | { type: 'loop'; iterable: (ctx: WorkflowContext) => unknown[]; body: WorkflowNode[]; maxIterations?: number }
  | { type: 'retry'; body: WorkflowNode[]; strategy: string; maxRetries?: number }
  | { type: 'compensation'; action: (ctx: WorkflowContext) => Promise<void> }
  | { type: 'rollback'; reason?: string };

interface WorkflowContext {
  task?: Task;
  variables: Record<string, unknown>;
  results: Map<string, unknown>;
  executionLog: Array<{ step: string; status: string; timestamp: Date; data?: unknown }>;
  iterationIndex?: number;
  depth: number;
}

// 资源池类型定义
interface ResourcePool {
  computeUnits: number;
  memoryMB: number;
  networkBandwidth: number;
  toolSlots: number;
}

interface ScoredSubtask {
  subtask: Subtask;
  score: number;
}

type DecisionStrategy = 'conservative' | 'balanced' | 'aggressive' | 'creative';
type TaskComplexity = 'simple' | 'medium' | 'complex' | 'compound';

export class DecisionEngine {
  private taskPrioritizationWeights = {
    urgency: 0.4,
    complexity: 0.3,
    userPreference: 0.3
  };
  private currentStrategy: DecisionStrategy = 'balanced';
  private strategyConfigs: Record<DecisionStrategy, {
    timeoutMultiplier: number;
    retryCount: number;
    parallelThreshold: number;
  }> = {
    conservative: { timeoutMultiplier: 2, retryCount: 5, parallelThreshold: 1 },
    balanced: { timeoutMultiplier: 1, retryCount: 3, parallelThreshold: 3 },
    aggressive: { timeoutMultiplier: 0.5, retryCount: 1, parallelThreshold: 5 },
    creative: { timeoutMultiplier: 1.5, retryCount: 2, parallelThreshold: 2 }
  };

  // === 增强：任务意图识别模式（更全面）===
  private intentPatterns: {
    key: string;
    keywords: string[];
    handler: (description: string) => Subtask[];
    complexity: TaskComplexity;
  }[] = [
    {
      key: 'search',
      keywords: ['搜索', '查找', '查询', 'find', 'search', '查一下', '搜索一下', '搜一下'],
      handler: this.createSearchSubtasks.bind(this),
      complexity: 'medium'
    },
    {
      key: 'calculate',
      keywords: ['计算', '算', 'calculate', 'compute', '等于', '算一下', '计算一下'],
      handler: this.createCalculateSubtasks.bind(this),
      complexity: 'simple'
    },
    {
      key: 'summarize',
      keywords: ['总结', '概括', 'summarize', 'summary', '概括一下', '总结一下', '摘要'],
      handler: this.createSummarizeSubtasks.bind(this),
      complexity: 'medium'
    },
    {
      key: 'explain',
      keywords: ['解释', '说明', 'explain', '解释一下', '说明一下', '什么是', '是什么', '介绍一下'],
      handler: this.createExplainSubtasks.bind(this),
      complexity: 'medium'
    },
    {
      key: 'code',
      keywords: ['代码', '编程', '程序', 'code', 'python', 'javascript', 'java', 'java', '写代码'],
      handler: this.createCodeSubtasks.bind(this),
      complexity: 'complex'
    },
    {
      key: 'analyze',
      keywords: ['分析', 'analyze', '研究', '分析一下', '研究一下'],
      handler: this.createAnalyzeSubtasks.bind(this),
      complexity: 'complex'
    },
    {
      key: 'debug',
      keywords: ['调试', 'debug', '修复', 'fix', '修复一下', '排查'],
      handler: this.createDebugSubtasks.bind(this),
      complexity: 'complex'
    },
    {
      key: 'write',
      keywords: ['写', '写作', 'write', '撰写', '创作', '写文章', '写邮件', '写封信', '写首诗'],
      handler: this.createWriteSubtasks.bind(this),
      complexity: 'medium'
    },
    {
      key: 'translate',
      keywords: ['翻译', 'translate', '译成', '翻译成', '翻译一下'],
      handler: this.createTranslateSubtasks.bind(this),
      complexity: 'simple'
    },
    {
      key: 'learn',
      keywords: ['学习', 'learn', '教程', 'tutorial', '教我', '怎么学', '如何学习', '学一下'],
      handler: this.createLearningSubtasks.bind(this),
      complexity: 'medium'
    },
    {
      key: 'optimize',
      keywords: ['优化', 'optimize', '改进', 'improve', '提升', '性能优化', '优化一下'],
      handler: this.createOptimizeSubtasks.bind(this),
      complexity: 'complex'
    },
    {
      key: 'plan',
      keywords: ['计划', '规划', 'plan', '制定计划', '做计划', '安排'],
      handler: this.createPlanSubtasks.bind(this),
      complexity: 'medium'
    },
    {
      key: 'design',
      keywords: ['设计', 'design', '架构', '方案', '设计方案', '架构设计'],
      handler: this.createDesignSubtasks.bind(this),
      complexity: 'complex'
    },
    {
      key: 'review',
      keywords: ['审查', '检查', 'review', '审查一下', '检查一下', 'review一下'],
      handler: this.createReviewSubtasks.bind(this),
      complexity: 'medium'
    },
    {
      key: 'question',
      keywords: ['问题', '提问', 'question', '帮我', '帮助'],
      handler: this.createQuestionSubtasks.bind(this),
      complexity: 'medium'
    },
  ];

  decomposeTask(taskDescription: string, userId: string): Task {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [TASK_DECOMPOSE_START] userId=${userId}, description="${taskDescription.slice(0, 50)}..."`);

    const subtasks = this.generateSubtasks(taskDescription);
    const task: Task = {
      id: uuidv4(),
      userId,
      description: taskDescription,
      status: 'pending',
      priority: this.calculatePriority(subtasks),
      subtasks,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const elapsed = Date.now() - startTime;
    console.log(`${LOG_PREFIX} [TASK_DECOMPOSE_END] taskId=${task.id}, priority=${task.priority}, subtasksCount=${subtasks.length}, elapsed=${elapsed}ms`);

    return task;
  }

  private generateSubtasks(description: string): Subtask[] {
    const subtasks: Subtask[] = [];
    const detectedIntents: string[] = [];

    for (const { key, keywords, handler } of this.intentPatterns) {
      if (keywords.some(kw => description.toLowerCase().includes(kw.toLowerCase()))) {
        detectedIntents.push(key);
        const newSubtasks = handler(description);
        const existingDescriptions = new Set(subtasks.map(s => s.description));

        for (const st of newSubtasks) {
          if (!existingDescriptions.has(st.description)) {
            subtasks.push(st);
          }
        }
      }
    }

    if (detectedIntents.length === 0) {
      console.log(`${LOG_PREFIX} [INTENT_DETECTED] intent=unknown, using default response`);
      subtasks.push({ id: uuidv4(), description: '理解用户需求', status: 'pending' });
      subtasks.push({ id: uuidv4(), description: '分析问题关键点', status: 'pending' });
      subtasks.push({ id: uuidv4(), description: '提供有针对性的回复', status: 'pending' });
    } else {
      console.log(`${LOG_PREFIX} [INTENT_DETECTED] intents=[${detectedIntents.join(', ')}]`);
    }

    console.log(`${LOG_PREFIX} [GENERATE_SUBTASKS_END] generated ${subtasks.length} subtasks`);
    return subtasks;
  }

  // === 增强的子任务生成器：更智能、更具体 ===
  private createSearchSubtasks(description: string): Subtask[] {
    const query = description.replace(/搜索|查找|查询|find|search|查一下|搜索一下|搜一下/gi, '').trim();
    return [
      { id: uuidv4(), description: `分析搜索意图：${query}`, status: 'pending' },
      { id: uuidv4(), description: `提取关键词：${query}`, status: 'pending' },
      {
        id: uuidv4(),
        description: `执行网络搜索：${query}`,
        status: 'pending',
        toolName: 'web_search',
        parameters: { query }
      },
      { id: uuidv4(), description: '过滤和排序搜索结果', status: 'pending' },
      { id: uuidv4(), description: '整理并总结搜索结果', status: 'pending' },
      { id: uuidv4(), description: '提供相关的背景信息', status: 'pending' },
    ];
  }

  private createCalculateSubtasks(description: string): Subtask[] {
    const expressionMatch = description.match(/[\d\.\+\-\*\/\×\÷\(\)\s]+/);
    const expression = expressionMatch ? expressionMatch[0].trim() : '';

    return [
      { id: uuidv4(), description: '解析和验证数学表达式', status: 'pending' },
      { id: uuidv4(), description: `分析表达式类型：${expression || '检测中'}`, status: 'pending' },
      {
        id: uuidv4(),
        description: `执行计算：${expression || '待确定'}`,
        status: 'pending',
        toolName: 'code_executor',
        parameters: { code: expression || '计算表达式', language: 'python' }
      },
      { id: uuidv4(), description: '验证计算结果的正确性', status: 'pending' },
      { id: uuidv4(), description: '格式化和展示最终结果', status: 'pending' },
    ];
  }

  private createSummarizeSubtasks(description: string): Subtask[] {
    return [
      { id: uuidv4(), description: '收集和获取相关内容', status: 'pending' },
      { id: uuidv4(), description: '提取关键信息和要点', status: 'pending' },
      { id: uuidv4(), description: '识别核心主题和观点', status: 'pending' },
      { id: uuidv4(), description: '组织信息结构和层次', status: 'pending' },
      { id: uuidv4(), description: '生成简洁的总结', status: 'pending' },
      { id: uuidv4(), description: '检查总结的完整性和准确性', status: 'pending' },
    ];
  }

  private createExplainSubtasks(description: string): Subtask[] {
    const topic = description
      .replace(/解释|说明|explain|解释一下|说明一下|什么是|是什么|介绍一下|介绍|讲解/gi, '')
      .trim();

    return [
      { id: uuidv4(), description: `确定解释主题：${topic || '待分析'}`, status: 'pending' },
      { id: uuidv4(), description: '收集相关知识和信息', status: 'pending' },
      { id: uuidv4(), description: '分析主题的核心概念', status: 'pending' },
      {
        id: uuidv4(),
        description: `搜索相关资料：${topic || '待分析'}`,
        status: 'pending',
        toolName: 'web_search',
        parameters: { query: topic || '相关主题' }
      },
      { id: uuidv4(), description: '组织解释结构（从简单到复杂）', status: 'pending' },
      { id: uuidv4(), description: '提供详细解释和例子', status: 'pending' },
      { id: uuidv4(), description: '补充实际应用和注意事项', status: 'pending' },
    ];
  }

  private createCodeSubtasks(description: string): Subtask[] {
    const langMatch = description.match(/python|javascript|java|c\+\+|go|rust|typescript|node\.js|react|vue/i);
    const language = langMatch ? langMatch[0].toLowerCase() : 'general';

    return [
      { id: uuidv4(), description: `理解代码需求和目标：${language}`, status: 'pending' },
      { id: uuidv4(), description: '分析具体需求和约束条件', status: 'pending' },
      { id: uuidv4(), description: '设计代码架构和结构', status: 'pending' },
      {
        id: uuidv4(),
        description: `编写${language}代码`,
        status: 'pending',
        toolName: 'code_executor',
        parameters: { code: '代码编写中', language }
      },
      { id: uuidv4(), description: '审查代码质量和最佳实践', status: 'pending' },
      { id: uuidv4(), description: '添加注释和说明', status: 'pending' },
      { id: uuidv4(), description: '测试代码逻辑和功能', status: 'pending' },
      { id: uuidv4(), description: '提供使用示例和说明', status: 'pending' },
    ];
  }

  private createAnalyzeSubtasks(description: string): Subtask[] {
    return [
      { id: uuidv4(), description: '明确分析目标和范围', status: 'pending' },
      { id: uuidv4(), description: '收集相关数据和信息', status: 'pending' },
      {
        id: uuidv4(),
        description: '执行数据处理和分析',
        status: 'pending',
        toolName: 'data_analysis',
        parameters: {}
      },
      { id: uuidv4(), description: '识别关键模式和趋势', status: 'pending' },
      { id: uuidv4(), description: '验证分析结果的可靠性', status: 'pending' },
      { id: uuidv4(), description: '生成分析报告和结论', status: 'pending' },
      { id: uuidv4(), description: '提供可行的建议和方案', status: 'pending' },
    ];
  }

  private createDebugSubtasks(description: string): Subtask[] {
    return [
      { id: uuidv4(), description: '复现并理解问题', status: 'pending' },
      { id: uuidv4(), description: '分析错误日志和症状', status: 'pending' },
      { id: uuidv4(), description: '定位问题根源', status: 'pending' },
      {
        id: uuidv4(),
        description: '设计并实现修复方案',
        status: 'pending',
        toolName: 'code_executor',
        parameters: {}
      },
      { id: uuidv4(), description: '验证修复的有效性', status: 'pending' },
      { id: uuidv4(), description: '记录问题和解决方案', status: 'pending' },
      { id: uuidv4(), description: '提供预防建议', status: 'pending' },
    ];
  }

  private createWriteSubtasks(description: string): Subtask[] {
    const contentMatch = description.match(/邮件|信|文章|报告|诗|歌|作文|文案/);
    const contentType = contentMatch ? contentMatch[0] : '内容';

    return [
      { id: uuidv4(), description: `分析写作需求：${contentType}`, status: 'pending' },
      { id: uuidv4(), description: '确定写作目标和受众', status: 'pending' },
      { id: uuidv4(), description: '收集素材和资料', status: 'pending' },
      { id: uuidv4(), description: '设计写作大纲和结构', status: 'pending' },
      { id: uuidv4(), description: '撰写初稿内容', status: 'pending' },
      { id: uuidv4(), description: '修改和润色内容', status: 'pending' },
      { id: uuidv4(), description: '检查语法和风格', status: 'pending' },
      { id: uuidv4(), description: '最终校对和完善', status: 'pending' },
    ];
  }

  private createTranslateSubtasks(description: string): Subtask[] {
    return [
      { id: uuidv4(), description: '确定源语言和目标语言', status: 'pending' },
      { id: uuidv4(), description: '提取需要翻译的内容', status: 'pending' },
      { id: uuidv4(), description: '分析内容类型和风格', status: 'pending' },
      {
        id: uuidv4(),
        description: '执行翻译',
        status: 'pending',
        toolName: 'code_executor',
        parameters: { code: 'translate', language: 'python' }
      },
      { id: uuidv4(), description: '校对和优化翻译结果', status: 'pending' },
      { id: uuidv4(), description: '确保文化和语境适配', status: 'pending' },
    ];
  }

  private createLearningSubtasks(description: string): Subtask[] {
    const topic = description
      .replace(/学习|learn|教程|tutorial|教我|怎么学|如何学习|学一下|入门/gi, '')
      .trim();

    return [
      { id: uuidv4(), description: `评估学习需求和目标：${topic || '待分析'}`, status: 'pending' },
      { id: uuidv4(), description: '了解学习者的当前水平', status: 'pending' },
      {
        id: uuidv4(),
        description: `搜索学习资源和材料`,
        status: 'pending',
        toolName: 'web_search',
        parameters: { query: topic || '学习资源' }
      },
      { id: uuidv4(), description: '设计学习路径和步骤', status: 'pending' },
      { id: uuidv4(), description: '组织和整理学习内容', status: 'pending' },
      { id: uuidv4(), description: '提供实践和练习建议', status: 'pending' },
      { id: uuidv4(), description: '推荐进一步学习的资源', status: 'pending' },
      { id: uuidv4(), description: '给出评估和检验方法', status: 'pending' },
    ];
  }

  private createOptimizeSubtasks(description: string): Subtask[] {
    return [
      { id: uuidv4(), description: '分析当前状况和性能瓶颈', status: 'pending' },
      { id: uuidv4(), description: '识别可优化的关键点', status: 'pending' },
      { id: uuidv4(), description: '设计优化方案和策略', status: 'pending' },
      { id: uuidv4(), description: '实施性能优化', status: 'pending', toolName: 'code_executor', parameters: {} },
      { id: uuidv4(), description: '对比优化前后的效果', status: 'pending' },
      { id: uuidv4(), description: '验证优化的有效性', status: 'pending' },
      { id: uuidv4(), description: '提供持续优化建议', status: 'pending' },
    ];
  }

  private createPlanSubtasks(description: string): Subtask[] {
    return [
      { id: uuidv4(), description: '明确计划目标和期望结果', status: 'pending' },
      { id: uuidv4(), description: '分析可用资源和约束条件', status: 'pending' },
      { id: uuidv4(), description: '拆分计划为可执行的步骤', status: 'pending' },
      { id: uuidv4(), description: '设定时间表和里程碑', status: 'pending' },
      { id: uuidv4(), description: '识别潜在风险和问题', status: 'pending' },
      { id: uuidv4(), description: '制定备选方案', status: 'pending' },
      { id: uuidv4(), description: '生成最终计划文档', status: 'pending' },
    ];
  }

  private createDesignSubtasks(description: string): Subtask[] {
    return [
      { id: uuidv4(), description: '理解设计需求和约束', status: 'pending' },
      { id: uuidv4(), description: '分析目标用户和使用场景', status: 'pending' },
      { id: uuidv4(), description: '进行需求分析和功能规划', status: 'pending' },
      { id: uuidv4(), description: '设计系统架构和组件', status: 'pending' },
      { id: uuidv4(), description: '评估技术选型和方案', status: 'pending' },
      { id: uuidv4(), description: '生成设计文档和说明', status: 'pending' },
      { id: uuidv4(), description: '评审和优化设计方案', status: 'pending' },
    ];
  }

  private createReviewSubtasks(description: string): Subtask[] {
    return [
      { id: uuidv4(), description: '理解审查目标和标准', status: 'pending' },
      { id: uuidv4(), description: '收集和准备审查材料', status: 'pending' },
      { id: uuidv4(), description: '逐项检查和评估', status: 'pending' },
      { id: uuidv4(), description: '识别问题和改进机会', status: 'pending' },
      { id: uuidv4(), description: '提供具体的反馈和建议', status: 'pending' },
      { id: uuidv4(), description: '生成审查报告', status: 'pending' },
    ];
  }

  private createQuestionSubtasks(description: string): Subtask[] {
    return [
      { id: uuidv4(), description: '理解用户的核心问题', status: 'pending' },
      { id: uuidv4(), description: '分析问题的关键点和上下文', status: 'pending' },
      { id: uuidv4(), description: '搜索相关信息和知识', status: 'pending', toolName: 'web_search', parameters: { query: description } },
      { id: uuidv4(), description: '综合信息并形成答案', status: 'pending' },
      { id: uuidv4(), description: '验证答案的准确性', status: 'pending' },
      { id: uuidv4(), description: '提供清晰、结构化的回答', status: 'pending' },
    ];
  }

  private calculatePriority(subtasks: Subtask[]): Task['priority'] {
    const complexity = subtasks.length;
    const hasToolCalls = subtasks.some(s => s.toolName);

    let priorityScore = complexity * 0.2;
    if (hasToolCalls) priorityScore += 0.3;

    let priority: Task['priority'];
    if (priorityScore >= 1.5) priority = 'high';
    else if (priorityScore >= 0.8) priority = 'medium';
    else priority = 'low';

    console.log(`${LOG_PREFIX} [PRIORITY_CALCULATED] complexity=${complexity}, score=${priorityScore.toFixed(2)}, priority=${priority}`);
    return priority;
  }

  prioritizeSubtasks(subtasks: Subtask[]): Subtask[] {
    console.log(`${LOG_PREFIX} [PRIORITIZE_SUBTASKS_START] inputCount=${subtasks.length}`);

    const scoredSubtasks: ScoredSubtask[] = subtasks.map(subtask => ({
      subtask,
      score: this.getSubtaskPriorityScore(subtask)
    }));

    scoredSubtasks.sort((a, b) => b.score - a.score);

    const result = scoredSubtasks.map(ss => ss.subtask);
    const scoreInfo = scoredSubtasks.map(ss => `${ss.subtask.description}: ${ss.score}`).join(', ');

    console.log(`${LOG_PREFIX} [PRIORITIZE_SUBTASKS_END] priorities: ${scoreInfo}`);
    return result;
  }

  private getSubtaskPriorityScore(subtask: Subtask): number {
    let score = 0;

    if (subtask.toolName) score += 0.5;

    const priorityKeywords = ['关键', '重要', '主要', '核心', '执行', '实施', '解决', '修复'];
    for (const kw of priorityKeywords) {
      if (subtask.description.includes(kw)) {
        score += 0.3;
        break;
      }
    }

    // 前置性任务优先级更高
    const earlyKeywords = ['分析', '理解', '确定', '提取', '收集', '识别', '评估'];
    for (const kw of earlyKeywords) {
      if (subtask.description.startsWith(kw) || subtask.description.includes(kw)) {
        score += 0.2;
        break;
      }
    }

    if (subtask.description.includes('立即') || subtask.description.includes('现在')) {
      score += 0.3;
    }

    return score;
  }

  planExecution(task: Task): ToolCall[] {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [PLAN_EXECUTION_START] taskId=${task.id}`);

    const toolCalls: ToolCall[] = [];
    const prioritizedSubtasks = this.prioritizeSubtasks(task.subtasks);
    const config = this.strategyConfigs[this.currentStrategy];

    for (const subtask of prioritizedSubtasks) {
      if (subtask.toolName) {
        const toolCall: ToolCall = {
          toolName: subtask.toolName,
          parameters: subtask.parameters || {},
          timeout: 30000 * config.timeoutMultiplier,
          retries: config.retryCount
        };
        toolCalls.push(toolCall);
        console.log(`${LOG_PREFIX} [TOOL_CALL_PLANNED] tool=${subtask.toolName}`);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`${LOG_PREFIX} [PLAN_EXECUTION_END] toolCallsCount=${toolCalls.length}, elapsed=${elapsed}ms`);

    return toolCalls;
  }

  updatePlan(task: Task, subtaskResults: Map<string, unknown>): Task {
    console.log(`${LOG_PREFIX} [UPDATE_PLAN_START] taskId=${task.id}`);

    const updatedSubtasks = task.subtasks.map(subtask => {
      const result = subtaskResults.get(subtask.id);
      if (result !== undefined) {
        return { ...subtask, status: 'completed' as const, result };
      }
      return subtask;
    });

    const allCompleted = updatedSubtasks.every(s => s.status === 'completed');
    const newStatus = allCompleted ? 'completed' : 'in_progress';

    return {
      ...task,
      subtasks: updatedSubtasks,
      status: newStatus,
      updatedAt: new Date()
    };
  }

  // === 新增：动态调整任务规划 ===
  adaptTaskPlan(task: Task, feedback: { success: boolean; message?: string }): Task {
    console.log(`${LOG_PREFIX} [ADAPT_TASK_PLAN] taskId=${task.id}, success=${feedback.success}`);

    const updatedSubtasks = [...task.subtasks];

    if (!feedback.success) {
      // 如果失败，添加额外的诊断和重试步骤
      const failedSubtasks = updatedSubtasks.filter(s => s.status === 'completed' && s.result === false);

      for (const failed of failedSubtasks) {
        updatedSubtasks.push({
          id: uuidv4(),
          description: `重新分析和修复：${failed.description}`,
          status: 'pending'
        });
      }

      updatedSubtasks.push({
        id: uuidv4(),
        description: '总结失败原因并提供改进建议',
        status: 'pending'
      });
    }

    this.adjustPrioritizationWeights(feedback.success);

    return {
      ...task,
      subtasks: updatedSubtasks,
      status: 'in_progress',
      updatedAt: new Date()
    };
  }

  learnFromExperience(task: Task, success: boolean, feedback?: string): void {
    console.log(`${LOG_PREFIX} [LEARN_FROM_EXPERIENCE] taskId=${task.id}, success=${success}`);
    this.adjustPrioritizationWeights(success);
  }

  private adjustPrioritizationWeights(success: boolean): void {
    const adjustment = success ? 0.01 : -0.01;
    this.taskPrioritizationWeights.urgency = this.clamp(
      this.taskPrioritizationWeights.urgency + adjustment, 0.1, 0.9
    );
    this.taskPrioritizationWeights.complexity = this.clamp(
      this.taskPrioritizationWeights.complexity + adjustment, 0.1, 0.9
    );
    this.taskPrioritizationWeights.userPreference = this.clamp(
      this.taskPrioritizationWeights.userPreference + adjustment, 0.1, 0.9
    );
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  setStrategy(strategy: DecisionStrategy): void {
    this.currentStrategy = strategy;
  }

  getCurrentStrategy(): DecisionStrategy {
    return this.currentStrategy;
  }

  // === 新增：任务可行性分析 ===
  evaluateTaskFeasibility(task: Task): {
    feasible: boolean;
    score: number;
    blockers?: string[];
  } {
    let score = 0.5;
    const blockers: string[] = [];

    const hasToolSubtasks = task.subtasks.some(s => s.toolName);
    if (hasToolSubtasks) score += 0.1;

    const subtaskCount = task.subtasks.length;
    if (subtaskCount <= 5) score += 0.2;
    else if (subtaskCount <= 10) score += 0.1;
    else score -= 0.1;

    if (score < 0.3) blockers.push('任务复杂度太高');

    return { feasible: score >= 0.3, score, blockers: blockers.length > 0 ? blockers : undefined };
  }

  // === 新增：智能任务分类 ===
  classifyTaskType(description: string): string {
    const lowerDesc = description.toLowerCase();

    const typePatterns = [
      { type: 'programming', keywords: ['代码', '编程', '程序', 'python', 'java', 'javascript', 'c++', 'bug', '函数', '算法', 'code'] },
      { type: 'mathematical', keywords: ['计算', '数学', '公式', '算术', '等于', 'calculate', 'math'] },
      { type: 'research', keywords: ['搜索', '研究', '查询', '查找', '了解', '什么是', 'search', 'research'] },
      { type: 'creative', keywords: ['写', '创作', '设计', '写文章', '写信', 'write', 'design', 'create'] },
      { type: 'analytical', keywords: ['分析', '评估', '对比', '比较', 'review', 'analyze', '分析一下'] },
      { type: 'learning', keywords: ['学习', '教程', '教我', '如何', '怎么', 'learn', 'tutorial'] },
      { type: 'technical', keywords: ['调试', '修复', '优化', 'debug', 'fix', 'optimize', '配置'] },
      { type: 'explanation', keywords: ['解释', '说明', '介绍', '解释一下', '说明一下', 'explain'] },
      { type: 'planning', keywords: ['计划', '规划', '安排', 'plan', 'schedule'] },
    ];

    for (const { type, keywords } of typePatterns) {
      if (keywords.some(kw => lowerDesc.includes(kw))) {
        console.log(`${LOG_PREFIX} [TASK_CLASSIFIED] type=${type}`);
        return type;
      }
    }

    return 'general';
  }

  // === 新增：生成备选方案 ===
  generateAlternativePlans(task: Task, count: number = 2): Task[] {
    const plans: Task[] = [];
    const strategies: DecisionStrategy[] = ['balanced', 'aggressive', 'creative'];

    for (let i = 0; i < Math.min(count, strategies.length); i++) {
      const alt = this.decomposeTask(task.description, task.userId);
      plans.push({
        ...alt,
        id: uuidv4(),
        description: `${task.description} (方案 ${i + 1})`,
        priority: task.priority
      });
    }

    console.log(`${LOG_PREFIX} [ALTERNATIVE_PLANS_GENERATED] count=${plans.length}`);
    return plans;
  }

  // === 新增：任务完成度计算 ===
  calculateTaskProgress(task: Task): {
    percentage: number;
    completedCount: number;
    totalCount: number;
  } {
    const completedCount = task.subtasks.filter(s => s.status === 'completed').length;
    const totalCount = task.subtasks.length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return { percentage, completedCount, totalCount };
  }

  // === 增强：任务依赖图管理（带循环检测、并行批次、动态依赖推断） ===
  private taskDependencyGraph = new Map<string, {
    dependsOn: string[];
    dependents: string[];
    level: number;
  }>();

  // 增强的依赖图节点信息
  private dependencyGraphMeta = new Map<string, {
    estimatedCost: number;
    isIdempotent: boolean;
    criticalPath: boolean;
  }>();

  // 构建任务依赖图（增强版：循环检测、跨阶段依赖、冗余依赖消除）
  buildDependencyGraph(subtasks: Subtask[]): Map<string, { dependsOn: string[]; dependents: string[]; level: number }> {
    const graph = new Map<string, { dependsOn: string[]; dependents: string[]; level: number }>();

    // 初始化所有节点
    for (const subtask of subtasks) {
      graph.set(subtask.id, { dependsOn: [], dependents: [], level: 0 });
      this.dependencyGraphMeta.set(subtask.id, {
        estimatedCost: this.estimateSubtaskCost(subtask),
        isIdempotent: this.isSubtaskIdempotent(subtask),
        criticalPath: false
      });
    }

    // 基于语义关键词建立依赖关系
    const earlyKeywords = ['分析', '理解', '确定', '提取', '收集', '识别', '评估', '解析', '明确'];
    const executeKeywords = ['执行', '运行', '实施', '处理', '编写', '生成', '创建', '实现', '执行', '开发'];
    const lateKeywords = ['验证', '检查', '总结', '提供', '报告', '推荐', '确认', '审查', '优化'];

    const edgeSet = new Set<string>();
    const addEdge = (from: string, to: string) => {
      const key = `${from}->${to}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        graph.get(to)!.dependsOn.push(from);
        graph.get(from)!.dependents.push(to);
      }
    };

    for (let i = 0; i < subtasks.length; i++) {
      const subtask = subtasks[i];
      const desc = subtask.description;

      for (let j = 0; j < subtasks.length; j++) {
        if (i === j) continue;
        const otherSubtask = subtasks[j];
        const otherDesc = otherSubtask.description;

        // 早期任务 -> 执行任务 的依赖链
        if (earlyKeywords.some(kw => desc.includes(kw)) &&
            executeKeywords.some(kw => otherDesc.includes(kw))) {
          addEdge(subtask.id, otherSubtask.id);
        }

        // 执行任务 -> 后期任务 的依赖链
        if (executeKeywords.some(kw => desc.includes(kw)) &&
            lateKeywords.some(kw => otherDesc.includes(kw))) {
          addEdge(subtask.id, otherSubtask.id);
        }

        // 早期任务 -> 后期任务 的间接依赖链（早期为后期提供输入）
        if (earlyKeywords.some(kw => desc.includes(kw)) &&
            lateKeywords.some(kw => otherDesc.includes(kw))) {
          addEdge(subtask.id, otherSubtask.id);
        }
      }
    }

    // 显式声明依赖解析（支持 subtask 描述中的"依赖于"、"基于"等关键词）
    const subtaskIndex = new Map<string, Subtask>();
    for (const s of subtasks) subtaskIndex.set(s.description.toLowerCase(), s);

    for (const subtask of subtasks) {
      const desc = subtask.description;
      const depMatch = desc.match(/(?:依赖于|基于|需要|前提|在.*之后|after|based on|depends on|requires)\s*[:：]?\s*(.+)/i);
      if (depMatch) {
        const depHint = depMatch[1].toLowerCase();
        for (const [descKey, other] of subtaskIndex) {
          if (other.id !== subtask.id && (descKey.includes(depHint.slice(0, 4)) || depHint.includes(descKey.slice(0, 4)))) {
            addEdge(other.id, subtask.id);
          }
        }
      }
    }

    // 循环检测（DFS 检测后向边）
    const cycle = this.detectCycle(graph);
    if (cycle) {
      console.warn(`${LOG_PREFIX} [DEPENDENCY_CYCLE_DETECTED] cycle=${cycle.join(' -> ')}，将打破循环`);
      // 打破循环：移除循环中的最后一条边
      const lastFrom = cycle[cycle.length - 1];
      const lastTo = cycle[0];
      const target = graph.get(lastTo);
      if (target) {
        target.dependsOn = target.dependsOn.filter(d => d !== lastFrom);
      }
      const source = graph.get(lastFrom);
      if (source) {
        source.dependents = source.dependents.filter(d => d !== lastTo);
      }
      edgeSet.delete(`${lastFrom}->${lastTo}`);
    }

    // 传递闭包 + 冗余边消除
    this.removeTransitiveEdges(graph);

    // 计算每个节点的层级（拓扑排序，Kahn 算法）
    const inDegree = new Map<string, number>();
    for (const [id, node] of graph) {
      inDegree.set(id, node.dependsOn.length);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) {
        queue.push(id);
        graph.get(id)!.level = 0;
      }
    }

    let processed = 0;
    while (queue.length > 0) {
      const id = queue.shift()!;
      processed++;
      const node = graph.get(id)!;
      for (const dep of node.dependents) {
        const depNode = graph.get(dep);
        if (!depNode) continue;
        depNode.level = Math.max(depNode.level, node.level + 1);
        const newDeg = (inDegree.get(dep) || 0) - 1;
        inDegree.set(dep, newDeg);
        if (newDeg === 0) queue.push(dep);
      }
    }

    if (processed !== graph.size) {
      console.warn(`${LOG_PREFIX} [DEPENDENCY_GRAPH_WARN] 可能存在未解决的循环，processed=${processed}/${graph.size}`);
    }

    // 计算关键路径（基于 estimatedCost）
    this.computeCriticalPath(graph);

    const maxLevel = Math.max(0, ...[...graph.values()].map(n => n.level));
    const totalEdges = edgeSet.size;
    console.log(
      `${LOG_PREFIX} [DEPENDENCY_GRAPH_BUILT] nodes=${graph.size}, edges=${totalEdges}, ` +
      `maxLevel=${maxLevel}, criticalPathNodes=${[...this.dependencyGraphMeta.values()].filter(m => m.criticalPath).length}`
    );
    this.taskDependencyGraph = graph;
    return graph;
  }

  // DFS 循环检测
  private detectCycle(graph: Map<string, { dependsOn: string[]; dependents: string[] }>): string[] | null {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    const parent = new Map<string, string | null>();

    for (const id of graph.keys()) {
      color.set(id, WHITE);
      parent.set(id, null);
    }

    for (const startId of graph.keys()) {
      if (color.get(startId) !== WHITE) continue;
      const stack: Array<{ id: string; iter: Iterator<string> }> = [];
      color.set(startId, GRAY);
      stack.push({ id: startId, iter: graph.get(startId)!.dependents[Symbol.iterator]() });

      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        const next = top.iter.next();
        if (next.done) {
          color.set(top.id, BLACK);
          stack.pop();
          continue;
        }
        const neighbor = next.value;
        if (!graph.has(neighbor)) continue;
        const c = color.get(neighbor);
        if (c === GRAY) {
          // 找到循环
          const cycle: string[] = [neighbor];
          let cur: string | null = top.id;
          while (cur !== null && cur !== neighbor) {
            cycle.push(cur);
            const next = parent.get(cur);
            cur = next !== undefined ? next : null;
            if (cur === null) break;
          }
          cycle.reverse();
          return cycle;
        } else if (c === WHITE) {
          color.set(neighbor, GRAY);
          parent.set(neighbor, top.id);
          stack.push({ id: neighbor, iter: graph.get(neighbor)!.dependents[Symbol.iterator]() });
        }
      }
    }
    return null;
  }

  // 消除传递冗余边（若 A->B->C 且 A->C 存在，A->C 是冗余的）
  private removeTransitiveEdges(graph: Map<string, { dependsOn: string[]; dependents: string[]; level: number }>): void {
    const nodes = [...graph.keys()];
    const reachable = new Map<string, Set<string>>();

    // 对每个节点做 DFS，记录其可到达的节点集合（不包括直接邻居）
    const dfs = (start: string, current: string, visited: Set<string>, results: Set<string>, skipDirect: Set<string>): void => {
      for (const dep of graph.get(current)?.dependents || []) {
        if (visited.has(dep)) continue;
        visited.add(dep);
        // 跳过直接邻居的第一层但记录它们
        if (current === start) {
          skipDirect.add(dep);
          dfs(start, dep, visited, results, skipDirect);
        } else {
          results.add(dep);
          dfs(start, dep, visited, results, skipDirect);
        }
      }
    };

    for (const node of nodes) {
      const visited = new Set<string>([node]);
      const results = new Set<string>();
      const skipDirect = new Set<string>();
      dfs(node, node, visited, results, skipDirect);
      reachable.set(node, results);
    }

    // 对每个节点 A 的直接邻居 B，如果 B 也在 A 的传递可达集合中，移除 A->B
    for (const node of nodes) {
      const nodeData = graph.get(node)!;
      const transitiveSet = reachable.get(node) || new Set<string>();
      const newDependents: string[] = [];
      for (const dep of nodeData.dependents) {
        if (transitiveSet.has(dep)) {
          // 移除冗余边
          const depData = graph.get(dep);
          if (depData) {
            depData.dependsOn = depData.dependsOn.filter(d => d !== node);
          }
        } else {
          newDependents.push(dep);
        }
      }
      nodeData.dependents = newDependents;
    }
  }

  // 计算关键路径（基于 estimatedCost 的最长路径）
  private computeCriticalPath(graph: Map<string, { dependsOn: string[]; dependents: string[]; level: number }>): void {
    const nodes = [...graph.keys()];
    const totalCost = new Map<string, number>();
    const predecessor = new Map<string, string | null>();

    for (const id of nodes) {
      totalCost.set(id, this.dependencyGraphMeta.get(id)?.estimatedCost || 1);
      predecessor.set(id, null);
    }

    // 按拓扑顺序（level 升序）
    const sorted = [...graph.entries()].sort((a, b) => a[1].level - b[1].level);

    for (const [id, node] of sorted) {
      const nodeCost = this.dependencyGraphMeta.get(id)?.estimatedCost || 1;
      for (const dep of node.dependents) {
        const current = totalCost.get(dep) || 0;
        const candidate = (totalCost.get(id) || 0) + nodeCost;
        if (candidate > current) {
          totalCost.set(dep, candidate);
          predecessor.set(dep, id);
        }
      }
    }

    // 找到最大 cost 的终点，然后回溯
    let maxNode: string | null = null;
    let maxVal = 0;
    for (const [id, val] of totalCost) {
      if (val > maxVal) {
        maxVal = val;
        maxNode = id;
      }
    }

    // 标记关键路径上的节点
    let cur: string | null = maxNode;
    while (cur) {
      const meta = this.dependencyGraphMeta.get(cur);
      if (meta) meta.criticalPath = true;
      cur = predecessor.get(cur) || null;
    }
  }

  // 获取可并行执行的批次（按 level 分组）
  getParallelBatches(subtasks: Subtask[]): Subtask[][] {
    const graph = this.buildDependencyGraph(subtasks);
    const maxLevel = Math.max(0, ...[...graph.values()].map(n => n.level));
    const batches: Subtask[][] = [];

    for (let level = 0; level <= maxLevel; level++) {
      const levelSubtasks: Subtask[] = [];
      for (const [id, node] of graph) {
        if (node.level === level) {
          const st = subtasks.find(s => s.id === id);
          if (st) levelSubtasks.push(st);
        }
      }
      if (levelSubtasks.length > 0) {
        // 在批次内再按优先级/关键路径排序
        levelSubtasks.sort((a, b) => {
          const aMeta = this.dependencyGraphMeta.get(a.id);
          const bMeta = this.dependencyGraphMeta.get(b.id);
          const aCritical = aMeta?.criticalPath ? 0 : 1;
          const bCritical = bMeta?.criticalPath ? 0 : 1;
          if (aCritical !== bCritical) return aCritical - bCritical;
          return (bMeta?.estimatedCost || 0) - (aMeta?.estimatedCost || 0);
        });
        batches.push(levelSubtasks);
      }
    }

    console.log(`${LOG_PREFIX} [PARALLEL_BATCHES_COMPUTED] batches=${batches.length}, sizes=[${batches.map(b => b.length).join(',')}]`);
    return batches;
  }

  // 预估子任务成本（分钟）
  private estimateSubtaskCost(subtask: Subtask): number {
    const desc = subtask.description.toLowerCase();
    let cost = 1;
    if (subtask.toolName) cost += 2;
    if (desc.includes('分析') || desc.includes('研究')) cost += 2;
    if (desc.includes('搜索') || desc.includes('查找')) cost += 1;
    if (desc.includes('编写') || desc.includes('实现')) cost += 2;
    if (desc.includes('验证') || desc.includes('测试')) cost += 1;
    return cost;
  }

  // 判断子任务是否幂等（重复执行不改变结果）
  private isSubtaskIdempotent(subtask: Subtask): boolean {
    const desc = subtask.description.toLowerCase();
    const nonIdempotent = ['创建', '删除', '修改', '更新', '发送', '提交', '插入', '购买', '支付', '转账'];
    for (const kw of nonIdempotent) {
      if (desc.includes(kw)) return false;
    }
    return true;
  }

  // === 增强：动态调度器（资源感知、ETA、紧急度加权、动态重排序、抢占） ===
  private schedulerState = {
    currentTime: 0,
    maxConcurrent: 3,
    adaptiveConcurrency: true
  };

  // 增强版动态调度器：综合依赖、优先级、资源、紧急度、预估耗时来排序
  scheduleSubtasks(subtasks: Subtask[], options?: {
    urgency?: number;
    availableResources?: Partial<{ computeUnits: number; memoryMB: number; networkBandwidth: number; toolSlots: number }>;
    maxConcurrency?: number;
  }): Subtask[] {
    const graph = this.buildDependencyGraph(subtasks);
    const scheduled: Subtask[] = [];
    const remaining = new Set(subtasks.map(s => s.id));
    const completed = new Set<string>();
    const inProgress = new Set<string>();

    const maxConcurrent = options?.maxConcurrency ?? this.schedulerState.maxConcurrent;
    const urgencyBoost = options?.urgency ?? 1;

    const maxLevel = Math.max(0, ...[...graph.values()].map(n => n.level));

    for (let level = 0; level <= maxLevel + 1; level++) {
      // 收集当前可执行的候选（依赖都已完成）
      const candidates: Array<{ id: string; subtask: Subtask; score: number; eta: number }> = [];

      for (const id of remaining) {
        const node = graph.get(id);
        if (!node) continue;
        if (node.level > level) continue;
        const depsMet = node.dependsOn.every(d => completed.has(d));
        if (!depsMet) continue;

        const subtask = subtasks.find(s => s.id === id);
        if (!subtask) continue;

        // 综合评分：依赖的后代数越多越优先、关键路径优先、工具/紧急度加权
        const meta = this.dependencyGraphMeta.get(id);
        const downstreamCount = this.countDownstream(id, graph);
        const toolWeight = subtask.toolName ? 1.3 : 1;
        const criticalWeight = meta?.criticalPath ? 1.5 : 1;
        const cost = meta?.estimatedCost || 1;
        // 短作业优先，但关键路径的长作业优先
        const sjfWeight = meta?.criticalPath ? cost * 1.5 : Math.max(0.5, 5 - cost);

        const score = downstreamCount * 0.4 * urgencyBoost +
                      criticalWeight * 0.3 +
                      toolWeight * 0.2 +
                      sjfWeight * 0.1;

        candidates.push({ id, subtask, score, eta: cost });
      }

      if (candidates.length === 0) continue;

      // 按综合评分降序排序
      candidates.sort((a, b) => b.score - a.score);

      // 资源感知：在最大并发内调度（模拟资源限制）
      let scheduledInBatch = 0;
      for (const cand of candidates) {
        if (scheduledInBatch >= maxConcurrent) break;

        // 模拟资源可用性检查
        const required = this.estimateSubtaskResources(cand.subtask);
        const available = options?.availableResources ?? { computeUnits: 10, memoryMB: 512, networkBandwidth: 100, toolSlots: 5 };
        const canFit = (required.computeUnits || 0) <= (available.computeUnits || 10) &&
                       (required.memoryMB || 0) <= (available.memoryMB || 512) &&
                       (required.networkBandwidth || 0) <= (available.networkBandwidth || 100) &&
                       (required.toolSlots || 0) <= (available.toolSlots || 5);

        if (!canFit && scheduledInBatch > 0) {
          // 资源不足，延后到下一批次
          continue;
        }

        scheduled.push(cand.subtask);
        remaining.delete(cand.id);
        inProgress.add(cand.id);
        scheduledInBatch++;
      }

      // 模拟这一批次执行完成
      for (const s of scheduled.slice(scheduled.length - scheduledInBatch)) {
        inProgress.delete(s.id);
        completed.add(s.id);
      }
    }

    // 兜底：把未调度的按顺序添加
    for (const id of remaining) {
      const subtask = subtasks.find(s => s.id === id);
      if (subtask) scheduled.push(subtask);
    }

    console.log(
      `${LOG_PREFIX} [SUBTASKS_SCHEDULED] total=${scheduled.length}, ` +
      `maxLevel=${maxLevel}, urgencyBoost=${urgencyBoost}, maxConcurrency=${maxConcurrent}`
    );
    return scheduled;
  }

  // 调度器主循环：动态资源感知 + 抢占
  runScheduler(subtasks: Subtask[]): {
    schedule: Subtask[];
    etaMinutes: number;
    criticalPath: string[];
    batches: Subtask[][];
    parallelism: number;
  } {
    const graph = this.buildDependencyGraph(subtasks);
    const batches = this.getParallelBatches(subtasks);
    const schedule = this.scheduleSubtasks(subtasks);

    // 计算关键路径节点列表
    const criticalPath: string[] = [];
    for (const [id, meta] of this.dependencyGraphMeta) {
      if (meta.criticalPath) criticalPath.push(id);
    }

    // 预估总时长（关键路径上的子任务成本之和）
    let etaMinutes = 0;
    for (const id of criticalPath) {
      const meta = this.dependencyGraphMeta.get(id);
      etaMinutes += meta?.estimatedCost || 1;
    }
    if (etaMinutes === 0) {
      for (const st of subtasks) {
        etaMinutes += this.estimateSubtaskCost(st);
      }
    }

    // 平均并行度（每批 size 的加权平均）
    const totalSub = subtasks.length;
    let parallelism = 0;
    if (batches.length > 0) {
      parallelism = totalSub / batches.length;
    }

    return {
      schedule,
      etaMinutes,
      criticalPath,
      batches,
      parallelism
    };
  }

  // 计算下游节点总数（影响越大越应先调度）
  private countDownstream(id: string, graph: Map<string, { dependents: string[] }>): number {
    const visited = new Set<string>();
    const stack = [id];
    let count = 0;
    while (stack.length > 0) {
      const cur = stack.pop()!;
      const node = graph.get(cur);
      if (!node) continue;
      for (const dep of node.dependents) {
        if (!visited.has(dep)) {
          visited.add(dep);
          count++;
          stack.push(dep);
        }
      }
    }
    return count;
  }

  // 预估子任务所需资源
  private estimateSubtaskResources(subtask: Subtask): { computeUnits: number; memoryMB: number; networkBandwidth: number; toolSlots: number } {
    const desc = subtask.description.toLowerCase();
    let computeUnits = 1;
    let memoryMB = 50;
    let networkBandwidth = 0;
    let toolSlots = subtask.toolName ? 1 : 0;

    if (subtask.toolName) {
      computeUnits += 2;
      memoryMB += 100;
      if (subtask.toolName.includes('search') || subtask.toolName.includes('web')) {
        networkBandwidth += 20;
      }
    }
    if (desc.includes('分析') || desc.includes('模型')) {
      computeUnits += 3;
      memoryMB += 200;
    }
    if (desc.includes('训练') || desc.includes('training')) {
      computeUnits += 8;
      memoryMB += 500;
    }
    return { computeUnits, memoryMB, networkBandwidth, toolSlots };
  }

  // === 增强：任务状态机（子任务状态机 + 丰富流转 + 守卫函数 + 钩子） ===
  private taskStates = new Map<string, {
    status: string;
    history: Array<{ status: string; timestamp: Date; note?: string; duration?: number }>;
    retryCount: number;
    startTime?: number;
    endTime?: number;
    durationMs?: number;
    lastError?: string;
  }>();

  // 子任务独立的状态机
  private subtaskStates = new Map<string, {
    status: 'pending' | 'queued' | 'in_progress' | 'waiting' | 'completed' | 'failed' | 'retrying' | 'cancelled' | 'rolled_back';
    retryCount: number;
    attempts: Array<{ start: Date; end?: Date; success: boolean; error?: string }>;
    checkpoints: Array<unknown>;
  }>();

  // 预定义的合法状态流转（主任务）
  private readonly validTransitions: Record<string, string[]> = {
    'created': ['pending', 'rejected'],
    'pending': ['queued', 'in_progress', 'cancelled'],
    'queued': ['in_progress', 'cancelled'],
    'in_progress': ['completed', 'failed', 'paused', 'waiting', 'retrying'],
    'paused': ['in_progress', 'cancelled'],
    'waiting': ['in_progress', 'failed'],
    'failed': ['retrying', 'failed_final', 'rolled_back', 'cancelled'],
    'retrying': ['in_progress', 'failed_final'],
    'completed': ['reviewing', 'completed_final'],
    'reviewing': ['completed_final', 'in_progress'],
    'rolled_back': ['pending', 'cancelled'],
    'rejected': [],
    'cancelled': [],
    'failed_final': [],
    'completed_final': []
  };

  // 子任务状态流转规则
  private readonly subtaskValidTransitions: Record<string, string[]> = {
    'pending': ['queued', 'cancelled'],
    'queued': ['in_progress', 'cancelled'],
    'in_progress': ['completed', 'failed', 'waiting', 'retrying'],
    'waiting': ['in_progress', 'failed'],
    'failed': ['retrying', 'cancelled', 'rolled_back'],
    'retrying': ['in_progress', 'failed'],
    'completed': [],
    'cancelled': [],
    'rolled_back': []
  };

  // 状态转换钩子
  private transitionHooks: Array<(taskId: string, from: string, to: string, note?: string) => void> = [];

  registerTransitionHook(hook: (taskId: string, from: string, to: string, note?: string) => void): void {
    this.transitionHooks.push(hook);
  }

  // 状态转换（主任务）
  transitionTaskState(taskId: string, newStatus: string, note?: string): boolean {
    const existing = this.taskStates.get(taskId);
    const state = existing || {
      status: 'created',
      history: [],
      retryCount: 0
    };

    const currentStatus = state.status;
    const validNext = this.validTransitions[currentStatus] || [];

    if (currentStatus !== newStatus && !validNext.includes(newStatus)) {
      console.warn(`${LOG_PREFIX} [INVALID_STATE_TRANSITION] taskId=${taskId}, ${currentStatus} -> ${newStatus}`);
      return false;
    }

    const now = Date.now();
    const duration = state.startTime ? now - state.startTime : undefined;

    if (newStatus === 'in_progress') {
      state.startTime = now;
    }
    if (['completed', 'failed', 'failed_final', 'completed_final', 'cancelled', 'rolled_back'].includes(newStatus)) {
      state.endTime = now;
      state.durationMs = state.startTime ? now - state.startTime : undefined;
    }

    if (newStatus === 'retrying') {
      state.retryCount++;
    }

    state.status = newStatus;
    state.history.push({ status: newStatus, timestamp: new Date(), note, duration });
    this.taskStates.set(taskId, state);

    // 触发钩子
    for (const hook of this.transitionHooks) {
      try {
        hook(taskId, currentStatus, newStatus, note);
      } catch (err) {
        console.error(`${LOG_PREFIX} [HOOK_ERROR]`, err);
      }
    }

    console.log(
      `${LOG_PREFIX} [STATE_TRANSITION] taskId=${taskId}, ${currentStatus} -> ${newStatus}, ` +
      `retry=${state.retryCount}, duration=${duration ? (duration / 1000).toFixed(2) + 's' : '-'}`
    );
    return true;
  }

  // 子任务状态转换
  transitionSubtaskState(subtaskId: string, newStatus: 'pending' | 'queued' | 'in_progress' | 'waiting' | 'completed' | 'failed' | 'retrying' | 'cancelled' | 'rolled_back', error?: string): boolean {
    const existing = this.subtaskStates.get(subtaskId);
    const state = existing || {
      status: 'pending' as const,
      retryCount: 0,
      attempts: [],
      checkpoints: []
    };

    const currentStatus = state.status;
    const validNext = this.subtaskValidTransitions[currentStatus] || [];

    if (currentStatus !== newStatus && !validNext.includes(newStatus)) {
      console.warn(`${LOG_PREFIX} [INVALID_SUBTASK_TRANSITION] subtaskId=${subtaskId}, ${currentStatus} -> ${newStatus}`);
      return false;
    }

    if (newStatus === 'in_progress') {
      state.attempts.push({ start: new Date(), success: false });
    }

    if (newStatus === 'completed') {
      const last = state.attempts[state.attempts.length - 1];
      if (last) {
        last.end = new Date();
        last.success = true;
      }
    }

    if (newStatus === 'failed') {
      const last = state.attempts[state.attempts.length - 1];
      if (last) {
        last.end = new Date();
        last.success = false;
        last.error = error;
      }
      state.retryCount++;
    }

    if (newStatus === 'retrying') {
      state.retryCount++;
    }

    state.status = newStatus;
    this.subtaskStates.set(subtaskId, state);
    return true;
  }

  // 添加 checkpoint（用于回滚）
  addCheckpoint(subtaskId: string, data: unknown): void {
    const state = this.subtaskStates.get(subtaskId) || {
      status: 'pending' as const,
      retryCount: 0,
      attempts: [],
      checkpoints: []
    };
    state.checkpoints.push(data);
    this.subtaskStates.set(subtaskId, state);
  }

  // 获取任务状态
  getTaskState(taskId: string) {
    return this.taskStates.get(taskId) || null;
  }

  // 获取子任务状态
  getSubtaskState(subtaskId: string) {
    return this.subtaskStates.get(subtaskId) || null;
  }

  // 聚合：获取任务总体进度（基于子任务状态）
  getTaskAggregatedState(taskId: string, subtaskIds: string[]): {
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    cancelled: number;
    total: number;
    percent: number;
  } {
    const counts = { pending: 0, inProgress: 0, completed: 0, failed: 0, cancelled: 0 };
    for (const id of subtaskIds) {
      const st = this.subtaskStates.get(id);
      const status = st?.status || 'pending';
      if (status === 'pending' || status === 'queued') counts.pending++;
      else if (status === 'in_progress' || status === 'waiting' || status === 'retrying') counts.inProgress++;
      else if (status === 'completed') counts.completed++;
      else if (status === 'failed' || status === 'rolled_back') counts.failed++;
      else if (status === 'cancelled') counts.cancelled++;
    }
    const total = subtaskIds.length;
    const percent = total > 0 ? Math.round(((counts.completed + counts.failed + counts.cancelled) / total) * 100) : 0;
    return { ...counts, total, percent };
  }

  // === 增强：复杂工作流引擎（条件分支、循环、并行阶段、Saga 模式） ===

  // 预定义工作流模板（声明式）
  private workflowTemplates: Record<string, {
    name: string;
    nodes: WorkflowNode[];
    onError?: 'rollback' | 'continue' | 'fail';
  }> = {
    research: {
      name: '研究工作流',
      nodes: [
        {
          type: 'stage',
          name: '需求理解',
          action: async (ctx) => {
            ctx.variables.researchScope = '已分析';
            return { phase: 'requirement' };
          },
          description: '理解研究目标和范围'
        },
        {
          type: 'parallel',
          branches: [
            [{ type: 'stage', name: '搜索资料', action: async () => ({ source: 'web_search' }) }],
            [{ type: 'stage', name: '收集数据', action: async () => ({ source: 'data' }) }]
          ],
          failFast: false
        },
        {
          type: 'condition',
          condition: (ctx) => {
            const results = [...ctx.results.values()];
            return results.length > 0;
          },
          trueBranch: [
            { type: 'stage', name: '分析整理', action: async () => ({ analyzed: true }) }
          ],
          falseBranch: [
            { type: 'stage', name: '降级：仅摘要', action: async () => ({ analyzed: false, summary: 'limited' }) }
          ]
        },
        { type: 'stage', name: '生成报告', action: async () => ({ report: true }) }
      ],
      onError: 'rollback'
    },
    code_development: {
      name: '代码开发工作流',
      nodes: [
        { type: 'stage', name: '需求分析', action: async () => ({ analyzed: true }) },
        {
          type: 'loop',
          iterable: () => ['设计', '编码', '测试'],
          body: [
            {
              type: 'stage',
              name: '迭代步骤',
              action: async (ctx) => ({ step: ctx.iterationIndex })
            }
          ],
          maxIterations: 5
        },
        { type: 'stage', name: '代码审查', action: async () => ({ reviewed: true }) }
      ],
      onError: 'rollback'
    },
    problem_solving: {
      name: '问题解决工作流',
      nodes: [
        { type: 'stage', name: '问题诊断', action: async () => ({ diagnosed: true }) },
        {
          type: 'retry',
          strategy: 'external_api',
          maxRetries: 3,
          body: [{ type: 'stage', name: '修复尝试', action: async () => ({ fixed: true }) }]
        },
        { type: 'stage', name: '验证效果', action: async () => ({ verified: true }) }
      ],
      onError: 'rollback'
    }
  };

  // 注册自定义工作流模板
  registerWorkflowTemplate(name: string, template: { name: string; nodes: WorkflowNode[]; onError?: 'rollback' | 'continue' | 'fail' }): void {
    this.workflowTemplates[name] = template;
    console.log(`${LOG_PREFIX} [WORKFLOW_TEMPLATE_REGISTERED] name=${name}`);
  }

  // 执行工作流（声明式节点解释器）
  async executeWorkflow(
    workflowType: string,
    task: Task,
    contextVariables: Record<string, unknown> = {}
  ): Promise<Task> {
    const template = this.workflowTemplates[workflowType];
    if (!template) {
      console.warn(`${LOG_PREFIX} [WORKFLOW_NOT_FOUND] type=${workflowType}`);
      return task;
    }

    const ctx: WorkflowContext = {
      task,
      variables: { ...contextVariables },
      results: new Map<string, unknown>(),
      executionLog: [],
      depth: 0
    };

    this.transitionTaskState(task.id, 'in_progress', `开始执行工作流 ${template.name}`);

    try {
      await this.runNodes(template.nodes, ctx);
      this.transitionTaskState(task.id, 'completed', `工作流执行完成，共 ${ctx.executionLog.length} 步`);
      console.log(
        `${LOG_PREFIX} [WORKFLOW_EXECUTED] type=${workflowType}, nodes=${template.nodes.length}, steps=${ctx.executionLog.length}`
      );
    } catch (err) {
      this.transitionTaskState(task.id, 'failed', `工作流执行失败: ${(err as Error).message}`);
      console.error(`${LOG_PREFIX} [WORKFLOW_ERROR]`, err);

      if (template.onError === 'rollback') {
        await this.rollbackWorkflow(ctx);
        this.transitionTaskState(task.id, 'rolled_back', '执行补偿回滚');
      }
    }

    return { ...task, subtasks: [...task.subtasks] };
  }

  // 递归执行工作流节点
  private async runNodes(nodes: WorkflowNode[], ctx: WorkflowContext): Promise<void> {
    for (const node of nodes) {
      await this.runNode(node, ctx);
    }
  }

  // 执行单个节点
  private async runNode(node: WorkflowNode, ctx: WorkflowContext): Promise<void> {
    ctx.depth++;

    try {
      switch (node.type) {
        case 'stage': {
          this.transitionTaskState(ctx.task?.id || 'unknown', 'in_progress', `stage: ${node.name}`);
          const result = await node.action(ctx);
          ctx.results.set(node.name, result);
          ctx.executionLog.push({ step: node.name, status: 'completed', timestamp: new Date(), data: result });
          break;
        }
        case 'condition': {
          const conditionResult = node.condition(ctx);
          ctx.executionLog.push({
            step: `condition(${node.type})`,
            status: conditionResult ? 'true' : 'false',
            timestamp: new Date()
          });
          const branch = conditionResult ? node.trueBranch : (node.falseBranch || []);
          await this.runNodes(branch, ctx);
          break;
        }
        case 'parallel': {
          const branchPromises = node.branches.map(async (branch, idx) => {
            const branchCtx: WorkflowContext = {
              ...ctx,
              variables: { ...ctx.variables },
              results: new Map(ctx.results),
              executionLog: ctx.executionLog,
              depth: ctx.depth
            };
            try {
              await this.runNodes(branch, branchCtx);
              return { idx, success: true };
            } catch (err) {
              if (node.failFast) {
                throw err;
              }
              return { idx, success: false, error: err };
            }
          });
          const results = await Promise.all(branchPromises);
          ctx.executionLog.push({
            step: `parallel(branches=${node.branches.length})`,
            status: results.every(r => r.success) ? 'completed' : 'partial',
            timestamp: new Date(),
            data: results
          });
          break;
        }
        case 'loop': {
          const items = node.iterable(ctx);
          const max = node.maxIterations ?? items.length;
          for (let i = 0; i < Math.min(items.length, max); i++) {
            ctx.iterationIndex = i;
            ctx.variables.currentItem = items[i];
            await this.runNodes(node.body, ctx);
          }
          ctx.executionLog.push({
            step: `loop(iterations=${Math.min(items.length, max)})`,
            status: 'completed',
            timestamp: new Date()
          });
          break;
        }
        case 'retry': {
          const maxRetries = node.maxRetries ??
            (this.retryStrategies[node.strategy]?.maxRetries ?? 3);
          let lastErr: unknown;
          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              await this.runNodes(node.body, ctx);
              ctx.executionLog.push({
                step: `retry(attempt=${attempt + 1})`,
                status: 'success',
                timestamp: new Date()
              });
              return;
            } catch (err) {
              lastErr = err;
              const delay = this.calculateRetryDelay(ctx.task?.id || 'retry', node.strategy);
              if (attempt < maxRetries - 1) {
                await this.sleep(delay);
              }
            }
          }
          ctx.executionLog.push({
            step: `retry(all failed)`,
            status: 'failed',
            timestamp: new Date()
          });
          throw lastErr || new Error('Retry exhausted');
        }
        case 'compensation': {
          await node.action(ctx);
          break;
        }
        case 'rollback': {
          throw new Error(node.reason || 'Manual rollback requested');
        }
      }
    } finally {
      ctx.depth = Math.max(0, ctx.depth - 1);
    }
  }

  // 工作流回滚（Saga 模式）
  private async rollbackWorkflow(ctx: WorkflowContext): Promise<void> {
    console.warn(`${LOG_PREFIX} [WORKFLOW_ROLLBACK] rolling back ${ctx.executionLog.length} steps`);
    // 按执行日志逆序尝试补偿
    for (let i = ctx.executionLog.length - 1; i >= 0; i--) {
      const step = ctx.executionLog[i];
      try {
        // 幂等操作可以直接回滚，非幂等操作记录警告
        const subtaskId = `${ctx.task?.id || 'task'}-${step.step}`;
        const meta = this.dependencyGraphMeta.get(subtaskId);
        if (meta?.isIdempotent === false) {
          console.warn(`${LOG_PREFIX} [ROLLBACK_WARN] non-idempotent step skipped: ${step.step}`);
          continue;
        }
        // 标记已补偿
        this.transitionTaskState(ctx.task?.id || 'unknown', 'rolled_back', `补偿: ${step.step}`);
      } catch (err) {
        console.error(`${LOG_PREFIX} [ROLLBACK_ERROR]`, err);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
  }

  // === 增强：任务重试和回退机制（幂等操作回退 + 断路器 + 抖动退避） ===

  private retryStrategies: Record<string, { maxRetries: number; backoff: number; backoffMultiplier: number; jitter?: number }> = {
    network: { maxRetries: 3, backoff: 1000, backoffMultiplier: 2, jitter: 0.3 },
    computation: { maxRetries: 2, backoff: 500, backoffMultiplier: 1.5, jitter: 0.1 },
    external_api: { maxRetries: 5, backoff: 2000, backoffMultiplier: 2, jitter: 0.5 },
    idempotent: { maxRetries: 10, backoff: 500, backoffMultiplier: 1.2, jitter: 0.2 },
    default: { maxRetries: 2, backoff: 1000, backoffMultiplier: 1.5, jitter: 0.1 }
  };

  // 简易断路器状态
  private circuitBreakers = new Map<string, {
    state: 'closed' | 'open' | 'half_open';
    failures: number;
    successes: number;
    lastFailure: number;
    threshold: number;
    recoveryMs: number;
  }>();

  // 注册/获取断路器
  getOrCreateCircuitBreaker(key: string, threshold = 3, recoveryMs = 30000) {
    const existing = this.circuitBreakers.get(key);
    if (existing) return existing;
    const cb = {
      state: 'closed' as const,
      failures: 0,
      successes: 0,
      lastFailure: 0,
      threshold,
      recoveryMs
    };
    this.circuitBreakers.set(key, cb);
    return cb;
  }

  // 在断路器允许时执行
  async runWithCircuitBreaker<T>(
    key: string,
    fn: () => Promise<T>,
    strategy: string = 'default'
  ): Promise<T> {
    const cb = this.getOrCreateCircuitBreaker(key);
    const now = Date.now();

    if (cb.state === 'open') {
      if (now - cb.lastFailure >= cb.recoveryMs) {
        cb.state = 'half_open';
      } else {
        throw new Error(`Circuit breaker OPEN for ${key}; wait ${Math.ceil((cb.recoveryMs - (now - cb.lastFailure)) / 1000)}s`);
      }
    }

    const maxRetries = this.retryStrategies[strategy]?.maxRetries ?? 2;
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await fn();
        cb.successes++;
        if (cb.state === 'half_open' && cb.successes >= 1) {
          cb.state = 'closed';
          cb.failures = 0;
        }
        return result;
      } catch (err) {
        lastErr = err;
        cb.failures++;
        cb.lastFailure = now;
        if (cb.failures >= cb.threshold) {
          cb.state = 'open';
        }
        const delay = this.calculateRetryDelay(`${key}-${attempt}`, strategy);
        if (attempt < maxRetries - 1) {
          await this.sleep(delay);
        }
      }
    }
    throw lastErr;
  }

  // 计算重试延迟（带指数退避 + 抖动）
  calculateRetryDelay(taskId: string, strategyName: string = 'default'): number {
    const state = this.taskStates.get(taskId);
    const retryCount = state?.retryCount || 0;
    const strategy = this.retryStrategies[strategyName] || this.retryStrategies.default;

    if (retryCount >= strategy.maxRetries) {
      return -1;
    }

    const baseDelay = strategy.backoff * Math.pow(strategy.backoffMultiplier, retryCount);
    const jitter = strategy.jitter ? (Math.random() - 0.5) * 2 * strategy.jitter * baseDelay : 0;
    const delay = Math.max(0, Math.round(baseDelay + jitter));

    console.log(
      `${LOG_PREFIX} [RETRY_DELAY_CALCULATED] taskId=${taskId}, strategy=${strategyName}, ` +
      `retry=${retryCount}/${strategy.maxRetries}, delay=${delay}ms`
    );
    return delay;
  }

  // 检查是否可以重试
  canRetry(taskId: string, strategyName: string = 'default'): boolean {
    const delay = this.calculateRetryDelay(taskId, strategyName);
    return delay > 0;
  }

  // 手动注册新策略
  registerRetryStrategy(name: string, config: { maxRetries: number; backoff: number; backoffMultiplier: number; jitter?: number }): void {
    this.retryStrategies[name] = config;
    console.log(`${LOG_PREFIX} [RETRY_STRATEGY_REGISTERED] name=${name}`);
  }

  // === 增强：资源分配管理（动态资源池 + 优先级抢占 + 实时监控 + 配额） ===

  private resourcePool: ResourcePool = {
    computeUnits: 10,
    memoryMB: 512,
    networkBandwidth: 100,
    toolSlots: 5
  };

  // 资源历史记录
  private resourceHistory: Array<{ timestamp: number; pool: ResourcePool }> = [];

  private resourceAllocations = new Map<string, {
    allocated: ResourcePool;
    priority: number;
    taskId: string;
    startedAt: number;
  }>();

  // 资源配额（按用户/租户限制）
  private quotaMap = new Map<string, Partial<ResourcePool>>();

  setQuota(ownerId: string, quota: Partial<ResourcePool>): void {
    this.quotaMap.set(ownerId, quota);
  }

  // 动态调整资源池
  resizePool(newSize: Partial<ResourcePool>): void {
    if (newSize.computeUnits !== undefined) this.resourcePool.computeUnits = newSize.computeUnits;
    if (newSize.memoryMB !== undefined) this.resourcePool.memoryMB = newSize.memoryMB;
    if (newSize.networkBandwidth !== undefined) this.resourcePool.networkBandwidth = newSize.networkBandwidth;
    if (newSize.toolSlots !== undefined) this.resourcePool.toolSlots = newSize.toolSlots;
    console.log(`${LOG_PREFIX} [POOL_RESIZED] ${JSON.stringify(this.resourcePool)}`);
  }

  // 分配资源（支持优先级抢占低优先级任务）
  allocateResources(
    taskId: string,
    required: Partial<ResourcePool>,
    options: { priority?: number; ownerId?: string; allowPreempt?: boolean } = {}
  ): boolean {
    const priority = options.priority ?? 5;

    // 检查 owner 配额
    if (options.ownerId) {
      const quota = this.quotaMap.get(options.ownerId);
      if (quota) {
        let ownerUsage: ResourcePool = { computeUnits: 0, memoryMB: 0, networkBandwidth: 0, toolSlots: 0 };
        for (const alloc of this.resourceAllocations.values()) {
          if (alloc.taskId.startsWith(options.ownerId)) {
            ownerUsage = this.addResources(ownerUsage, alloc.allocated);
          }
        }
        const withNew = this.addResources(ownerUsage, required as ResourcePool);
        if ((quota.computeUnits ?? Infinity) < withNew.computeUnits ||
            (quota.memoryMB ?? Infinity) < withNew.memoryMB ||
            (quota.networkBandwidth ?? Infinity) < withNew.networkBandwidth ||
            (quota.toolSlots ?? Infinity) < withNew.toolSlots) {
          console.warn(`${LOG_PREFIX} [QUOTA_EXCEEDED] owner=${options.ownerId}`);
          return false;
        }
      }
    }

    // 检查是否有足够资源
    const canFit = (required.computeUnits ?? 0) <= this.resourcePool.computeUnits &&
      (required.memoryMB ?? 0) <= this.resourcePool.memoryMB &&
      (required.networkBandwidth ?? 0) <= this.resourcePool.networkBandwidth &&
      (required.toolSlots ?? 0) <= this.resourcePool.toolSlots;

    if (!canFit) {
      if (options.allowPreempt) {
        // 抢占：释放优先级更低的任务资源
        const preemptees = [...this.resourceAllocations.entries()]
          .filter(([, v]) => v.priority < priority)
          .sort((a, b) => a[1].priority - b[1].priority);

        for (const [preemptId, alloc] of preemptees) {
          this.releaseResources(preemptId);
          const stillFit = (required.computeUnits ?? 0) <= this.resourcePool.computeUnits &&
            (required.memoryMB ?? 0) <= this.resourcePool.memoryMB &&
            (required.networkBandwidth ?? 0) <= this.resourcePool.networkBandwidth &&
            (required.toolSlots ?? 0) <= this.resourcePool.toolSlots;
          if (stillFit) {
            console.warn(`${LOG_PREFIX} [RESOURCE_PREEMPTED] preempted=${preemptId} for ${taskId}`);
            break;
          }
        }
      } else {
        console.warn(`${LOG_PREFIX} [RESOURCE_INSUFFICIENT] taskId=${taskId}`);
        return false;
      }
    }

    // 分配资源
    const finalAlloc: ResourcePool = {
      computeUnits: required.computeUnits ?? 0,
      memoryMB: required.memoryMB ?? 0,
      networkBandwidth: required.networkBandwidth ?? 0,
      toolSlots: required.toolSlots ?? 0
    };

    this.resourcePool.computeUnits -= finalAlloc.computeUnits;
    this.resourcePool.memoryMB -= finalAlloc.memoryMB;
    this.resourcePool.networkBandwidth -= finalAlloc.networkBandwidth;
    this.resourcePool.toolSlots -= finalAlloc.toolSlots;

    this.resourceAllocations.set(taskId, {
      allocated: { ...finalAlloc },
      priority,
      taskId,
      startedAt: Date.now()
    });

    this.resourceHistory.push({ timestamp: Date.now(), pool: { ...this.resourcePool } });
    if (this.resourceHistory.length > 100) this.resourceHistory.shift();

    console.log(`${LOG_PREFIX} [RESOURCES_ALLOCATED] taskId=${taskId}, priority=${priority}, allocation=${JSON.stringify(finalAlloc)}`);
    return true;
  }

  // 释放资源
  releaseResources(taskId: string): void {
    const allocation = this.resourceAllocations.get(taskId);
    if (!allocation) return;

    this.resourcePool.computeUnits += allocation.allocated.computeUnits;
    this.resourcePool.memoryMB += allocation.allocated.memoryMB;
    this.resourcePool.networkBandwidth += allocation.allocated.networkBandwidth;
    this.resourcePool.toolSlots += allocation.allocated.toolSlots;

    this.resourceAllocations.delete(taskId);
    this.resourceHistory.push({ timestamp: Date.now(), pool: { ...this.resourcePool } });
    if (this.resourceHistory.length > 100) this.resourceHistory.shift();
    console.log(`${LOG_PREFIX} [RESOURCES_RELEASED] taskId=${taskId}`);
  }

  // 获取资源池状态
  getResourceStatus(): ResourcePool {
    return { ...this.resourcePool };
  }

  // 获取资源历史（趋势监控）
  getResourceHistory(): Array<{ timestamp: number; pool: ResourcePool }> {
    return [...this.resourceHistory];
  }

  // 获取活跃分配
  getActiveAllocations(): Array<{ taskId: string; priority: number; allocated: ResourcePool; durationMs: number }> {
    const now = Date.now();
    return [...this.resourceAllocations.values()].map(a => ({
      taskId: a.taskId,
      priority: a.priority,
      allocated: a.allocated,
      durationMs: now - a.startedAt
    }));
  }

  // 资源加工具函数
  private addResources(
    a: ResourcePool,
    b: Partial<ResourcePool>
  ): ResourcePool {
    return {
      computeUnits: a.computeUnits + (b.computeUnits ?? 0),
      memoryMB: a.memoryMB + (b.memoryMB ?? 0),
      networkBandwidth: a.networkBandwidth + (b.networkBandwidth ?? 0),
      toolSlots: a.toolSlots + (b.toolSlots ?? 0)
    };
  }

  // === 增强：任务批处理（基于相似度 + 优先级的智能分组） ===
  private readonly taskPriorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  // 批处理任务（按类型分组并压缩为批次）
  batchProcessTasks(tasks: Task[], batchSize: number = 3): Task[][] {
    const batches: Task[][] = [];

    // 按优先级排序
    const priorityOrder = this.taskPriorityOrder;
    const prioritizedTasks = [...tasks].sort((a, b) => {
      const aPriority = a.priority ? priorityOrder[a.priority as string] ?? 2 : 2;
      const bPriority = b.priority ? priorityOrder[b.priority as string] ?? 2 : 2;
      return aPriority - bPriority;
    });

    // 1) 按任务类型分组（使用已有 classifyTaskType 的关键词）
    const groups = new Map<string, Task[]>();
    for (const t of prioritizedTasks) {
      const type = this.classifyTaskType(t.description);
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type)!.push(t);
    }

    // 2) 按批次大小切分
    for (const [type, typeTasks] of groups) {
      for (let i = 0; i < typeTasks.length; i += batchSize) {
        const batch = typeTasks.slice(i, i + batchSize);
        batches.push(batch);
        console.log(`${LOG_PREFIX} [BATCH_CREATED] type=${type}, batchIndex=${Math.floor(i / batchSize)}, size=${batch.length}`);
      }
    }

    // 如果没有分类，直接平排序批次
    if (batches.length === 0) {
      for (let i = 0; i < prioritizedTasks.length; i += batchSize) {
        batches.push(prioritizedTasks.slice(i, i + batchSize));
      }
    }

    return batches;
  }

  // 批量合并为组合任务（减少调度开销）
  coalesceBatch(batch: Task[]): Task {
    if (batch.length === 0) {
      return {
        id: uuidv4(),
        userId: 'system',
        description: '空批次',
        status: 'pending',
        priority: 'low',
        subtasks: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    const mergedSubtasks = batch.flatMap(t => t.subtasks);
    const unique = new Map<string, Subtask>();
    for (const st of mergedSubtasks) {
      unique.set(st.description, st);
    }

    const highestPriority: Task['priority'] = batch.reduce(
      (acc, t) => (this.taskPriorityOrder[(t.priority || 'low') as string] < this.taskPriorityOrder[acc] ? (t.priority || 'low') : acc),
      'low' as Task['priority']
    );

    const merged: Task = {
      id: uuidv4(),
      userId: batch[0].userId,
      description: `[批量 ${batch.length}] ${batch.map(t => t.description.slice(0, 40)).join(' / ')}`,
      status: 'pending',
      priority: highestPriority,
      subtasks: [...unique.values()],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log(`${LOG_PREFIX} [BATCH_COALESCED] from=${batch.length} tasks, subtasks=${merged.subtasks.length}`);
    return merged;
  }

  // === 增强：任务优先级动态调整（基于多因素的综合评分） ===

  private priorityHistory: Array<{
    taskId: string;
    originalPriority: string;
    adjustedPriority: string;
    reason: string;
    timestamp: Date;
  }> = [];

  // 动态调整任务优先级
  adjustTaskPriority(
    task: Task,
    context: {
      urgency?: boolean;
      deadline?: Date;
      dependsOnOtherTasks?: boolean;
      isBlocked?: boolean;
      userFeedback?: 'positive' | 'negative' | 'neutral';
      complexityBoost?: number;
      currentLoad?: number;
    }
  ): Task {
    const originalPriority = task.priority || 'low';

    // 基础评分：low=0, medium=0.5, high=1
    const baseScore = originalPriority === 'high' ? 1 : originalPriority === 'medium' ? 0.5 : 0;
    let score = baseScore;
    let reasons: string[] = [];

    if (context.urgency) {
      score += 0.5;
      reasons.push('紧急');
    }

    if (context.deadline) {
      const hoursUntil = (context.deadline.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntil < 1) {
        score += 0.6;
        reasons.push(`1h截止`);
      } else if (hoursUntil < 4) {
        score += 0.3;
        reasons.push(`${Math.round(hoursUntil)}h截止`);
      } else if (hoursUntil < 24) {
        score += 0.15;
      }
    }

    if (context.isBlocked) {
      score -= 0.4;
      reasons.push('被阻塞');
    } else if (context.dependsOnOtherTasks) {
      score += 0.15;
      reasons.push('被依赖');
    }

    if (context.userFeedback === 'positive') score += 0.1;
    else if (context.userFeedback === 'negative') score -= 0.2;

    if (context.complexityBoost) score += context.complexityBoost;

    // 当前系统负载高时，降低低优先级任务
    if (context.currentLoad && context.currentLoad > 0.8 && score < 0.8) {
      score -= 0.1;
      reasons.push('高负载降级');
    }

    // 将 score 映射回三档优先级
    let adjustedPriority: Task['priority'];
    if (score >= 0.7) adjustedPriority = 'high';
    else if (score >= 0.3) adjustedPriority = 'medium';
    else adjustedPriority = 'low';

    if (adjustedPriority !== originalPriority) {
      this.priorityHistory.push({
        taskId: task.id,
        originalPriority,
        adjustedPriority,
        reason: reasons.join(', ') || '自动调整',
        timestamp: new Date()
      });

      console.log(
        `${LOG_PREFIX} [PRIORITY_ADJUSTED] taskId=${task.id}, ${originalPriority} -> ${adjustedPriority}, ` +
        `score=${score.toFixed(2)}, reason=${reasons.join(', ')}`
      );

      return { ...task, priority: adjustedPriority, updatedAt: new Date() };
    }

    return task;
  }

  // 获取优先级调整历史
  getPriorityHistory() {
    return [...this.priorityHistory];
  }

  // === 增强：智能任务合并（基于内容相似度和语义指纹） ===

  // 合并相似任务（去重、减少重复工作）
  mergeSimilarTasks(tasks: Task[], threshold: number = 0.6): Task[] {
    if (tasks.length <= 1) return tasks;

    const mergedTasks: Task[] = [];
    const processed = new Set<string>();

    // 预计算每个任务的指纹
    const fingerprints = tasks.map(t => this.computeTaskFingerprint(t));

    for (let i = 0; i < tasks.length; i++) {
      if (processed.has(tasks[i].id)) continue;

      const base = tasks[i];
      const similar: Task[] = [base];

      for (let j = i + 1; j < tasks.length; j++) {
        if (processed.has(tasks[j].id)) continue;
        const sim = this.compareFingerprints(fingerprints[i], fingerprints[j]);
        if (sim >= threshold) {
          similar.push(tasks[j]);
          processed.add(tasks[j].id);
        }
      }

      if (similar.length > 1) {
        // 合并所有子任务
        const uniqueSubtasks = new Map<string, Subtask>();
        for (const t of similar) {
          for (const st of t.subtasks) {
            if (!uniqueSubtasks.has(st.description)) {
              uniqueSubtasks.set(st.description, st);
            }
          }
        }

        const highestPriority: Task['priority'] = similar.reduce(
          (acc, t) => (this.taskPriorityOrder[(t.priority || 'low') as string] < this.taskPriorityOrder[acc] ? (t.priority || 'low') : acc),
          'low' as Task['priority']
        );

        const merged: Task = {
          id: uuidv4(),
          userId: base.userId,
          description: `[合并 x${similar.length}] ${similar.map(t => t.description.slice(0, 30)).join(' | ')}`,
          status: 'pending',
          priority: highestPriority,
          subtasks: [...uniqueSubtasks.values()],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        mergedTasks.push(merged);
        processed.add(base.id);
        console.log(`${LOG_PREFIX} [TASKS_MERGED] from=${similar.length}, mergedId=${merged.id}, subtasks=${merged.subtasks.length}`);
      } else {
        mergedTasks.push(base);
        processed.add(base.id);
      }
    }

    return mergedTasks;
  }

  // 计算任务的简单语义指纹（词频集合 + 关键词匹配）
  private computeTaskFingerprint(task: Task): Set<string> {
    const tokens: string[] = [];
    const desc = task.description.toLowerCase();
    const stopwords = new Set(['的', '是', '了', '和', '与', '或', '在', '我', '你', '他', '她', 'a', 'the', 'is', 'and', 'or']);

    for (const token of desc.split(/[\s,，。.!?？、]+/)) {
      const trimmed = token.trim();
      if (trimmed.length >= 2 && !stopwords.has(trimmed)) {
        tokens.push(trimmed);
        // 也加上常见关键词
        if (['搜索', '查询', '查找', '代码', '编程', '分析', '调试', '翻译', '写', '优化', '设计', '计划'].some(kw => trimmed.includes(kw))) {
          tokens.push(trimmed);
        }
      }
    }

    // 加入子任务描述的关键词
    for (const st of task.subtasks) {
      const sub = st.description.toLowerCase();
      for (const token of sub.split(/[\s,，。.!?？、]+/)) {
        if (token.length >= 2) tokens.push(token);
      }
    }

    return new Set(tokens);
  }

  // 比较两个指纹的 Jaccard 相似度
  private compareFingerprints(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    for (const t of a) if (b.has(t)) intersection++;
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  // 计算任务相似度（对外 API）
  calculateTaskSimilarity(task1: Task, task2: Task): number {
    const fp1 = this.computeTaskFingerprint(task1);
    const fp2 = this.computeTaskFingerprint(task2);
    return this.compareFingerprints(fp1, fp2);
  }

  // === 增强：任务执行预估（基于历史 + 子任务特征的时间/资源预估） ===

  // 执行历史学习
  private executionStats: Array<{
    subtaskDesc: string;
    durationMs: number;
    success: boolean;
    toolName?: string;
  }> = [];

  // 记录实际执行数据，用于改进后续预测
  recordExecution(subtaskDesc: string, durationMs: number, success: boolean, toolName?: string): void {
    this.executionStats.push({ subtaskDesc, durationMs, success, toolName });
    if (this.executionStats.length > 1000) this.executionStats.shift();
  }

  // 预估单个任务耗时 + 资源 + 信心度
  estimateTaskDuration(task: Task): {
    estimatedMinutes: number;
    breakdown: Record<string, number>;
    confidence: number;
    minMinutes: number;
    maxMinutes: number;
    resourceEstimate: ResourcePool;
  } {
    const breakdown: Record<string, number> = {};
    let totalMinutes = 0;
    let minTotal = 0;
    let maxTotal = 0;
    let resourceEstimate: ResourcePool = { computeUnits: 0, memoryMB: 0, networkBandwidth: 0, toolSlots: 0 };

    for (const subtask of task.subtasks) {
      const description = subtask.description.toLowerCase();

      // 基于历史的估计（如果有相似记录）
      const similarStats = this.executionStats.filter(s =>
        s.subtaskDesc.toLowerCase().includes(description.slice(0, 10)) ||
        description.includes(s.subtaskDesc.toLowerCase().slice(0, 10))
      );
      let estimate = 1;

      if (similarStats.length > 0) {
        const avg = similarStats.reduce((sum, s) => sum + s.durationMs, 0) / similarStats.length;
        estimate = Math.max(0.1, avg / 60000); // 转为分钟
      } else {
        // 基于规则
        if (subtask.toolName) estimate += 1;
        if (description.includes('搜索') || description.includes('查找')) estimate += 1.5;
        if (description.includes('分析') || description.includes('研究') || description.includes('评估')) estimate += 2;
        if (description.includes('编写') || description.includes('生成') || description.includes('创建')) estimate += 1.5;
        if (description.includes('验证') || description.includes('测试')) estimate += 1;
        if (description.includes('审查') || description.includes('优化')) estimate += 1;
        if (description.includes('搜索网络') || description.includes('web')) estimate += 2;
        if (description.includes('训练') || description.includes('模型')) estimate += 5;
      }

      breakdown[subtask.description] = estimate;
      totalMinutes += estimate;
      minTotal += estimate * 0.6;
      maxTotal += estimate * 1.8;

      // 资源估计累加
      if (subtask.toolName) {
        resourceEstimate = {
          computeUnits: resourceEstimate.computeUnits + 1,
          memoryMB: resourceEstimate.memoryMB + 50,
          networkBandwidth: resourceEstimate.networkBandwidth + 10,
          toolSlots: resourceEstimate.toolSlots + 1
        };
      } else {
        resourceEstimate = {
          ...resourceEstimate,
          computeUnits: resourceEstimate.computeUnits + 0.5
        };
      }
    }

    // 基于子任务数量与历史长度调整信心度
    let confidence = 0.6;
    const hasHistory = this.executionStats.filter(s =>
      task.subtasks.some(st => st.description.toLowerCase().includes(s.subtaskDesc.toLowerCase().slice(0, 8)))
    ).length;
    confidence += Math.min(0.25, hasHistory * 0.02);

    if (task.subtasks.length > 10) confidence -= 0.1;
    else if (task.subtasks.length < 3) confidence += 0.05;

    confidence = Math.max(0.3, Math.min(0.95, confidence));

    return {
      estimatedMinutes: Math.round(totalMinutes * 100) / 100,
      breakdown,
      confidence,
      minMinutes: Math.round(minTotal * 100) / 100,
      maxMinutes: Math.round(maxTotal * 100) / 100,
      resourceEstimate
    };
  }

  // 预估完成时间（绝对时间）
  estimateETA(task: Task, queuedAt: Date = new Date()): Date {
    const est = this.estimateTaskDuration(task);
    const bufferMs = est.estimatedMinutes * 60 * 1000;
    return new Date(queuedAt.getTime() + bufferMs);
  }

  // === 增强：综合决策入口 ===
  comprehensiveDecisionProcess(description: string, userId: string, context: {
    urgency?: boolean;
    deadline?: Date;
    workflowType?: string;
    userFeedback?: 'positive' | 'negative' | 'neutral';
    currentLoad?: number;
  } = {}): {
    task: Task;
    scheduledSubtasks: Subtask[];
    batches: Subtask[][];
    taskType: string;
    estimatedDuration: ReturnType<DecisionEngine['estimateTaskDuration']>;
    feasibility: { feasible: boolean; score: number; blockers?: string[] };
    alternativePlans: Task[];
    eta: Date;
  } {
    console.log(`${LOG_PREFIX} [COMPREHENSIVE_DECISION_START] userId=${userId}`);

    // 1) 分解任务
    const task = this.decomposeTask(description, userId);

    // 2) 动态调整优先级
    const adjustedTask = this.adjustTaskPriority(task, context);

    // 3) 调度子任务（依赖图 + 资源感知）
    const scheduledSubtasks = this.scheduleSubtasks(adjustedTask.subtasks, {
      urgency: context.urgency ? 2 : 1,
      availableResources: this.resourcePool
    });

    // 4) 获取可并行批次
    const batches = this.getParallelBatches(adjustedTask.subtasks);

    // 5) 任务类型分类
    const taskType = this.classifyTaskType(description);

    // 6) 预估耗时
    const estimatedDuration = this.estimateTaskDuration(adjustedTask);

    // 7) 可行性分析
    const feasibility = this.evaluateTaskFeasibility(adjustedTask);

    // 8) 生成备选方案
    const alternativePlans = this.generateAlternativePlans(adjustedTask, 2);

    // 9) 初始化状态机
    this.transitionTaskState(adjustedTask.id, 'created', '任务创建成功');
    this.transitionTaskState(adjustedTask.id, 'pending', '等待调度执行');

    // 10) ETA 计算
    const eta = this.estimateETA(adjustedTask);

    console.log(
      `${LOG_PREFIX} [COMPREHENSIVE_DECISION_END] taskId=${adjustedTask.id}, ` +
      `type=${taskType}, subtasks=${adjustedTask.subtasks.length}, ` +
      `eta=${Math.round(estimatedDuration.estimatedMinutes)}min, confidence=${estimatedDuration.confidence.toFixed(2)}`
    );

    return {
      task: adjustedTask,
      scheduledSubtasks,
      batches,
      taskType,
      estimatedDuration,
      feasibility,
      alternativePlans,
      eta
    };
  }
}
