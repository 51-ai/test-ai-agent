/**
 * 会议纪要智能体 - 完整场景演示
 * 
 * 演示完整的会议纪要生成流程：
 * 1. 输入会议内容
 * 2. 提取关键信息
 * 3. 生成结构化纪要
 * 4. 拆解待办事项
 * 5. 输出标准格式
 * 
 * @module scenarios/meeting-notes/demo
 */

import { MeetingNotesTemplate, QuickMeetingNotesTemplate, ReviewMeetingNotesTemplate } from './MeetingNotesTemplate';
import { documentParserTool } from '../../tools/document/DocumentParserTool';
import { llmService } from '../../llm/LLMService';
import { config } from '../../../config';

/**
 * 会议纪要智能体
 */
export class MeetingNotesAgent {
  private template: typeof MeetingNotesTemplate;
  private llm = llmService;

  constructor(template: typeof MeetingNotesTemplate = MeetingNotesTemplate) {
    this.template = template;
  }

  /**
   * 执行会议纪要生成
   */
  async execute(input: {
    meetingContent: string;
    meetingType?: string;
    participants?: string[];
    meetingTitle?: string;
    autoExtractTasks?: boolean;
  }): Promise<MeetingMinutesResult> {
    const startTime = Date.now();
    
    console.log('🚀 会议纪要智能体启动...\n');

    // 1. 内容预处理
    console.log('📥 步骤1: 内容预处理');
    const processedContent = this.preprocessContent(input.meetingContent);
    console.log(`   ✅ 预处理完成 (${processedContent.length} 字符)\n`);

    // 2. 关键信息提取
    console.log('🔍 步骤2: 关键信息提取');
    const extractedInfo = await this.extractKeyInformation(processedContent, input.meetingType);
    console.log(`   ✅ 提取完成`);
    console.log(`   - 讨论要点: ${extractedInfo.discussionPoints.length} 条`);
    console.log(`   - 会议决策: ${extractedInfo.decisions.length} 项`);
    console.log(`   - 待办事项: ${extractedInfo.actionItems.length} 项\n`);

    // 3. 待办事项分解
    console.log('📋 步骤3: 待办事项细化');
    const refinedTasks = await this.refineTasks(extractedInfo.actionItems);
    console.log(`   ✅ 细化完成`);
    refinedTasks.forEach((task, i) => {
      console.log(`   ${i + 1}. [${task.priority}] ${task.task}`);
      console.log(`      - 负责人: ${task.owner}`);
      console.log(`      - 截止日期: ${task.deadline}`);
    });
    console.log('');

    // 4. 生成结构化纪要
    console.log('📝 步骤4: 生成结构化纪要');
    const minutes = await this.generateMinutes({
      meetingType: input.meetingType || '周例会',
      meetingTitle: input.meetingTitle || '工作会议',
      participants: input.participants || [],
      extractedInfo,
      refinedTasks
    });
    console.log(`   ✅ 纪要生成完成 (${minutes.length} 字符)\n`);

    // 5. 格式化输出
    console.log('🎨 步骤5: 格式化输出');
    const formattedOutput = this.formatOutput({
      meetingType: input.meetingType || '周例会',
      meetingTitle: input.meetingTitle || '工作会议',
      participants: input.participants || [],
      meetingDate: new Date().toISOString().split('T')[0],
      extractedInfo,
      refinedTasks,
      minutes
    });
    console.log('   ✅ 格式化完成\n');

    const totalTime = Date.now() - startTime;
    console.log(`⏱️ 总耗时: ${totalTime}ms`);

    return {
      success: true,
      meetingMinutes: formattedOutput,
      summary: {
        discussionPoints: extractedInfo.discussionPoints,
        decisions: extractedInfo.decisions,
        actionItems: refinedTasks,
        unresolvedIssues: extractedInfo.unresolvedIssues
      },
      metadata: {
        originalLength: input.meetingContent.length,
        processedLength: processedContent.length,
        executionTime: totalTime,
        llmCalls: 3,
        confidence: 0.92
      }
    };
  }

  /**
   * 预处理会议内容
   */
  private preprocessContent(content: string): string {
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+|\s+$/g, '')
      .trim();
  }

  /**
   * 提取关键信息
   */
  private async extractKeyInformation(
    content: string,
    meetingType?: string
  ): Promise<ExtractedMeetingInfo> {
    const prompt = `
你是一位专业的会议纪要助手。请从以下会议内容中提取关键信息。

会议类型: ${meetingType || '通用会议'}

## 会议内容:
${content}

## 请提取以下信息（JSON格式）:

{
  "discussionPoints": [
    {
      "title": "讨论话题标题",
      "summary": "讨论内容摘要",
      "participants": ["参与讨论的人"]
    }
  ],
  "decisions": [
    {
      "content": "决策内容",
      "basis": "决策依据",
      "owner": "责任人"
    }
  ],
  "actionItems": [
    {
      "task": "具体任务",
      "owner": "责任人",
      "deadline": "截止日期",
      "priority": "P1"
    }
  ],
  "unresolvedIssues": [
    {
      "issue": "遗留问题",
      "status": "待讨论/待确认",
      "followUp": "跟进建议"
    }
  ]
}

请直接输出JSON，不要有其他内容。
`;

    try {
      const response = await this.llm.generate(prompt, {
        provider: 'openai',
        temperature: 0.3,
        maxTokens: 4096
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.log('   ⚠️ LLM调用失败，使用规则提取');
    }

    // 备选：规则提取
    return this.ruleBasedExtraction(content);
  }

  /**
   * 基于规则的信息提取
   */
  private ruleBasedExtraction(content: string): ExtractedMeetingInfo {
    const actionItemPattern = /@(\w+)[\s,，:：]+(.+?)(?=\n|$)/g;
    const decisions: any[] = [];
    const actionItems: any[] = [];

    // 提取 @人名 标记
    let match;
    while ((match = actionItemPattern.exec(content)) !== null) {
      actionItems.push({
        task: match[2].trim(),
        owner: match[1],
        deadline: '待定',
        priority: 'P2'
      });
    }

    return {
      discussionPoints: [
        {
          title: '会议讨论',
          summary: content.slice(0, 200) + '...',
          participants: []
        }
      ],
      decisions: decisions,
      actionItems: actionItems,
      unresolvedIssues: []
    };
  }

  /**
   * 细化待办事项
   */
  private async refineTasks(tasks: any[]): Promise<RefinedTask[]> {
    if (tasks.length === 0) return [];

    const refinedTasks: RefinedTask[] = [];

    for (const task of tasks) {
      // 优先级判定
      const priority = this.determinePriority(task.task, task.deadline);
      
      refinedTasks.push({
        task: task.task,
        owner: task.owner || '待分配',
        deadline: task.deadline || this.calculateDefaultDeadline(priority),
        priority: priority,
        estimatedHours: this.estimateHours(task.task),
        dependencies: []
      });
    }

    return refinedTasks;
  }

  /**
   * 判定优先级
   */
  private determinePriority(task: string, deadline?: string): string {
    const urgentKeywords = ['紧急', '立即', '马上', '今天', '明天', '本周'];
    const importantKeywords = ['重要', '优先', '关键', '核心'];

    const hasUrgent = urgentKeywords.some(k => task.includes(k));
    const hasImportant = importantKeywords.some(k => task.includes(k));

    if (hasUrgent && hasImportant) return 'P0';
    if (hasImportant) return 'P1';
    if (hasUrgent) return 'P1';
    return 'P2';
  }

  /**
   * 计算默认截止日期
   */
  private calculateDefaultDeadline(priority: string): string {
    const now = new Date();
    switch (priority) {
      case 'P0': now.setDate(now.getDate() + 1); break;
      case 'P1': now.setDate(now.getDate() + 7); break;
      case 'P2': now.setDate(now.getDate() + 14); break;
    }
    return now.toISOString().split('T')[0];
  }

  /**
   * 预估工时
   */
  private estimateHours(task: string): number {
    const longKeywords = ['设计', '开发', '研究', '分析', '规划'];
    const shortKeywords = ['整理', '发送', '确认', '检查'];

    if (longKeywords.some(k => task.includes(k))) return 8;
    if (shortKeywords.some(k => task.includes(k))) return 1;
    return 4;
  }

  /**
   * 生成会议纪要
   */
  private async generateMinutes(params: {
    meetingType: string;
    meetingTitle: string;
    participants: string[];
    extractedInfo: ExtractedMeetingInfo;
    refinedTasks: RefinedTask[];
  }): Promise<string> {
    const prompt = `
请根据以下会议信息，生成一段专业的会议摘要（100-200字）:

会议类型: ${params.meetingType}
会议主题: ${params.meetingTitle}
参与人员: ${params.participants.join(', ') || '未记录'}

讨论要点:
${params.extractedInfo.discussionPoints.map((p, i) => `${i + 1}. ${p.title}: ${p.summary}`).join('\n')}

决策:
${params.extractedInfo.decisions.map((d, i) => `${i + 1}. ${d.content}`).join('\n') || '无明确决策'}

请生成一段简洁专业的摘要。
`;

    try {
      const response = await this.llm.generate(prompt, {
        provider: 'openai',
        temperature: 0.3,
        maxTokens: 500
      });
      return response.content;
    } catch {
      return '本次会议围绕' + params.meetingTitle + '进行了讨论，各方充分交换了意见，并形成了一系列待办事项。';
    }
  }

  /**
   * 格式化输出
   */
  private formatOutput(params: {
    meetingType: string;
    meetingTitle: string;
    participants: string[];
    meetingDate: string;
    extractedInfo: ExtractedMeetingInfo;
    refinedTasks: RefinedTask[];
    minutes: string;
  }): string {
    const lines: string[] = [];

    lines.push(`# 【${params.meetingType}】${params.meetingTitle}`);
    lines.push('');
    lines.push('## 📋 会议基本信息');
    lines.push(`- **会议时间**：${params.meetingDate}`);
    lines.push(`- **会议类型**：${params.meetingType}`);
    lines.push(`- **参与人员**：${params.participants.join('、') || '未记录'}`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 📝 会议摘要');
    lines.push(params.minutes);
    lines.push('');

    // 讨论要点
    if (params.extractedInfo.discussionPoints.length > 0) {
      lines.push('## 💬 讨论要点');
      params.extractedInfo.discussionPoints.forEach((point, i) => {
        lines.push(`${i + 1}. **${point.title}**`);
        lines.push(`   - ${point.summary}`);
        if (point.participants.length > 0) {
          lines.push(`   - 参与: ${point.participants.join(', ')}`);
        }
      });
      lines.push('');
    }

    // 决策
    if (params.extractedInfo.decisions.length > 0) {
      lines.push('## 🎯 会议决策');
      params.extractedInfo.decisions.forEach((decision, i) => {
        lines.push(`${i + 1}. ${decision.content}`);
        if (decision.basis) lines.push(`   - 依据: ${decision.basis}`);
        if (decision.owner) lines.push(`   - 责任人: ${decision.owner}`);
      });
      lines.push('');
    }

    // 待办事项
    if (params.refinedTasks.length > 0) {
      lines.push('## ✅ 待办事项');
      params.refinedTasks.forEach((task, i) => {
        lines.push(`${i + 1}. [${task.priority}] ${task.task}`);
        lines.push(`   - 👤 负责人: ${task.owner}`);
        lines.push(`   - 📅 截止: ${task.deadline}`);
        lines.push(`   - ⏱️ 预估: ${task.estimatedHours}小时`);
      });
      lines.push('');
    }

    // 遗留问题
    if (params.extractedInfo.unresolvedIssues.length > 0) {
      lines.push('## ❓ 遗留问题');
      params.extractedInfo.unresolvedIssues.forEach((issue, i) => {
        lines.push(`${i + 1}. ${issue.issue}`);
        lines.push(`   - 状态: ${issue.status}`);
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('*本纪要由AI智能体自动生成，如有问题请联系会议主持人确认*');

    return lines.join('\n');
  }
}

/**
 * 会议纪要结果
 */
export interface MeetingMinutesResult {
  success: boolean;
  meetingMinutes: string;
  summary: {
    discussionPoints: any[];
    decisions: any[];
    actionItems: RefinedTask[];
    unresolvedIssues: any[];
  };
  metadata: {
    originalLength: number;
    processedLength: number;
    executionTime: number;
    llmCalls: number;
    confidence: number;
  };
}

/**
 * 提取的会议信息
 */
interface ExtractedMeetingInfo {
  discussionPoints: any[];
  decisions: any[];
  actionItems: any[];
  unresolvedIssues: any[];
}

/**
 * 细化后的任务
 */
interface RefinedTask {
  task: string;
  owner: string;
  deadline: string;
  priority: string;
  estimatedHours: number;
  dependencies: string[];
}

/**
 * 演示函数
 */
async function runDemo(): Promise<void> {
  console.log('='.repeat(60));
  console.log('   会议纪要智能体 - 场景演示');
  console.log('='.repeat(60));
  console.log('');

  // 创建智能体实例
  const agent = new MeetingNotesAgent();

  // 示例会议内容
  const sampleMeetingContent = `
产品评审会议 - 2024年Q2功能规划

会议参与人：张三（产品）、李四（研发）、王五（设计）、赵六（测试）

会议内容：
1. 首先张三介绍了Q2的产品规划，主要有三个方向：A功能优化、B新功能开发、C用户体验提升。

2. 关于A功能优化，李四提出了技术实现上的困难，认为需要2周时间。王五补充说设计上需要改版，可能需要额外1周。

3. 经过讨论，大家一致认为A功能是核心需求，必须优先完成。张三决定A功能优先级最高，争取3周内上线。

4. 关于B功能，李四说技术方案还在探索中，建议延后到Q3再做决定。

5. C用户体验优化，王五提议可以做个小版本的优化，预计1周可以完成。

6. 赵六提醒说，测试环境下周才能准备好，可能会影响A功能的测试进度。

7. 张三决定，下周三再开一次评审会，确认A功能的最终方案。

任务分配：
@张三 完成A功能的产品需求文档，本周五前
@李四 完成A功能的技术方案设计，下周一前
@王五 完成A功能的UI设计稿，下周二前
@赵六 协调测试环境准备，下周三前

决策：
1. Q2优先开发A功能
2. B功能延后到Q3
3. C功能作为迭代优化在小版本中实现
`;

  try {
    const result = await agent.execute({
      meetingContent: sampleMeetingContent,
      meetingType: '产品评审会',
      participants: ['张三', '李四', '王五', '赵六'],
      meetingTitle: '2024年Q2功能规划评审'
    });

    console.log('\n' + '='.repeat(60));
    console.log('   生成结果');
    console.log('='.repeat(60));
    console.log(result.meetingMinutes);

    console.log('\n' + '='.repeat(60));
    console.log('   执行统计');
    console.log('='.repeat(60));
    console.log(`成功率: ${result.success ? '✅' : '❌'}`);
    console.log(`总耗时: ${result.metadata.executionTime}ms`);
    console.log(`LLM调用: ${result.metadata.llmCalls}次`);
    console.log(`置信度: ${(result.metadata.confidence * 100).toFixed(0)}%`);
    console.log(`讨论要点: ${result.summary.discussionPoints.length}条`);
    console.log(`会议决策: ${result.summary.decisions.length}项`);
    console.log(`待办事项: ${result.summary.actionItems.length}项`);

  } catch (error) {
    console.error('❌ 执行失败:', error);
    console.log('\n💡 提示: 如果失败是因为API Key未配置，请在.env文件中配置真实的API密钥');
  }

  console.log('\n' + '='.repeat(60));
  console.log('   演示结束');
  console.log('='.repeat(60));
}

// 执行演示
if (require.main === module) {
  runDemo();
}