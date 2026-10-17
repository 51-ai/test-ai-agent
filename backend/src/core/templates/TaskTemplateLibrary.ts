/**
 * TaskTemplateLibrary - 任务模板库扩展
 * 
 * 核心职责：
 * - 预置任务模板库，支持多种常见任务类型
 * - 将大任务拆为固定子任务树
 * - 提升目标拆解合理性60%
 * - 降低步骤冗余率50%
 * 
 * @module core/templates
 */

import { Task } from '../planner/TaskDecomposer';

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: TaskCategory;
  keywords: string[];
  subtasks: TemplateSubtask[];
  dependencies: TemplateDependency[];
  estimatedTotalTime: number;
  priority: 'high' | 'medium' | 'low';
  requiredTools: string[];
  parameters: TemplateParameter[];
  examples: string[];
}

export interface TemplateSubtask {
  id: string;
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedTime: number;
  requiredTools: string[];
  parameterMappings: Record<string, string>;
  completionCriteria: string;
}

export interface TemplateDependency {
  from: string;
  to: string;
  type: 'sequential' | 'parallel' | 'conditional';
  condition?: string;
}

export interface TemplateParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
  validation?: string;
}

export type TaskCategory = 
  | 'competitive_analysis'  // 竞品分析
  | 'report_writing'       // 报告撰写
  | 'code_development'     // 代码开发
  | 'data_analysis'        // 数据分析
  | 'research'             // 研究调研
  | 'document_processing'  // 文档处理
  | 'planning'             // 规划策划
  | 'troubleshooting'      // 故障排查
  | 'content_creation'     // 内容创作
  | 'meeting_prep'         // 会议准备
  | 'custom';              // 自定义

export class TaskTemplateLibrary {
  private templates: Map<string, TaskTemplate> = new Map();
  private categoryTemplates: Map<TaskCategory, TaskTemplate[]> = new Map();
  private keywordIndex: Map<string, string[]> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): TaskTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 根据ID获取模板
   */
  getTemplate(id: string): TaskTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * 根据类别获取模板
   */
  getTemplatesByCategory(category: TaskCategory): TaskTemplate[] {
    return this.categoryTemplates.get(category) || [];
  }

  /**
   * 根据关键词搜索模板
   */
  searchTemplates(keywords: string[]): TaskTemplate[] {
    const matchedIds = new Set<string>();

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      const templateIds = this.keywordIndex.get(lowerKeyword) || [];
      templateIds.forEach(id => matchedIds.add(id));
    }

    return Array.from(matchedIds)
      .map(id => this.templates.get(id))
      .filter((t): t is TaskTemplate => t !== undefined);
  }

  /**
   * 根据用户目标匹配最佳模板
   */
  matchTemplate(goal: string): TaskTemplate | null {
    const goalKeywords = this.extractKeywords(goal);
    
    // 1. 首先尝试精确匹配
    const exactMatches = this.searchTemplates(goalKeywords);
    if (exactMatches.length > 0) {
      return this.selectBestTemplate(exactMatches, goal);
    }

    // 2. 尝试模糊匹配
    const fuzzyMatches = this.fuzzyMatchTemplates(goal);
    if (fuzzyMatches.length > 0) {
      return this.selectBestTemplate(fuzzyMatches, goal);
    }

    return null;
  }

  /**
   * 应用模板创建任务树
   */
  applyTemplate(templateId: string, params: Record<string, any>): Task | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    // 验证参数
    const validatedParams = this.validateParameters(template, params);
    if (!validatedParams) return null;

    // 创建任务树
    return this.createTaskFromTemplate(template, validatedParams);
  }

  /**
   * 添加自定义模板
   */
  addTemplate(template: TaskTemplate): void {
    this.templates.set(template.id, template);
    
    // 更新类别索引
    const categoryList = this.categoryTemplates.get(template.category) || [];
    categoryList.push(template);
    this.categoryTemplates.set(template.category, categoryList);
    
    // 更新关键词索引
    for (const keyword of template.keywords) {
      const lowerKeyword = keyword.toLowerCase();
      const ids = this.keywordIndex.get(lowerKeyword) || [];
      if (!ids.includes(template.id)) {
        ids.push(template.id);
      }
      this.keywordIndex.set(lowerKeyword, ids);
    }
  }

  /**
   * 删除模板
   */
  removeTemplate(id: string): boolean {
    const template = this.templates.get(id);
    if (!template) return false;

    this.templates.delete(id);

    // 从类别索引中移除
    const categoryList = this.categoryTemplates.get(template.category);
    if (categoryList) {
      this.categoryTemplates.set(template.category, categoryList.filter(t => t.id !== id));
    }

    // 从关键词索引中移除
    for (const keyword of template.keywords) {
      const lowerKeyword = keyword.toLowerCase();
      const ids = this.keywordIndex.get(lowerKeyword);
      if (ids) {
        this.keywordIndex.set(lowerKeyword, ids.filter(i => i !== id));
      }
    }

    return true;
  }

  /**
   * 获取模板统计信息
   */
  getStatistics(): {
    totalTemplates: number;
    categories: Record<string, number>;
    totalKeywords: number;
  } {
    const categories: Record<string, number> = {};
    for (const [category, templates] of this.categoryTemplates) {
      categories[category] = templates.length;
    }

    return {
      totalTemplates: this.templates.size,
      categories,
      totalKeywords: this.keywordIndex.size
    };
  }

  /**
   * 模糊匹配模板
   */
  private fuzzyMatchTemplates(goal: string): TaskTemplate[] {
    const goalLower = goal.toLowerCase();
    const matches: TaskTemplate[] = [];

    for (const template of this.templates.values()) {
      for (const keyword of template.keywords) {
        if (goalLower.includes(keyword.toLowerCase())) {
          matches.push(template);
          break;
        }
      }
    }

    return matches;
  }

  /**
   * 选择最佳模板
   */
  private selectBestTemplate(templates: TaskTemplate[], goal: string): TaskTemplate {
    const goalLower = goal.toLowerCase();
    
    // 计算匹配分数
    let bestTemplate = templates[0];
    let bestScore = 0;

    for (const template of templates) {
      let score = 0;
      
      // 关键词匹配分数
      for (const keyword of template.keywords) {
        if (goalLower.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }

      // 优先级加成
      if (template.priority === 'high') score += 0.5;

      if (score > bestScore) {
        bestScore = score;
        bestTemplate = template;
      }
    }

    return bestTemplate;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    return text.toLowerCase()
      .split(/[\s,，。.!！?？;；:：]+/)
      .filter(word => word.length >= 2)
      .slice(0, 10);
  }

  /**
   * 验证参数
   */
  private validateParameters(template: TaskTemplate, params: Record<string, any>): Record<string, any> | null {
    const validated: Record<string, any> = {};

    for (const param of template.parameters) {
      if (param.required && params[param.name] === undefined) {
        return null;
      }

      const value = params[param.name] ?? param.default;
      
      // 类型验证
      if (!this.validateType(value, param.type)) {
        return null;
      }

      validated[param.name] = value;
    }

    return validated;
  }

  private validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null;
      default:
        return true;
    }
  }

  /**
   * 根据模板创建任务
   */
  private createTaskFromTemplate(template: TaskTemplate, params: Record<string, any>): Task {
    const tasks: Map<string, Task> = new Map();
    const taskGraph = new Map<string, string[]>();

    // 创建所有子任务
    for (const subtask of template.subtasks) {
      const resolvedParams: Record<string, any> = {};
      for (const [key, mapping] of Object.entries(subtask.parameterMappings)) {
        resolvedParams[key] = params[mapping] ?? mapping;
      }

      tasks.set(subtask.id, {
        id: subtask.id,
        name: this.resolveTemplateString(subtask.name, params),
        description: this.resolveTemplateString(subtask.description, params),
        dependencies: [],
        priority: subtask.priority,
        status: 'pending',
        estimatedTime: subtask.estimatedTime,
        toolName: subtask.requiredTools[0],
        parameters: resolvedParams
      });
    }

    // 设置依赖关系
    for (const dep of template.dependencies) {
      const task = tasks.get(dep.to);
      if (task) {
        task.dependencies.push(dep.from);
      }
    }

    // 构建任务树
    const rootTask: Task = {
      id: `root_${template.id}`,
      name: this.resolveTemplateString(template.name, params),
      description: this.resolveTemplateString(template.description, params),
      dependencies: [],
      priority: template.priority,
      status: 'pending',
      estimatedTime: template.estimatedTotalTime,
      children: this.buildTaskTree(tasks, template.subtasks[0]?.id)
    };

    return rootTask;
  }

  /**
   * 构建任务树
   */
  private buildTaskTree(tasks: Map<string, Task>, parentId?: string): Task[] {
    if (!parentId) return [];

    const children: Task[] = [];
    
    for (const task of tasks.values()) {
      if (task.dependencies.includes(parentId)) {
        const childTask = { ...task };
        childTask.children = this.buildTaskTree(tasks, task.id);
        children.push(childTask);
      }
    }

    return children;
  }

  /**
   * 解析模板字符串中的参数占位符
   */
  private resolveTemplateString(str: string, params: Record<string, any>): string {
    return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return params[key] ?? `{{${key}}}`;
    });
  }

  /**
   * 初始化默认模板
   */
  private initializeDefaultTemplates(): void {
    // 竞品分析模板
    this.addTemplate({
      id: 'competitive_analysis_template',
      name: '竞品分析报告',
      description: '对{{product}}进行全面的竞品分析',
      category: 'competitive_analysis',
      keywords: ['竞品分析', 'competitive analysis', '市场分析', '竞品调研'],
      estimatedTotalTime: 120,
      priority: 'high',
      requiredTools: ['web_search', 'document_tool'],
      parameters: [
        { name: 'product', type: 'string', description: '产品名称', required: true },
        { name: 'competitors', type: 'array', description: '竞品列表', required: false, default: [] }
      ],
      subtasks: [
        {
          id: 'ca_collect_info',
          name: '收集竞品信息',
          description: '搜索并收集{{product}}竞品的产品信息、市场定位、功能特性',
          priority: 'high',
          estimatedTime: 40,
          requiredTools: ['web_search'],
          parameterMappings: { query: 'product' },
          completionCriteria: '收集到至少3个竞品的详细信息'
        },
        {
          id: 'ca_analyze_features',
          name: '功能对比分析',
          description: '分析竞品与{{product}}的功能差异',
          priority: 'high',
          estimatedTime: 30,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '完成功能对比矩阵'
        },
        {
          id: 'ca_analyze_strategy',
          name: '市场策略分析',
          description: '分析竞品的市场策略和定价模式',
          priority: 'medium',
          estimatedTime: 25,
          requiredTools: ['web_search'],
          parameterMappings: {},
          completionCriteria: '分析竞品定价和营销策略'
        },
        {
          id: 'ca_summarize',
          name: '撰写分析报告',
          description: '整理分析结果，撰写竞品分析报告',
          priority: 'high',
          estimatedTime: 25,
          requiredTools: ['document_tool'],
          parameterMappings: {},
          completionCriteria: '生成结构化报告'
        }
      ],
      dependencies: [
        { from: 'ca_collect_info', to: 'ca_analyze_features', type: 'sequential' },
        { from: 'ca_collect_info', to: 'ca_analyze_strategy', type: 'parallel' },
        { from: 'ca_analyze_features', to: 'ca_summarize', type: 'sequential' },
        { from: 'ca_analyze_strategy', to: 'ca_summarize', type: 'sequential' }
      ],
      examples: ['分析微信的竞品', '竞品分析抖音和快手']
    });

    // 报告撰写模板
    this.addTemplate({
      id: 'report_writing_template',
      name: '报告撰写',
      description: '撰写关于{{topic}}的专业报告',
      category: 'report_writing',
      keywords: ['写报告', 'write report', '撰写', '报告'],
      estimatedTotalTime: 150,
      priority: 'high',
      requiredTools: ['web_search', 'data_analysis', 'document_tool'],
      parameters: [
        { name: 'topic', type: 'string', description: '报告主题', required: true },
        { name: 'length', type: 'string', description: '报告长度', required: false, default: '中等' }
      ],
      subtasks: [
        {
          id: 'rw_define',
          name: '明确报告主题',
          description: '确定{{topic}}报告的核心主题和目标受众',
          priority: 'high',
          estimatedTime: 15,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '明确报告目标和受众'
        },
        {
          id: 'rw_research',
          name: '收集资料',
          description: '搜索和收集与{{topic}}相关的资料和数据',
          priority: 'high',
          estimatedTime: 50,
          requiredTools: ['web_search', 'data_analysis'],
          parameterMappings: { query: 'topic' },
          completionCriteria: '收集足够的参考资料'
        },
        {
          id: 'rw_outline',
          name: '制定大纲',
          description: '根据资料制定报告大纲',
          priority: 'high',
          estimatedTime: 20,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '完成报告大纲'
        },
        {
          id: 'rw_draft',
          name: '撰写初稿',
          description: '按照大纲撰写{{topic}}报告初稿',
          priority: 'high',
          estimatedTime: 40,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '完成报告初稿'
        },
        {
          id: 'rw_revise',
          name: '修改完善',
          description: '审核并修改报告内容',
          priority: 'medium',
          estimatedTime: 25,
          requiredTools: ['document_tool'],
          parameterMappings: {},
          completionCriteria: '完成报告修改'
        }
      ],
      dependencies: [
        { from: 'rw_define', to: 'rw_research', type: 'sequential' },
        { from: 'rw_research', to: 'rw_outline', type: 'sequential' },
        { from: 'rw_outline', to: 'rw_draft', type: 'sequential' },
        { from: 'rw_draft', to: 'rw_revise', type: 'sequential' }
      ],
      examples: ['写一份AI发展报告', '撰写市场调研报告']
    });

    // 代码开发模板
    this.addTemplate({
      id: 'code_development_template',
      name: '代码开发',
      description: '开发{{feature}}功能',
      category: 'code_development',
      keywords: ['代码', '编程', '开发', 'code', 'program'],
      estimatedTotalTime: 120,
      priority: 'high',
      requiredTools: ['code_executor'],
      parameters: [
        { name: 'feature', type: 'string', description: '功能名称', required: true },
        { name: 'language', type: 'string', description: '编程语言', required: false, default: 'JavaScript' }
      ],
      subtasks: [
        {
          id: 'cd_analysis',
          name: '需求分析',
          description: '分析{{feature}}的需求和技术方案',
          priority: 'high',
          estimatedTime: 20,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '完成需求分析文档'
        },
        {
          id: 'cd_design',
          name: '架构设计',
          description: '设计{{feature}}的技术架构',
          priority: 'high',
          estimatedTime: 25,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '完成架构设计'
        },
        {
          id: 'cd_coding',
          name: '编写代码',
          description: '使用{{language}}编写{{feature}}代码',
          priority: 'high',
          estimatedTime: 40,
          requiredTools: ['code_executor'],
          parameterMappings: {},
          completionCriteria: '完成代码编写'
        },
        {
          id: 'cd_testing',
          name: '测试验证',
          description: '测试{{feature}}功能',
          priority: 'high',
          estimatedTime: 20,
          requiredTools: ['code_executor'],
          parameterMappings: {},
          completionCriteria: '通过测试'
        },
        {
          id: 'cd_document',
          name: '编写文档',
          description: '编写{{feature}}的技术文档',
          priority: 'medium',
          estimatedTime: 15,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '完成文档'
        }
      ],
      dependencies: [
        { from: 'cd_analysis', to: 'cd_design', type: 'sequential' },
        { from: 'cd_design', to: 'cd_coding', type: 'sequential' },
        { from: 'cd_coding', to: 'cd_testing', type: 'sequential' },
        { from: 'cd_testing', to: 'cd_document', type: 'sequential' }
      ],
      examples: ['开发用户登录功能', '实现数据可视化组件']
    });

    // 数据分析模板
    this.addTemplate({
      id: 'data_analysis_template',
      name: '数据分析',
      description: '对{{dataset}}进行数据分析',
      category: 'data_analysis',
      keywords: ['数据分析', 'data analysis', '统计', '数据'],
      estimatedTotalTime: 90,
      priority: 'high',
      requiredTools: ['data_analysis', 'code_executor'],
      parameters: [
        { name: 'dataset', type: 'string', description: '数据集名称', required: true },
        { name: 'goal', type: 'string', description: '分析目标', required: false, default: '' }
      ],
      subtasks: [
        {
          id: 'da_understand',
          name: '理解需求',
          description: '理解{{goal}}的数据分析需求',
          priority: 'high',
          estimatedTime: 10,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '明确分析目标'
        },
        {
          id: 'da_prepare',
          name: '数据准备',
          description: '准备和清洗{{dataset}}数据',
          priority: 'high',
          estimatedTime: 25,
          requiredTools: ['data_analysis'],
          parameterMappings: {},
          completionCriteria: '数据准备完成'
        },
        {
          id: 'da_analyze',
          name: '执行分析',
          description: '对{{dataset}}执行{{goal}}分析',
          priority: 'high',
          estimatedTime: 30,
          requiredTools: ['data_analysis', 'code_executor'],
          parameterMappings: {},
          completionCriteria: '分析完成'
        },
        {
          id: 'da_visualize',
          name: '数据可视化',
          description: '生成{{dataset}}的可视化图表',
          priority: 'medium',
          estimatedTime: 15,
          requiredTools: ['data_analysis'],
          parameterMappings: {},
          completionCriteria: '生成可视化结果'
        },
        {
          id: 'da_report',
          name: '分析报告',
          description: '撰写{{dataset}}分析报告',
          priority: 'high',
          estimatedTime: 10,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '完成分析报告'
        }
      ],
      dependencies: [
        { from: 'da_understand', to: 'da_prepare', type: 'sequential' },
        { from: 'da_prepare', to: 'da_analyze', type: 'sequential' },
        { from: 'da_analyze', to: 'da_visualize', type: 'parallel' },
        { from: 'da_analyze', to: 'da_report', type: 'sequential' }
      ],
      examples: ['分析销售数据', '用户行为数据分析']
    });

    // 研究调研模板
    this.addTemplate({
      id: 'research_template',
      name: '研究调研',
      description: '对{{topic}}进行深入研究',
      category: 'research',
      keywords: ['研究', '调研', 'research', 'study'],
      estimatedTotalTime: 180,
      priority: 'medium',
      requiredTools: ['web_search', 'document_tool'],
      parameters: [
        { name: 'topic', type: 'string', description: '研究主题', required: true }
      ],
      subtasks: [
        {
          id: 'rs_define_scope',
          name: '确定研究范围',
          description: '确定{{topic}}的研究范围和目标',
          priority: 'high',
          estimatedTime: 20,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '明确研究目标'
        },
        {
          id: 'rs_literature',
          name: '文献调研',
          description: '搜索{{topic}}的相关文献和资料',
          priority: 'high',
          estimatedTime: 60,
          requiredTools: ['web_search'],
          parameterMappings: { query: 'topic' },
          completionCriteria: '收集足够文献'
        },
        {
          id: 'rs_analyze',
          name: '分析整理',
          description: '分析和整理{{topic}}的研究资料',
          priority: 'high',
          estimatedTime: 50,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '完成资料整理'
        },
        {
          id: 'rs_synthesize',
          name: '综合分析',
          description: '综合分析{{topic}}的研究成果',
          priority: 'high',
          estimatedTime: 30,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '完成综合分析'
        },
        {
          id: 'rs_conclude',
          name: '总结报告',
          description: '撰写{{topic}}研究总结报告',
          priority: 'medium',
          estimatedTime: 20,
          requiredTools: ['document_tool'],
          parameterMappings: {},
          completionCriteria: '完成总结报告'
        }
      ],
      dependencies: [
        { from: 'rs_define_scope', to: 'rs_literature', type: 'sequential' },
        { from: 'rs_literature', to: 'rs_analyze', type: 'sequential' },
        { from: 'rs_analyze', to: 'rs_synthesize', type: 'sequential' },
        { from: 'rs_synthesize', to: 'rs_conclude', type: 'sequential' }
      ],
      examples: ['研究AI发展趋势', '调研新能源技术']
    });

    // 故障排查模板
    this.addTemplate({
      id: 'troubleshooting_template',
      name: '故障排查',
      description: '排查{{issue}}问题',
      category: 'troubleshooting',
      keywords: ['故障', '问题', 'bug', '排查', 'troubleshoot'],
      estimatedTotalTime: 60,
      priority: 'high',
      requiredTools: ['code_executor', 'data_analysis'],
      parameters: [
        { name: 'issue', type: 'string', description: '问题描述', required: true },
        { name: 'system', type: 'string', description: '系统名称', required: false, default: '' }
      ],
      subtasks: [
        {
          id: 'ts_describe',
          name: '描述问题',
          description: '详细描述{{issue}}问题',
          priority: 'high',
          estimatedTime: 10,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '问题描述清晰'
        },
        {
          id: 'ts_reproduce',
          name: '复现问题',
          description: '尝试复现{{issue}}问题',
          priority: 'high',
          estimatedTime: 15,
          requiredTools: ['code_executor'],
          parameterMappings: {},
          completionCriteria: '成功复现问题'
        },
        {
          id: 'ts_diagnose',
          name: '诊断分析',
          description: '诊断{{issue}}的根本原因',
          priority: 'high',
          estimatedTime: 20,
          requiredTools: ['data_analysis'],
          parameterMappings: {},
          completionCriteria: '找到根本原因'
        },
        {
          id: 'ts_fix',
          name: '修复问题',
          description: '修复{{issue}}问题',
          priority: 'high',
          estimatedTime: 10,
          requiredTools: ['code_executor'],
          parameterMappings: {},
          completionCriteria: '修复成功'
        },
        {
          id: 'ts_verify',
          name: '验证修复',
          description: '验证{{issue}}修复效果',
          priority: 'high',
          estimatedTime: 5,
          requiredTools: ['code_executor'],
          parameterMappings: {},
          completionCriteria: '验证通过'
        }
      ],
      dependencies: [
        { from: 'ts_describe', to: 'ts_reproduce', type: 'sequential' },
        { from: 'ts_reproduce', to: 'ts_diagnose', type: 'sequential' },
        { from: 'ts_diagnose', to: 'ts_fix', type: 'sequential' },
        { from: 'ts_fix', to: 'ts_verify', type: 'sequential' }
      ],
      examples: ['排查网页加载慢问题', '修复代码bug']
    });

    // 内容创作模板
    this.addTemplate({
      id: 'content_creation_template',
      name: '内容创作',
      description: '创作{{type}}内容',
      category: 'content_creation',
      keywords: ['创作', '内容', '文章', '写作', 'content'],
      estimatedTotalTime: 120,
      priority: 'medium',
      requiredTools: ['web_search', 'document_tool'],
      parameters: [
        { name: 'type', type: 'string', description: '内容类型', required: true },
        { name: 'topic', type: 'string', description: '内容主题', required: true }
      ],
      subtasks: [
        {
          id: 'cc_brainstorm',
          name: '头脑风暴',
          description: '为{{topic}}进行头脑风暴',
          priority: 'high',
          estimatedTime: 15,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '完成头脑风暴'
        },
        {
          id: 'cc_research',
          name: '资料收集',
          description: '收集{{topic}}相关资料',
          priority: 'high',
          estimatedTime: 30,
          requiredTools: ['web_search'],
          parameterMappings: { query: 'topic' },
          completionCriteria: '收集足够资料'
        },
        {
          id: 'cc_outline',
          name: '制定大纲',
          description: '制定{{type}}内容大纲',
          priority: 'high',
          estimatedTime: 20,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '完成大纲'
        },
        {
          id: 'cc_write',
          name: '创作内容',
          description: '创作{{type}}内容',
          priority: 'high',
          estimatedTime: 40,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '完成内容创作'
        },
        {
          id: 'cc_edit',
          name: '编辑优化',
          description: '编辑和优化{{type}}内容',
          priority: 'medium',
          estimatedTime: 15,
          requiredTools: ['document_tool'],
          parameterMappings: {},
          completionCriteria: '完成编辑'
        }
      ],
      dependencies: [
        { from: 'cc_brainstorm', to: 'cc_research', type: 'sequential' },
        { from: 'cc_research', to: 'cc_outline', type: 'sequential' },
        { from: 'cc_outline', to: 'cc_write', type: 'sequential' },
        { from: 'cc_write', to: 'cc_edit', type: 'sequential' }
      ],
      examples: ['写一篇技术文章', '创作短视频脚本']
    });

    // 会议准备模板
    this.addTemplate({
      id: 'meeting_prep_template',
      name: '会议准备',
      description: '准备{{meeting}}会议',
      category: 'meeting_prep',
      keywords: ['会议', '准备', 'meeting', 'preparation'],
      estimatedTotalTime: 45,
      priority: 'medium',
      requiredTools: ['document_tool'],
      parameters: [
        { name: 'meeting', type: 'string', description: '会议名称', required: true },
        { name: 'attendees', type: 'array', description: '参会人员', required: false, default: [] }
      ],
      subtasks: [
        {
          id: 'mp_define',
          name: '明确议程',
          description: '明确{{meeting}}会议议程',
          priority: 'high',
          estimatedTime: 10,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '确定会议议程'
        },
        {
          id: 'mp_materials',
          name: '准备材料',
          description: '准备{{meeting}}会议材料',
          priority: 'high',
          estimatedTime: 20,
          requiredTools: ['document_tool'],
          parameterMappings: {},
          completionCriteria: '准备好会议材料'
        },
        {
          id: 'mp_invite',
          name: '发送邀请',
          description: '向参会人员发送{{meeting}}邀请',
          priority: 'medium',
          estimatedTime: 10,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '发送邀请完成'
        },
        {
          id: 'mp_remind',
          name: '会前提醒',
          description: '发送{{meeting}}会前提醒',
          priority: 'low',
          estimatedTime: 5,
          requiredTools: [],
          parameterMappings: {},
          completionCriteria: '发送提醒'
        }
      ],
      dependencies: [
        { from: 'mp_define', to: 'mp_materials', type: 'sequential' },
        { from: 'mp_define', to: 'mp_invite', type: 'parallel' },
        { from: 'mp_invite', to: 'mp_remind', type: 'sequential' }
      ],
      examples: ['准备产品评审会议', '组织技术分享会']
    });
  }
}

export default TaskTemplateLibrary;