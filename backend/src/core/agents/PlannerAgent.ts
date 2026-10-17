/**
 * PlannerAgent - 规划智能体
 * 
 * 核心职责：
 * - 目标理解与拆解
 * - 任务规划与优先级排序
 * - 依赖关系分析
 * - 执行路径优化
 * 
 * 目标：目标拆解合理性提升60%，步骤冗余率降低50%
 * 
 * @module core/agents
 */

import { ReActTemplate, ReActStep } from '../react/ReActTemplate';

export interface TaskPlan {
  id: string;
  goal: string;
  subTasks: SubTask[];
  dependencies: Dependency[];
  estimatedSteps: number;
  priority: Priority;
  createdAt: number;
  metadata: Record<string, any>;
}

export interface SubTask {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  requiredTools: string[];
  estimatedTime: number;
  dependencies: string[];
  status: 'pending' | 'ready' | 'running' | 'completed' | 'failed';
  result?: string;
  priority?: Priority;
}

export interface Dependency {
  fromTask: string;
  toTask: string;
  type: 'sequential' | 'parallel' | 'conditional';
  condition?: string;
}

export type TaskType = 
  | 'search' 
  | 'analysis' 
  | 'code' 
  | 'document' 
  | 'data' 
  | 'cloud' 
  | 'communication'
  | 'custom';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface PlanningContext {
  userGoal: string;
  availableTools: string[];
  constraints: string[];
  previousPlans?: TaskPlan[];
  userPreferences?: Record<string, any>;
}

export interface PlanningResult {
  plan: TaskPlan;
  reasoning: string;
  confidence: number;
  alternativePlans: TaskPlan[];
  warnings: string[];
}

export class PlannerAgent {
  private reactTemplate: ReActTemplate;
  private planCounter = 0;
  private taskTemplates: Map<TaskType, TaskTemplate> = new Map();

  constructor() {
    this.reactTemplate = new ReActTemplate({ language: 'zh' });
    this.initializeTaskTemplates();
  }

  /**
   * 核心规划方法 - 目标拆解与任务规划
   */
  plan(context: PlanningContext): PlanningResult {
    const startTime = Date.now();
    
    // 1. 理解目标
    const goalAnalysis = this.analyzeGoal(context.userGoal);
    
    // 2. 识别任务类型
    const taskTypes = this.identifyTaskTypes(goalAnalysis);
    
    // 3. 拆解为子任务（层次化任务分解，最大3层）
    const subTasks = this.decomposeTasks(goalAnalysis, taskTypes, context);
    
    // 4. 分析依赖关系
    const dependencies = this.analyzeDependencies(subTasks);
    
    // 5. 优化执行路径
    const optimizedTasks = this.optimizeExecutionPath(subTasks, dependencies);
    
    // 6. 生成最终计划
    const plan: TaskPlan = {
      id: this.generatePlanId(),
      goal: context.userGoal,
      subTasks: optimizedTasks,
      dependencies: dependencies,
      estimatedSteps: optimizedTasks.length,
      priority: this.determinePriority(goalAnalysis),
      createdAt: startTime,
      metadata: {
        goalAnalysis,
        taskTypes,
        planningTime: Date.now() - startTime
      }
    };

    // 7. 生成替代方案
    const alternativePlans = this.generateAlternativePlans(plan, context);

    // 8. 验证计划合理性
    const warnings = this.validatePlan(plan);

    return {
      plan,
      reasoning: this.generatePlanningReasoning(plan, goalAnalysis),
      confidence: this.calculatePlanningConfidence(plan, warnings),
      alternativePlans,
      warnings
    };
  }

  /**
   * 目标分析
   */
  private analyzeGoal(goal: string): GoalAnalysis {
    const keywords = this.extractKeywords(goal);
    const complexity = this.assessComplexity(goal);
    const domain = this.identifyDomain(keywords);
    const requiredCapabilities = this.identifyCapabilities(goal);

    return {
      originalGoal: goal,
      keywords,
      complexity,
      domain,
      requiredCapabilities,
      estimatedSubTasks: Math.ceil(complexity * 5),
      isMultiStep: complexity > 0.3
    };
  }

  /**
   * 层次化任务分解（最大3层深度）
   */
  private decomposeTasks(
    goalAnalysis: GoalAnalysis,
    taskTypes: TaskType[],
    context: PlanningContext
  ): SubTask[] {
    const subTasks: SubTask[] = [];
    let taskId = 0;

    // 第一层：主要任务阶段
    const mainPhases = this.createMainPhases(goalAnalysis, taskTypes);
    
    for (const phase of mainPhases) {
      const mainTask: SubTask = {
        id: `task_${taskId++}`,
        name: phase.name,
        description: phase.description,
        type: phase.type,
        requiredTools: phase.requiredTools,
        estimatedTime: phase.estimatedTime,
        dependencies: phase.dependencies,
        status: 'pending'
      };

      // 第二层：如果复杂度高，进一步分解
      if (goalAnalysis.complexity > 0.5 && phase.canDecompose) {
        const subPhases = this.createSubPhases(phase, context);
        mainTask.dependencies = subPhases.map(p => p.id).filter((id): id is string => id !== undefined);
        
        for (const subPhase of subPhases) {
          const subTask: SubTask = {
            id: `task_${taskId++}`,
            name: subPhase.name,
            description: subPhase.description,
            type: subPhase.type,
            requiredTools: subPhase.requiredTools,
            estimatedTime: subPhase.estimatedTime,
            dependencies: [],
            status: 'pending',
            priority: subPhase.priority
          };

          // 第三层：极端复杂任务再分解
          if (goalAnalysis.complexity > 0.8 && subPhase.canDecompose) {
            const microPhases = this.createMicroPhases(subPhase);
            subTask.dependencies = microPhases.map(p => p.id).filter((id): id is string => id !== undefined);
            
            for (const microPhase of microPhases) {
              subTasks.push({
                id: `task_${taskId++}`,
                name: microPhase.name,
                description: microPhase.description,
                type: microPhase.type,
                requiredTools: microPhase.requiredTools,
                estimatedTime: microPhase.estimatedTime,
                dependencies: [],
                status: 'pending',
                priority: microPhase.priority
              });
            }
          }
          
          subTasks.push(subTask);
        }
      }

      subTasks.push(mainTask);
    }

    return this.assignPriorities(subTasks);
  }

  /**
   * 创建主要任务阶段
   */
  private createMainPhases(goalAnalysis: GoalAnalysis, taskTypes: TaskType[]): Phase[] {
    const phases: Phase[] = [];

    // 根据任务类型创建标准阶段
    if (taskTypes.includes('search')) {
      phases.push({
        name: '信息收集阶段',
        description: '搜索和收集相关信息',
        type: 'search',
        requiredTools: ['web_search', 'document_tool'],
        estimatedTime: 30,
        dependencies: [],
        canDecompose: true
      });
    }

    if (taskTypes.includes('analysis')) {
      phases.push({
        name: '分析处理阶段',
        description: '对收集的信息进行分析和处理',
        type: 'analysis',
        requiredTools: ['data_analysis', 'code_executor'],
        estimatedTime: 45,
        dependencies: phases.length > 0 ? [phases[phases.length - 1].name] : [],
        canDecompose: true
      });
    }

    if (taskTypes.includes('code')) {
      phases.push({
        name: '代码实现阶段',
        description: '编写和执行代码',
        type: 'code',
        requiredTools: ['code_executor'],
        estimatedTime: 60,
        dependencies: [],
        canDecompose: true
      });
    }

    if (taskTypes.includes('document')) {
      phases.push({
        name: '文档处理阶段',
        description: '读取、处理或生成文档',
        type: 'document',
        requiredTools: ['document_tool'],
        estimatedTime: 20,
        dependencies: [],
        canDecompose: false
      });
    }

    if (taskTypes.includes('data')) {
      phases.push({
        name: '数据处理阶段',
        description: '数据查询、清洗和分析',
        type: 'data',
        requiredTools: ['data_analysis'],
        estimatedTime: 40,
        dependencies: [],
        canDecompose: true
      });
    }

    // 添加输出阶段
    phases.push({
      name: '结果输出阶段',
      description: '整理和输出最终结果',
      type: 'communication',
      requiredTools: [],
      estimatedTime: 15,
      dependencies: phases.length > 0 ? [phases[phases.length - 1].name] : [],
      canDecompose: false
    });

    return phases;
  }

  /**
   * 创建子阶段（第二层分解）
   */
  private createSubPhases(phase: Phase, context: PlanningContext): Phase[] {
    const template = this.taskTemplates.get(phase.type);
    if (!template) return [];

    return template.subPhases.map((subPhase, index) => ({
      id: `${phase.name}-${subPhase.name}`,
      name: `${phase.name}-${subPhase.name}`,
      description: subPhase.description,
      type: phase.type,
      requiredTools: subPhase.requiredTools || phase.requiredTools,
      estimatedTime: Math.ceil(phase.estimatedTime / template.subPhases.length),
      dependencies: index > 0 ? [`${phase.name}-${template.subPhases[index - 1].name}`] : [],
      canDecompose: subPhase.canDecompose || false
    }));
  }

  /**
   * 创建微阶段（第三层分解）
   */
  private createMicroPhases(phase: Phase): Phase[] {
    // 第三层分解：针对极端复杂任务的精细分解
    const microSteps = [
      { name: '初始化', description: '准备环境和参数' },
      { name: '核心执行', description: '执行主要操作' },
      { name: '验证检查', description: '验证执行结果' }
    ];

    return microSteps.map((step, index) => ({
      id: `${phase.name}-${step.name}`,
      name: `${phase.name}-${step.name}`,
      description: step.description,
      type: phase.type,
      requiredTools: phase.requiredTools,
      estimatedTime: Math.ceil(phase.estimatedTime / 3),
      dependencies: index > 0 ? [`${phase.name}-${microSteps[index - 1].name}`] : [],
      canDecompose: false
    }));
  }

  /**
   * 依赖关系分析
   */
  private analyzeDependencies(subTasks: SubTask[]): Dependency[] {
    const dependencies: Dependency[] = [];
    const taskMap = new Map(subTasks.map(t => [t.name, t.id]));

    for (const task of subTasks) {
      for (const depName of task.dependencies) {
        const depId = taskMap.get(depName);
        if (depId) {
          dependencies.push({
            fromTask: depId,
            toTask: task.id,
            type: 'sequential'
          });
        }
      }
    }

    // 识别可并行执行的任务
    const noDependencyTasks = subTasks.filter(t => t.dependencies.length === 0);
    if (noDependencyTasks.length > 1) {
      for (let i = 1; i < noDependencyTasks.length; i++) {
        dependencies.push({
          fromTask: noDependencyTasks[i - 1].id,
          toTask: noDependencyTasks[i].id,
          type: 'parallel'
        });
      }
    }

    return dependencies;
  }

  /**
   * 执行路径优化
   */
  private optimizeExecutionPath(tasks: SubTask[], dependencies: Dependency[]): SubTask[] {
    // 识别可并行执行的任务组
    const parallelGroups = this.identifyParallelGroups(tasks, dependencies);
    
    // 重新排序任务以最大化并行度
    const optimizedTasks = [...tasks];
    
    // 按优先级和依赖关系排序
    optimizedTasks.sort((a, b) => {
      // 无依赖的任务优先
      if (a.dependencies.length === 0 && b.dependencies.length > 0) return -1;
      if (b.dependencies.length === 0 && a.dependencies.length > 0) return 1;
      
      // 按估计时间排序（短任务优先）
      return a.estimatedTime - b.estimatedTime;
    });

    return optimizedTasks;
  }

  /**
   * 识别可并行执行的任务组
   */
  private identifyParallelGroups(tasks: SubTask[], dependencies: Dependency[]): string[][] {
    const groups: string[][] = [];
    const visited = new Set<string>();
    const taskIds = new Set(tasks.map(t => t.id));

    // 找出没有依赖的任务作为并行组
    const noDepTasks = tasks.filter(t => 
      !dependencies.some(d => d.toTask === t.id && d.type === 'sequential')
    );

    if (noDepTasks.length > 1) {
      groups.push(noDepTasks.map(t => t.id));
    }

    return groups;
  }

  /**
   * 任务类型识别
   */
  private identifyTaskTypes(goalAnalysis: GoalAnalysis): TaskType[] {
    const types: TaskType[] = [];
    const keywords = goalAnalysis.keywords;

    if (keywords.some(k => ['搜索', '查找', '查询', 'search', 'find', 'query'].includes(k))) {
      types.push('search');
    }
    if (keywords.some(k => ['分析', '统计', '计算', 'analyze', 'calculate', 'statistics'].includes(k))) {
      types.push('analysis');
    }
    if (keywords.some(k => ['代码', '编程', '实现', 'code', 'program', 'implement'].includes(k))) {
      types.push('code');
    }
    if (keywords.some(k => ['文档', '文件', '报告', 'document', 'file', 'report'].includes(k))) {
      types.push('document');
    }
    if (keywords.some(k => ['数据', '数据库', '表格', 'data', 'database', 'table'].includes(k))) {
      types.push('data');
    }
    if (keywords.some(k => ['云', '服务器', '部署', 'cloud', 'server', 'deploy'].includes(k))) {
      types.push('cloud');
    }

    // 默认类型
    if (types.length === 0) {
      types.push('custom');
    }

    return types;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(goal: string): string[] {
    return goal.toLowerCase()
      .split(/[\s,，。.!！?？;；:：]+/)
      .filter(word => word.length >= 2)
      .slice(0, 20);
  }

  /**
   * 评估复杂度
   */
  private assessComplexity(goal: string): number {
    const factors = {
      length: goal.length > 100 ? 0.3 : goal.length > 50 ? 0.2 : 0.1,
      keywords: this.extractKeywords(goal).length > 10 ? 0.3 : 0.2,
      multiAction: /和|以及|同时|and|also|while/.test(goal) ? 0.2 : 0,
      conditional: /如果|当|if|when|condition/.test(goal) ? 0.2 : 0,
      technical: /算法|模型|代码|algorithm|model|code/.test(goal) ? 0.1 : 0
    };

    return Math.min(1, Object.values(factors).reduce((a, b) => a + b, 0));
  }

  /**
   * 识别领域
   */
  private identifyDomain(keywords: string[]): string {
    const domains: Record<string, string[]> = {
      '技术': ['代码', '算法', '开发', 'code', 'algorithm', 'develop'],
      '商业': ['市场', '竞品', '分析', 'market', 'competitor', 'analysis'],
      '数据': ['数据', '统计', '报表', 'data', 'statistics', 'report'],
      '文档': ['文档', '报告', '撰写', 'document', 'report', 'write']
    };

    for (const [domain, domainKeywords] of Object.entries(domains)) {
      if (keywords.some(k => domainKeywords.includes(k))) {
        return domain;
      }
    }

    return '通用';
  }

  /**
   * 识别所需能力
   */
  private identifyCapabilities(goal: string): string[] {
    const capabilities: string[] = [];

    if (/搜索|查找|获取|search|find|get/.test(goal)) capabilities.push('search');
    if (/分析|处理|计算|analyze|process|calculate/.test(goal)) capabilities.push('analysis');
    if (/代码|编程|执行|code|program|execute/.test(goal)) capabilities.push('code_execution');
    if (/文档|文件|读取|document|file|read/.test(goal)) capabilities.push('document_processing');
    if (/数据|查询|统计|data|query|statistics/.test(goal)) capabilities.push('data_processing');

    return capabilities;
  }

  /**
   * 确定优先级
   */
  private determinePriority(goalAnalysis: GoalAnalysis): Priority {
    if (goalAnalysis.complexity > 0.8) return 'critical';
    if (goalAnalysis.complexity > 0.6) return 'high';
    if (goalAnalysis.complexity > 0.4) return 'medium';
    return 'low';
  }

  /**
   * 分配优先级到子任务
   */
  private assignPriorities(tasks: SubTask[]): SubTask[] {
    return tasks.map(task => ({
      ...task,
      priority: this.getTaskPriority(task)
    }));
  }

  private getTaskPriority(task: SubTask): Priority {
    // 关键路径上的任务优先级更高
    if (task.dependencies.length === 0) return 'high';
    if (task.type === 'search') return 'high';
    if (task.type === 'analysis') return 'medium';
    return 'low';
  }

  /**
   * 生成替代方案
   */
  private generateAlternativePlans(mainPlan: TaskPlan, context: PlanningContext): TaskPlan[] {
    const alternatives: TaskPlan[] = [];

    // 方案1：简化路径（减少步骤）
    if (mainPlan.subTasks.length > 5) {
      alternatives.push(this.createSimplifiedPlan(mainPlan));
    }

    // 方案2：保守路径（增加验证步骤）
    alternatives.push(this.createConservativePlan(mainPlan));

    return alternatives;
  }

  private createSimplifiedPlan(plan: TaskPlan): TaskPlan {
    // 合并相似任务
    const mergedTasks = this.mergeSimilarTasks(plan.subTasks);
    
    return {
      ...plan,
      id: this.generatePlanId(),
      subTasks: mergedTasks,
      estimatedSteps: mergedTasks.length,
      metadata: { ...plan.metadata, strategy: 'simplified' }
    };
  }

  private createConservativePlan(plan: TaskPlan): TaskPlan {
    // 在每个关键步骤后添加验证任务
    const tasksWithValidation = plan.subTasks.map(task => [
      task,
      {
        id: `validate_${task.id}`,
        name: `验证-${task.name}`,
        description: `验证 ${task.name} 的执行结果`,
        type: 'custom' as TaskType,
        requiredTools: [],
        estimatedTime: 5,
        dependencies: [task.id],
        status: 'pending' as const
      }
    ]).flat();

    return {
      ...plan,
      id: this.generatePlanId(),
      subTasks: tasksWithValidation,
      estimatedSteps: tasksWithValidation.length,
      metadata: { ...plan.metadata, strategy: 'conservative' }
    };
  }

  private mergeSimilarTasks(tasks: SubTask[]): SubTask[] {
    const merged: SubTask[] = [];
    const groupedByType = new Map<TaskType, SubTask[]>();

    for (const task of tasks) {
      const group = groupedByType.get(task.type) || [];
      group.push(task);
      groupedByType.set(task.type, group);
    }

    groupedByType.forEach((group, type) => {
      if (group.length > 1 && group.every(t => t.dependencies.length === 0)) {
        merged.push({
          id: `merged_${type}`,
          name: `合并-${type}任务`,
          description: group.map(t => t.description).join('; '),
          type,
          requiredTools: group.flatMap(t => t.requiredTools),
          estimatedTime: group.reduce((sum, t) => sum + t.estimatedTime, 0),
          dependencies: [],
          status: 'pending'
        });
      } else {
        merged.push(...group);
      }
    });

    return merged;
  }

  /**
   * 验证计划合理性
   */
  private validatePlan(plan: TaskPlan): string[] {
    const warnings: string[] = [];

    // 检查步骤数量
    if (plan.subTasks.length > 15) {
      warnings.push('任务步骤过多，建议简化或分批执行');
    }

    // 检查依赖循环
    const hasCycle = this.checkDependencyCycle(plan.dependencies);
    if (hasCycle) {
      warnings.push('存在依赖循环，需要调整任务顺序');
    }

    // 检查工具可用性
    const allTools = plan.subTasks.flatMap(t => t.requiredTools);
    const unavailableTools = allTools.filter(t => 
      !this.reactTemplate.getConfig().availableTools.includes(t)
    );
    if (unavailableTools.length > 0) {
      warnings.push(`部分工具不可用: ${unavailableTools.join(', ')}`);
    }

    // 检查时间估算合理性
    const totalTime = plan.subTasks.reduce((sum, t) => sum + t.estimatedTime, 0);
    if (totalTime > 180) {
      warnings.push('预计执行时间过长，建议拆分为多个会话');
    }

    return warnings;
  }

  private checkDependencyCycle(dependencies: Dependency[]): boolean {
    const graph = new Map<string, string[]>();
    
    for (const dep of dependencies) {
      const edges = graph.get(dep.fromTask) || [];
      edges.push(dep.toTask);
      graph.set(dep.fromTask, edges);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    let hasCycle = false;

    graph.forEach((_, node) => {
      if (hasCycle) return;
      if (this.hasCycleDFS(node, graph, visited, recursionStack)) {
        hasCycle = true;
      }
    });

    return hasCycle;
  }

  private hasCycleDFS(
    node: string,
    graph: Map<string, string[]>,
    visited: Set<string>,
    recursionStack: Set<string>
  ): boolean {
    if (recursionStack.has(node)) return true;
    if (visited.has(node)) return false;

    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (this.hasCycleDFS(neighbor, graph, visited, recursionStack)) {
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }

  /**
   * 生成规划推理说明
   */
  private generatePlanningReasoning(plan: TaskPlan, goalAnalysis: GoalAnalysis): string {
    const parts: string[] = [];

    parts.push(`目标分析: ${goalAnalysis.domain}领域，复杂度${(goalAnalysis.complexity * 100).toFixed(0)}%`);
    parts.push(`拆解策略: 层次化分解，共${plan.subTasks.length}个子任务`);
    parts.push(`执行路径: ${this.describeExecutionPath(plan.dependencies)}`);
    parts.push(`预计耗时: ${plan.subTasks.reduce((s, t) => s + t.estimatedTime, 0)}秒`);

    return parts.join('\n');
  }

  private describeExecutionPath(dependencies: Dependency[]): string {
    const sequential = dependencies.filter(d => d.type === 'sequential').length;
    const parallel = dependencies.filter(d => d.type === 'parallel').length;

    if (parallel > 0) {
      return `混合路径(${sequential}个顺序步骤，${parallel}个并行步骤)`;
    }
    return `纯顺序路径(${sequential}个步骤)`;
  }

  /**
   * 计算规划置信度
   */
  private calculatePlanningConfidence(plan: TaskPlan, warnings: string[]): number {
    let confidence = 1.0;

    // 根据警告数量降低置信度
    confidence -= warnings.length * 0.1;

    // 根据任务数量调整
    if (plan.subTasks.length > 10) confidence -= 0.1;
    if (plan.subTasks.length < 3) confidence -= 0.05;

    // 根据依赖复杂度调整
    const complexDeps = plan.dependencies.filter(d => d.type === 'conditional').length;
    confidence -= complexDeps * 0.05;

    return Math.max(0.3, Math.min(1.0, confidence));
  }

  /**
   * 初始化任务模板库
   */
  private initializeTaskTemplates(): void {
    this.taskTemplates.set('search', {
      type: 'search',
      subPhases: [
        { name: '关键词提取', description: '提取搜索关键词', type: 'search', requiredTools: [], estimatedTime: 5, dependencies: [], canDecompose: false },
        { name: '信息检索', description: '执行搜索操作', type: 'search', requiredTools: ['web_search'], estimatedTime: 15, dependencies: [], canDecompose: false },
        { name: '结果筛选', description: '筛选和整理搜索结果', type: 'search', requiredTools: [], estimatedTime: 10, dependencies: [], canDecompose: false }
      ]
    });

    this.taskTemplates.set('analysis', {
      type: 'analysis',
      subPhases: [
        { name: '数据准备', description: '准备分析数据', type: 'analysis', requiredTools: ['data_analysis'], estimatedTime: 15, dependencies: [], canDecompose: true },
        { name: '核心分析', description: '执行分析逻辑', type: 'analysis', requiredTools: ['data_analysis', 'code_executor'], estimatedTime: 20, dependencies: [], canDecompose: true },
        { name: '结果解读', description: '解读分析结果', type: 'analysis', requiredTools: [], estimatedTime: 10, dependencies: [], canDecompose: false }
      ]
    });

    this.taskTemplates.set('code', {
      type: 'code',
      subPhases: [
        { name: '需求分析', description: '分析代码需求', type: 'code', requiredTools: [], estimatedTime: 10, dependencies: [], canDecompose: false },
        { name: '代码编写', description: '编写代码', type: 'code', requiredTools: ['code_executor'], estimatedTime: 30, dependencies: [], canDecompose: true },
        { name: '代码测试', description: '测试代码', type: 'code', requiredTools: ['code_executor'], estimatedTime: 15, dependencies: [], canDecompose: false }
      ]
    });

    this.taskTemplates.set('document', {
      type: 'document',
      subPhases: [
        { name: '文档读取', description: '读取文档内容', type: 'document', requiredTools: ['document_tool'], estimatedTime: 10, dependencies: [], canDecompose: false },
        { name: '内容处理', description: '处理文档内容', type: 'document', requiredTools: ['document_tool'], estimatedTime: 10, dependencies: [], canDecompose: false }
      ]
    });

    this.taskTemplates.set('data', {
      type: 'data',
      subPhases: [
        { name: '数据查询', description: '查询数据', type: 'data', requiredTools: ['data_analysis'], estimatedTime: 15, dependencies: [], canDecompose: false },
        { name: '数据清洗', description: '清洗数据', type: 'data', requiredTools: ['data_analysis'], estimatedTime: 15, dependencies: [], canDecompose: true },
        { name: '数据统计', description: '统计分析', type: 'data', requiredTools: ['data_analysis'], estimatedTime: 10, dependencies: [], canDecompose: false }
      ]
    });
  }

  /**
   * 生成计划ID
   */
  private generatePlanId(): string {
    this.planCounter++;
    return `plan_${Date.now()}_${this.planCounter}`;
  }

  /**
   * 获取下一个可执行任务
   */
  getNextExecutableTask(plan: TaskPlan): SubTask | null {
    const completedIds = plan.subTasks
      .filter(t => t.status === 'completed')
      .map(t => t.id);

    const readyTasks = plan.subTasks.filter(t => {
      if (t.status !== 'pending') return false;
      
      // 检查所有依赖是否已完成
      return t.dependencies.every(depId => completedIds.includes(depId));
    });

    if (readyTasks.length === 0) return null;

    // 返回优先级最高的任务
    return readyTasks.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority || 'low'] - priorityOrder[b.priority || 'low'];
    })[0];
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(plan: TaskPlan, taskId: string, status: SubTask['status'], result?: string): TaskPlan {
    const task = plan.subTasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      if (result) task.result = result;
    }
    return plan;
  }

  /**
   * ReAct规划步骤生成
   */
  generateReActPlanStep(goal: string): ReActStep {
    return {
      thought: `分析目标"${goal}"，识别关键任务类型和执行路径`,
      action: 'planner',
      actionInput: { goal },
      observation: null,
      reflection: null
    };
  }
}

// === 辅助接口 ===

interface GoalAnalysis {
  originalGoal: string;
  keywords: string[];
  complexity: number;
  domain: string;
  requiredCapabilities: string[];
  estimatedSubTasks: number;
  isMultiStep: boolean;
}

interface Phase {
  id?: string;
  name: string;
  description: string;
  type: TaskType;
  requiredTools: string[];
  estimatedTime: number;
  dependencies: string[];
  canDecompose: boolean;
  priority?: Priority;
}

interface TaskTemplate {
  type: TaskType;
  subPhases: Phase[];
}

export default PlannerAgent;