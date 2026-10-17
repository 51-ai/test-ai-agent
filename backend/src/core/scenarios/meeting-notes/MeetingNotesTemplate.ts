/**
 * 会议纪要智能体 - 场景模板
 * 
 * 功能：
 * - 录音转写 / 文字输入
 * - 自动提炼会议要点
 * - 拆解待办事项
 * - 分配责任人
 * - 跟进进度追踪
 * - 输出结构化会议台账
 * 
 * @module scenarios/meeting-notes
 */

/**
 * 任务阶段定义
 */
export interface TaskPhase {
  id: string;
  name: string;
  description: string;
  estimatedTime: number;
  requiredTools: string[];
  optionalTools?: string[];
  validationRules?: any[];
  prompt?: string;
  fewShotExamples?: any[];
  outputFormat?: string;
  template?: string;
  autoExecute?: boolean;
}

/**
 * 任务模板配置
 */
export interface TaskTemplateConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  priority: string;
  estimatedDuration: number;
  inputParameters: any;
  outputParameters: any;
  phases: TaskPhase[];
  tools: any;
  llmConfig?: any;
  validation?: any;
  qualityControl?: any;
}

/**
 * 会议纪要智能体场景模板
 */
export const MeetingNotesTemplate: TaskTemplateConfig = {
  id: 'meeting-notes-agent',
  name: '会议纪要智能体',
  description: '自动处理会议内容，生成结构化纪要，拆解待办事项并跟踪进度',
  category: 'office-automation',
  priority: 'high',
  estimatedDuration: 30000,
  
  /**
   * 输入参数定义
   */
  inputParameters: {
    meetingContent: {
      type: 'string',
      description: '会议内容，可以是录音转写文本、聊天记录或直接输入',
      required: true,
      examples: [
        '产品评审会议，大家讨论了Q2功能优先级，决定优先上线A/B Test功能...',
        '附件：会议录音.mp3\n会议参与人：张三、李四、王五\n时间：2024-01-15 14:00-16:00'
      ]
    },
    meetingType: {
      type: 'enum',
      description: '会议类型',
      options: ['评审会', '周例会', '头脑风暴', '一对一沟通', '项目启动会', '问题复盘会'],
      default: '周例会'
    },
    participants: {
      type: 'array',
      description: '会议参与人员列表',
      items: { type: 'string' },
      default: []
    },
    meetingDate: {
      type: 'string',
      description: '会议日期',
      format: 'date',
      default: 'today'
    },
    meetingTitle: {
      type: 'string',
      description: '会议主题/标题',
      required: false
    },
    autoExtractTasks: {
      type: 'boolean',
      description: '是否自动拆解待办事项',
      default: true
    },
    assignResponsibility: {
      type: 'boolean',
      description: '是否自动分配责任人',
      default: true
    }
  },

  /**
   * 输出参数定义
   */
  outputParameters: {
    meetingSummary: {
      type: 'object',
      description: '会议摘要结构'
    },
    actionItems: {
      type: 'array',
      description: '待办事项列表'
    },
    decisions: {
      type: 'array',
      description: '会议决策列表'
    },
    meetingMinutes: {
      type: 'string',
      description: '完整会议纪要（Markdown格式）'
    },
    followUpTasks: {
      type: 'array',
      description: '需要跟进的长期任务'
    }
  },

  /**
   * 任务阶段定义
   */
  phases: [
    {
      id: 'input-processing',
      name: '内容预处理',
      description: '对输入内容进行清洗和结构化处理',
      estimatedTime: 5000,
      requiredTools: ['text-cleaner'],
      optionalTools: ['audio-transcriber', 'document-parser'],
      validationRules: [
        {
          field: 'meetingContent',
          rule: 'minLength',
          value: 10,
          message: '会议内容过短，无法生成有效纪要'
        }
      ]
    },
    {
      id: 'content-extraction',
      name: '关键信息提取',
      description: '从会议内容中提取关键信息：讨论点、决策、问题',
      estimatedTime: 8000,
      requiredTools: ['llm-analyzer'],
      prompt: `
你是一位专业的会议纪要助手。请从以下会议内容中提取关键信息：

## 提取要求：

### 1. 会议概览
- 会议主题
- 会议类型
- 参与人员
- 会议时长

### 2. 讨论要点（3-5条）
列出会议中讨论的主要话题，每个话题包含：
- 话题标题
- 讨论内容摘要
- 相关人员意见（如有）

### 3. 会议决策（列出所有明确的决策）
每个决策包含：
- 决策内容
- 决策依据
- 责任人（如果明确）

### 4. 待办事项（使用[待办]标记）
从会议中提取的所有待办事项，格式：
- [待办] 具体任务内容 @责任人 (截止日期)

### 5. 遗留问题
如有悬而未决的问题，列出并标注需要跟进

### 6. 下次会议安排（如有提及）

请以结构化JSON格式输出。
`,
      fewShotExamples: [
        {
          input: '今天评审了Q2产品路线图，张三建议优先做A功能，李四认为B功能更紧急。最终决定先做A功能，预计3周完成，由张三负责产品设计，王五负责开发。下次会议定在周五。',
          output: {
            decisions: [
              { content: 'Q2优先开发A功能', basis: '评审讨论结果', owner: '张三' }
            ],
            actionItems: [
              { task: '完成A功能产品设计', owner: '张三', deadline: '3周内' },
              { task: 'A功能技术开发', owner: '王五', deadline: '3周内' }
            ],
            nextMeeting: '周五'
          }
        }
      ]
    },
    {
      id: 'task-decomposition',
      name: '待办事项分解',
      description: '对提取的待办事项进行细化和优先级排序',
      estimatedTime: 6000,
      requiredTools: ['llm-analyzer'],
      prompt: `
请将以下待办事项进行细化分解：

## 分解要求：

### 1. 任务细化
将模糊的任务拆解为可执行的具体步骤

### 2. 优先级判定
- P0: 阻塞性问题，必须立即处理
- P1: 本周内必须完成
- P2: 本月内完成即可
- P3: 可延后处理

### 3. 依赖关系
标注任务之间的依赖关系

### 4. 预估工时
每个任务给出预估工时（小时）

### 5. 风险提示
识别可能的风险点

请输出结构化的任务分解结果。
`
    },
    {
      id: 'formatting-output',
      name: '格式化输出',
      description: '生成标准格式的会议纪要',
      estimatedTime: 5000,
      requiredTools: ['formatter'],
      outputFormat: 'markdown',
      template: `
# 【{{meetingType}}】{{meetingTitle}}

## 📋 会议基本信息
- **会议时间**：{{meetingDate}}
- **会议类型**：{{meetingType}}
- **参与人员**：{{participants}}
- **记录人**：AI助手

---

## 📝 会议摘要

{{meetingSummary}}

---

## 🎯 会议决策

{{decisions}}

---

## ✅ 待办事项

{{actionItems}}

---

## ❓ 遗留问题

{{unresolvedIssues}}

---

## 📅 下次会议

{{nextMeeting}}

---

*本纪要由AI智能体自动生成，如有问题请联系会议主持人确认*
`
    },
    {
      id: 'task-tracking-setup',
      name: '任务跟踪初始化',
      description: '为待办事项创建跟踪记录',
      estimatedTime: 3000,
      requiredTools: ['task-tracker'],
      autoExecute: false // 视配置决定是否自动创建
    }
  ],

  /**
   * 工具配置
   */
  tools: {
    required: ['llm-analyzer', 'formatter'],
    optional: ['document-parser', 'audio-transcriber', 'task-tracker'],
    fallback: {
      'llm-analyzer': '使用内置分析逻辑',
      'document-parser': '提示用户手动复制文本',
      'audio-transcriber': '提示用户先进行语音转文字'
    }
  },

  /**
   * LLM配置
   */
  llmConfig: {
    model: 'gpt-4o',
    temperature: 0.3,
    maxTokens: 4096,
    systemPrompt: `你是一位专业的会议纪要助手，擅长从会议内容中提取关键信息，生成结构清晰、格式规范的会议纪要。你的输出具有以下特点：
1. 内容完整：不错过任何重要信息
2. 结构清晰：使用统一的格式组织内容
3. 要点突出：关键决策和待办事项一目了然
4. 可执行性强：待办事项明确到具体人和时间`
  },

  /**
   * 验证规则
   */
  validation: {
    minContentLength: 50,
    requiredFields: ['meetingContent', 'meetingType'],
    outputValidation: {
      meetingSummary: { minLength: 50 },
      actionItems: { minItems: 0 }, // 允许无待办
      decisions: { minItems: 0 }   // 允许无决策
    }
  },

  /**
   * 质量控制
   */
  qualityControl: {
    enableReview: false, // 是否需要人工审核
    autoCorrect: true,   // 是否自动修正
    confidenceThreshold: 0.8
  }
};

/**
 * 快速会议纪要模板（简化版）
 */
export const QuickMeetingNotesTemplate: TaskTemplateConfig = {
  ...MeetingNotesTemplate,
  id: 'quick-meeting-notes',
  name: '快速会议纪要',
  description: '快速生成简洁版会议纪要，适合短会议',
  phases: MeetingNotesTemplate.phases.slice(0, 4), // 去掉任务跟踪
  estimatedDuration: 15000
};

/**
 * 评审会议纪要模板（专业版）
 */
export const ReviewMeetingNotesTemplate: TaskTemplateConfig = {
  ...MeetingNotesTemplate,
  id: 'review-meeting-notes',
  name: '评审会议纪要',
  description: '专门针对产品/技术评审会议的格式化纪要',
  inputParameters: {
    ...MeetingNotesTemplate.inputParameters,
    meetingType: {
      type: 'enum',
      description: '会议类型',
      options: ['产品评审', '技术评审', '设计评审', '方案评审'],
      default: '产品评审'
    },
    reviewCriteria: {
      type: 'array',
      description: '评审维度',
      items: { type: 'string' },
      default: ['可行性', '价值', '优先级']
    }
  },
  phases: [
    ...MeetingNotesTemplate.phases.slice(0, 3),
    {
      id: 'review-formatting',
      name: '评审纪要格式化',
      description: '生成评审专用的结构化纪要',
      estimatedTime: 5000,
      requiredTools: ['formatter'],
      outputFormat: 'markdown',
      template: `
# {{meetingType}}会议纪要

## 基本信息
- 项目/产品：{{projectName}}
- 评审日期：{{meetingDate}}
- 评审结论：{{reviewConclusion}}

## 评审内容
{{reviewContent}}

## 评审意见
{{reviewComments}}

## 修改要求
{{modificationRequirements}}

## 下一步行动
{{nextActions}}
`
    },
    MeetingNotesTemplate.phases[4]
  ]
};

export default MeetingNotesTemplate;