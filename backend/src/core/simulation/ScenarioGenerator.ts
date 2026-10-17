/**
 * 场景生成器 - 自动创建训练和测试场景
 */

import {
  Scenario,
  ScenarioCategory,
  SimulatedUser,
  UserProfile,
  UserBehavior,
  ScenarioObjective,
  ScenarioConstraint,
  EvaluationCriteria,
  ScenarioMetadata
} from './types';

export class ScenarioGenerator {
  private templates: Map<ScenarioCategory, ScenarioTemplate>;
  private userProfiles: SimulatedUser[];

  constructor() {
    this.templates = this.initializeTemplates();
    this.userProfiles = this.initializeUserProfiles();
  }

  private initializeTemplates(): Map<ScenarioCategory, ScenarioTemplate> {
    const templates = new Map<ScenarioCategory, ScenarioTemplate>();

    // 对话场景模板
    templates.set('conversation', {
      category: 'conversation',
      objectives: [
        { id: 'greeting', description: '正确问候用户', required: true, weight: 0.2 },
        { id: 'understand_intent', description: '理解用户意图', required: true, weight: 0.3 },
        { id: 'provide_help', description: '提供有用的响应', required: true, weight: 0.3 },
        { id: 'natural_flow', description: '保持对话自然流畅', required: false, weight: 0.2 }
      ],
      constraints: [
        { type: 'max_turns', value: 10, description: '最多10轮对话' },
        { type: 'max_time', value: 60000, description: '响应时间不超过60秒' }
      ],
      evaluationCriteria: { accuracy: 0.3, relevance: 0.3, efficiency: 0.2, user_satisfaction: 0.2 }
    });

    // 问答场景模板
    templates.set('question_answering', {
      category: 'question_answering',
      objectives: [
        { id: 'understand_question', description: '准确理解问题', required: true, weight: 0.25 },
        { id: 'provide_answer', description: '提供正确答案', required: true, weight: 0.35 },
        { id: 'explain_reasoning', description: '清晰解释推理过程', required: false, weight: 0.2 },
        { id: 'cite_sources', description: '引用相关来源', required: false, weight: 0.2 }
      ],
      constraints: [
        { type: 'max_time', value: 30000, description: '回答时间不超过30秒' },
        { type: 'allowed_tools', value: ['search', 'knowledge'], description: '可以使用搜索和知识库' }
      ],
      evaluationCriteria: { accuracy: 0.4, relevance: 0.3, efficiency: 0.15, user_satisfaction: 0.15 }
    });

    // 工具使用场景
    templates.set('tool_usage', {
      category: 'tool_usage',
      objectives: [
        { id: 'identify_needed_tools', description: '识别需要使用的工具', required: true, weight: 0.25 },
        { id: 'use_tools_correctly', description: '正确使用工具', required: true, weight: 0.35 },
        { id: 'interpret_results', description: '正确解释工具结果', required: true, weight: 0.25 },
        { id: 'handle_errors', description: '妥善处理工具错误', required: false, weight: 0.15 }
      ],
      constraints: [
        { type: 'required_tools', value: ['code_executor', 'web_search'], description: '必须使用代码执行器和搜索工具' },
        { type: 'max_turns', value: 15, description: '最多15轮交互' }
      ],
      evaluationCriteria: { accuracy: 0.35, relevance: 0.25, efficiency: 0.2, user_satisfaction: 0.2 }
    });

    // 问题解决场景
    templates.set('problem_solving', {
      category: 'problem_solving',
      objectives: [
        { id: 'analyze_problem', description: '准确分析问题', required: true, weight: 0.2 },
        { id: 'develop_solution', description: '制定解决方案', required: true, weight: 0.3 },
        { id: 'implement_solution', description: '实施解决方案', required: true, weight: 0.3 },
        { id: 'verify_solution', description: '验证解决方案', required: false, weight: 0.2 }
      ],
      constraints: [
        { type: 'max_time', value: 120000, description: '总时间不超过2分钟' },
        { type: 'max_turns', value: 20, description: '最多20轮交互' }
      ],
      evaluationCriteria: { accuracy: 0.35, relevance: 0.25, efficiency: 0.2, user_satisfaction: 0.2 }
    });

    // 创意场景
    templates.set('creativity', {
      category: 'creativity',
      objectives: [
        { id: 'understand_theme', description: '理解创意主题', required: true, weight: 0.2 },
        { id: 'generate_ideas', description: '生成创意想法', required: true, weight: 0.3 },
        { id: 'provide_examples', description: '提供具体例子', required: true, weight: 0.25 },
        { id: 'maintain_coherence', description: '保持创意连贯性', required: false, weight: 0.25 }
      ],
      constraints: [
        { type: 'max_turns', value: 8, description: '最多8轮交互' }
      ],
      evaluationCriteria: { accuracy: 0.2, relevance: 0.3, efficiency: 0.2, user_satisfaction: 0.3 }
    });

    // 技术场景
    templates.set('technical', {
      category: 'technical',
      objectives: [
        { id: 'technical_accuracy', description: '技术准确性', required: true, weight: 0.4 },
        { id: 'code_quality', description: '代码质量', required: true, weight: 0.3 },
        { id: 'explanation_clarity', description: '解释清晰度', required: true, weight: 0.2 },
        { id: 'best_practices', description: '遵循最佳实践', required: false, weight: 0.1 }
      ],
      constraints: [
        { type: 'required_tools', value: ['code_executor'], description: '必须执行代码' },
        { type: 'max_time', value: 60000, description: '总时间不超过1分钟' }
      ],
      evaluationCriteria: { accuracy: 0.4, relevance: 0.25, efficiency: 0.15, user_satisfaction: 0.2 }
    });

    // 多轮对话场景
    templates.set('multi_turn', {
      category: 'multi_turn',
      objectives: [
        { id: 'context_tracking', description: '追踪对话上下文', required: true, weight: 0.25 },
        { id: 'maintain_memory', description: '保持记忆连贯', required: true, weight: 0.25 },
        { id: 'progressive_clarity', description: '渐进式明确需求', required: true, weight: 0.25 },
        { id: 'complete_task', description: '完成完整任务', required: true, weight: 0.25 }
      ],
      constraints: [
        { type: 'max_turns', value: 30, description: '最多30轮对话' },
        { type: 'max_time', value: 180000, description: '总时间不超过3分钟' }
      ],
      evaluationCriteria: { accuracy: 0.25, relevance: 0.25, efficiency: 0.2, user_satisfaction: 0.3 }
    });

    // 冲突解决场景
    templates.set('conflict_resolution', {
      category: 'conflict_resolution',
      objectives: [
        { id: 'understand_conflict', description: '理解冲突本质', required: true, weight: 0.25 },
        { id: 'provide_solutions', description: '提供解决方案', required: true, weight: 0.3 },
        { id: 'maintain_calm', description: '保持冷静和专业', required: true, weight: 0.25 },
        { id: 'achieve_compromise', description: '帮助达成妥协', required: false, weight: 0.2 }
      ],
      constraints: [
        { type: 'max_turns', value: 15, description: '最多15轮对话' },
        { type: 'max_time', value: 120000, description: '总时间不超过2分钟' }
      ],
      evaluationCriteria: { accuracy: 0.2, relevance: 0.3, efficiency: 0.2, user_satisfaction: 0.3 }
    });

    // 情感支持场景
    templates.set('emotional_support', {
      category: 'emotional_support',
      objectives: [
        { id: 'empathize', description: '表达理解和共情', required: true, weight: 0.3 },
        { id: 'provide_comfort', description: '提供安慰和支持', required: true, weight: 0.25 },
        { id: 'avoid_judgment', description: '避免评判', required: true, weight: 0.25 },
        { id: 'offer_resources', description: '提供有用的资源', required: false, weight: 0.2 }
      ],
      constraints: [
        { type: 'max_turns', value: 12, description: '最多12轮对话' },
        { type: 'max_time', value: 90000, description: '总时间不超过1.5分钟' }
      ],
      evaluationCriteria: { accuracy: 0.15, relevance: 0.25, efficiency: 0.2, user_satisfaction: 0.4 }
    });

    // 学习辅助场景
    templates.set('learning_assistance', {
      category: 'learning_assistance',
      objectives: [
        { id: 'assess_level', description: '评估学习者水平', required: true, weight: 0.2 },
        { id: 'explain_concepts', description: '清晰解释概念', required: true, weight: 0.3 },
        { id: 'provide_examples', description: '提供具体例子', required: true, weight: 0.25 },
        { id: 'guide_practice', description: '引导练习', required: false, weight: 0.25 }
      ],
      constraints: [
        { type: 'max_turns', value: 20, description: '最多20轮对话' },
        { type: 'max_time', value: 150000, description: '总时间不超过2.5分钟' }
      ],
      evaluationCriteria: { accuracy: 0.3, relevance: 0.25, efficiency: 0.2, user_satisfaction: 0.25 }
    });

    // 任务规划场景
    templates.set('task_planning', {
      category: 'task_planning',
      objectives: [
        { id: 'understand_goal', description: '理解目标需求', required: true, weight: 0.25 },
        { id: 'create_plan', description: '制定详细计划', required: true, weight: 0.3 },
        { id: 'identify_dependencies', description: '识别依赖关系', required: true, weight: 0.25 },
        { id: 'set_milestones', description: '设置里程碑', required: false, weight: 0.2 }
      ],
      constraints: [
        { type: 'max_turns', value: 18, description: '最多18轮对话' },
        { type: 'max_time', value: 120000, description: '总时间不超过2分钟' }
      ],
      evaluationCriteria: { accuracy: 0.3, relevance: 0.25, efficiency: 0.25, user_satisfaction: 0.2 }
    });

    return templates;
  }

  private initializeUserProfiles(): SimulatedUser[] {
    return [
      {
        id: 'user-beginner-zh',
        profile: {
          expertise: 'beginner',
          language: 'zh',
          personality: 'friendly'
        },
        behavior: {
          patienceLevel: 0.9,
          expectedResponseTime: 5000,
          toleranceForErrors: 0.8,
          communicationStyle: 'casual'
        }
      },
      {
        id: 'user-expert-en',
        profile: {
          expertise: 'expert',
          language: 'en',
          personality: 'neutral'
        },
        behavior: {
          patienceLevel: 0.7,
          expectedResponseTime: 2000,
          toleranceForErrors: 0.5,
          communicationStyle: 'formal'
        }
      },
      {
        id: 'user-intermediate-mixed',
        profile: {
          expertise: 'intermediate',
          language: 'mixed',
          personality: 'neutral'
        },
        behavior: {
          patienceLevel: 0.75,
          expectedResponseTime: 3000,
          toleranceForErrors: 0.6,
          communicationStyle: 'mixed'
        }
      },
      {
        id: 'user-aggressive-en',
        profile: {
          expertise: 'intermediate',
          language: 'en',
          personality: 'aggressive'
        },
        behavior: {
          patienceLevel: 0.4,
          expectedResponseTime: 2000,
          toleranceForErrors: 0.3,
          communicationStyle: 'formal'
        }
      },
      {
        id: 'user-casual-zh',
        profile: {
          expertise: 'beginner',
          language: 'zh',
          personality: 'friendly'
        },
        behavior: {
          patienceLevel: 0.85,
          expectedResponseTime: 4000,
          toleranceForErrors: 0.9,
          communicationStyle: 'casual'
        }
      }
    ];
  }

  /**
   * 生成随机场景
   */
  generateRandomScenario(category?: ScenarioCategory): Scenario {
    const targetCategory = category || this.getRandomCategory();
    const template = this.templates.get(targetCategory)!;

    return this.createScenarioFromTemplate(template, this.generateScenarioId());
  }

  /**
   * 生成指定类别的场景
   */
  generateScenariosForCategory(category: ScenarioCategory, count: number): Scenario[] {
    const scenarios: Scenario[] = [];
    const template = this.templates.get(category)!;

    for (let i = 0; i < count; i++) {
      const scenario = this.createScenarioFromTemplate(template, this.generateScenarioId());
      scenarios.push(scenario);
    }

    return scenarios;
  }

  /**
   * 生成难度递增的场景集合
   */
  generateProgressiveScenarios(category: ScenarioCategory, count: number): Scenario[] {
    const scenarios: Scenario[] = [];
    const template = this.templates.get(category)!;

    for (let i = 0; i < count; i++) {
      const difficulty = Math.min(5, Math.ceil(((i + 1) / count) * 5));
      const scenario = this.createScenarioFromTemplate(template, this.generateScenarioId(), difficulty);
      scenarios.push(scenario);
    }

    return scenarios;
  }

  /**
   * 从模板创建场景
   */
  private createScenarioFromTemplate(
    template: ScenarioTemplate,
    id: string,
    difficulty?: number
  ): Scenario {
    const scenarioDifficulty = difficulty || this.randomInt(1, 5);
    const name = this.generateScenarioName(template.category);
    const description = this.generateScenarioDescription(template.category, scenarioDifficulty);

    return {
      id,
      name,
      description,
      category: template.category,
      difficulty: scenarioDifficulty,
      objectives: [...template.objectives],
      constraints: [...template.constraints],
      evaluationCriteria: { ...template.evaluationCriteria },
      metadata: {
        author: 'ScenarioGenerator',
        createdAt: new Date(),
        tags: [template.category, `difficulty-${scenarioDifficulty}`],
        estimatedDuration: this.estimateDuration(template.category, scenarioDifficulty),
        successRate: undefined,
        avgScore: undefined
      }
    };
  }

  /**
   * 生成场景ID
   */
  private generateScenarioId(): string {
    return `scenario-${Date.now()}-${this.randomString(6)}`;
  }

  /**
   * 生成场景名称
   */
  private generateScenarioName(category: ScenarioCategory): string {
    const names: Record<ScenarioCategory, string[]> = {
      conversation: ['友好对话', '日常交流', '信息咨询', '闲聊互动'],
      question_answering: ['知识问答', '问题解答', '信息查询', '概念解释'],
      tool_usage: ['代码执行', '数据分析', '文档处理', '网络搜索'],
      problem_solving: ['问题诊断', '方案设计', '故障排除', '优化建议'],
      creativity: ['创意写作', '头脑风暴', '方案构思', '灵感激发'],
      technical: ['技术实现', '代码调试', '系统设计', '架构规划'],
      multi_turn: ['复杂对话', '多轮交互', '任务协作', '深度讨论'],
      conflict_resolution: ['冲突调解', '问题协调', '分歧处理', '矛盾化解'],
      emotional_support: ['情感陪伴', '心理支持', '情绪疏导', '心灵关怀'],
      learning_assistance: ['学习辅导', '知识讲解', '技能培训', '答疑解惑'],
      task_planning: ['项目规划', '任务安排', '日程管理', '时间规划']
    };

    const categoryNames = names[category];
    return categoryNames[Math.floor(Math.random() * categoryNames.length)];
  }

  /**
   * 生成场景描述
   */
  private generateScenarioDescription(category: ScenarioCategory, difficulty: number): string {
    const difficultyText = difficulty <= 2 ? '简单' : difficulty <= 3 ? '中等' : '困难';

    const descriptions: Record<ScenarioCategory, string> = {
      conversation: `模拟${difficultyText}程度的对话交互，测试agent的对话能力和响应质量。`,
      question_answering: `模拟${difficultyText}的知识问答场景，评估agent的回答准确性和相关性。`,
      tool_usage: `模拟${difficultyText}的工具使用场景，测试agent调用工具的能力。`,
      problem_solving: `模拟${difficultyText}的问题解决场景，评估agent的逻辑推理能力。`,
      creativity: `模拟${difficultyText}的创意任务，测试agent的创造力和想象力。`,
      technical: `模拟${difficultyText}的技术任务，评估agent的技术实现能力。`,
      multi_turn: `模拟${difficultyText}的多轮对话，测试agent的上下文追踪和记忆能力。`,
      conflict_resolution: `模拟${difficultyText}的冲突解决场景，测试agent的调解和协调能力。`,
      emotional_support: `模拟${difficultyText}的情感支持场景，评估agent的共情和安慰能力。`,
      learning_assistance: `模拟${difficultyText}的学习辅助场景，测试agent的教学和辅导能力。`,
      task_planning: `模拟${difficultyText}的任务规划场景，评估agent的组织和规划能力。`
    };

    return descriptions[category];
  }

  /**
   * 估算场景持续时间
   */
  private estimateDuration(category: ScenarioCategory, difficulty: number): number {
    const baseTime: Record<ScenarioCategory, number> = {
      conversation: 30,
      question_answering: 20,
      tool_usage: 45,
      problem_solving: 60,
      creativity: 25,
      technical: 40,
      multi_turn: 90,
      conflict_resolution: 75,
      emotional_support: 45,
      learning_assistance: 55,
      task_planning: 50
    };

    return baseTime[category] * (1 + difficulty * 0.2);
  }

  /**
   * 获取随机用户档案
   */
  getRandomUserProfile(): SimulatedUser {
    return this.userProfiles[Math.floor(Math.random() * this.userProfiles.length)];
  }

  /**
   * 获取所有用户档案
   */
  getAllUserProfiles(): SimulatedUser[] {
    return [...this.userProfiles];
  }

  /**
   * 获取所有场景类别
   */
  getAllCategories(): ScenarioCategory[] {
    return Array.from(this.templates.keys());
  }

  /**
   * 获取随机类别
   */
  private getRandomCategory(): ScenarioCategory {
    const categories = Array.from(this.templates.keys());
    return categories[Math.floor(Math.random() * categories.length)];
  }

  /**
   * 生成随机整数
   */
  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 生成随机字符串
   */
  private randomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成完整的训练数据集
   */
  generateTrainingDataset(config: {
    scenariosPerCategory: number;
    difficultyLevels: number[];
    userProfiles: boolean;
  }): { scenarios: Scenario[]; users: SimulatedUser[] } {
    const scenarios: Scenario[] = [];
    const categories = this.getAllCategories();

    for (const category of categories) {
      for (const difficulty of config.difficultyLevels) {
        for (let i = 0; i < config.scenariosPerCategory; i++) {
          const scenario = this.generateRandomScenario(category);
          scenario.difficulty = difficulty;
          scenarios.push(scenario);
        }
      }
    }

    return {
      scenarios,
      users: config.userProfiles ? this.getAllUserProfiles() : [this.getRandomUserProfile()]
    };
  }
}

interface ScenarioTemplate {
  category: ScenarioCategory;
  objectives: ScenarioObjective[];
  constraints: ScenarioConstraint[];
  evaluationCriteria: EvaluationCriteria;
}
