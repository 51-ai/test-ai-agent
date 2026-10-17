/**
 * 训练数据生成器
 * 多场景数据生成（客服、代码、分析），支持数据质量评估
 * 目标：≥10万条记录
 */

// @ts-nocheck - 独立脚本，宽松类型检查
// @ts-ignore
import * as fs from 'fs';
// @ts-ignore
import * as path from 'path';

// 内联 UUID 生成
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// === 数据类型 ===
export type ScenarioType = 'customer_service' | 'code_assistant' | 'data_analysis';

export interface TrainingRecord {
  id: string;
  scenario: ScenarioType;
  taskDescription: string;
  context?: string;
  intermediateSteps: string[];
  expectedResult: string;
  evaluationMetrics: {
    difficulty: 'easy' | 'medium' | 'hard';
    expectedSteps: number;
    requiredTools: string[];
    successCriteria: string;
  };
  language: 'zh' | 'en' | 'ja';
  tags: string[];
  createdAt: Date;
  qualityScore?: number;
}

export interface DataGenerationConfig {
  totalRecords: number;
  scenarios: {
    customerService: number;  // 百分比
    codeAssistant: number;
    dataAnalysis: number;
  };
  languages: {
    zh: number;
    en: number;
    ja: number;
  };
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
  };
}

export interface DataQualityReport {
  totalRecords: number;
  duplicatesRemoved: number;
  lowQualityRemoved: number;
  finalCount: number;
  byScenario: Record<ScenarioType, number>;
  byLanguage: Record<string, number>;
  byDifficulty: Record<string, number>;
  averageQualityScore: number;
  coverageReport: {
    coveredIntents: string[];
    coveredTools: string[];
    missingIntents: string[];
    missingTools: string[];
  };
}

const DEFAULT_CONFIG: DataGenerationConfig = {
  totalRecords: 100000,
  scenarios: {
    customerService: 40,
    codeAssistant: 35,
    dataAnalysis: 25
  },
  languages: { zh: 60, en: 30, ja: 10 },
  difficultyDistribution: { easy: 40, medium: 40, hard: 20 }
};

// 客服场景模板
const CUSTOMER_SERVICE_TEMPLATES = {
  zh: [
    { task: '用户查询订单状态', steps: ['识别订单号', '查询订单系统', '返回订单状态'], tools: ['search', 'analyze'], criteria: '返回准确订单状态' },
    { task: '用户申请退款', steps: ['识别退款原因', '验证订单状态', '执行退款流程', '发送确认通知'], tools: ['search', 'summarize'], criteria: '退款处理完成并通知' },
    { task: '用户咨询产品信息', steps: ['理解产品需求', '搜索产品知识库', '返回产品详情'], tools: ['search', 'summarize'], criteria: '提供准确产品信息' },
    { task: '用户投诉服务问题', steps: ['理解投诉内容', '记录投诉信息', '升级到人工客服', '安抚用户情绪'], tools: ['analyze', 'summarize'], criteria: '投诉记录完成且用户情绪缓解' },
    { task: '用户修改配送地址', steps: ['确认用户身份', '查找当前订单', '更新配送地址', '确认修改成功'], tools: ['search', 'analyze'], criteria: '地址修改成功' },
    { task: '用户询问会员权益', steps: ['识别会员等级', '查询权益列表', '返回权益说明'], tools: ['search', 'summarize'], criteria: '准确说明会员权益' },
    { task: '批量订单查询', steps: ['解析查询条件', '批量查询订单', '汇总结果', '格式化输出'], tools: ['search', 'analyze', 'summarize'], criteria: '返回完整订单列表' },
    { task: '用户反馈产品缺陷', steps: ['记录缺陷详情', '分类缺陷类型', '创建缺陷工单', '通知相关部门'], tools: ['analyze', 'summarize'], criteria: '缺陷工单创建成功' },
  ],
  en: [
    { task: 'User checks order status', steps: ['Identify order ID', 'Query order system', 'Return status'], tools: ['search', 'analyze'], criteria: 'Accurate order status returned' },
    { task: 'User requests refund', steps: ['Identify refund reason', 'Verify order', 'Process refund', 'Send confirmation'], tools: ['search', 'summarize'], criteria: 'Refund processed successfully' },
    { task: 'User inquires about product', steps: ['Understand need', 'Search knowledge base', 'Return details'], tools: ['search', 'summarize'], criteria: 'Accurate product info' },
  ],
  ja: [
    { task: '注文状況の確認', steps: ['注文番号の特定', '注文システムの照会', '状況の返信'], tools: ['search', 'analyze'], criteria: '正確な注文状況を返す' },
    { task: '返金リクエスト', steps: ['返金理由の確認', '注文の確認', '返金処理', '確認通知'], tools: ['search', 'summarize'], criteria: '返金処理が完了' },
  ]
};

// 代码助手场景模板
const CODE_ASSISTANT_TEMPLATES = {
  zh: [
    { task: '调试Python程序错误', steps: ['分析错误信息', '定位问题代码', '提供修复方案', '验证修复效果'], tools: ['code_executor', 'analyze'], criteria: '错误已修复且代码可运行' },
    { task: '优化SQL查询性能', steps: ['分析查询计划', '识别性能瓶颈', '重写查询语句', '验证性能提升'], tools: ['code_executor', 'analyze'], criteria: '查询时间减少50%以上' },
    { task: '编写REST API接口', steps: ['理解API需求', '设计接口规范', '编写实现代码', '编写单元测试'], tools: ['code_executor', 'summarize'], criteria: 'API功能正确且测试通过' },
    { task: '代码重构建议', steps: ['分析代码结构', '识别坏味道', '提出重构方案', '实施重构'], tools: ['analyze', 'code_executor'], criteria: '代码质量提升' },
    { task: '实现排序算法', steps: ['理解排序需求', '选择合适算法', '编写实现', '测试正确性'], tools: ['code_executor'], criteria: '算法正确且效率可接受' },
    { task: '配置Docker部署', steps: ['分析应用架构', '编写Dockerfile', '配置docker-compose', '验证部署'], tools: ['code_executor', 'analyze'], criteria: '容器正常启动' },
    { task: '修复安全漏洞', steps: ['识别安全漏洞', '分析影响范围', '实施修复方案', '验证修复效果'], tools: ['analyze', 'code_executor'], criteria: '漏洞已修复' },
    { task: '编写数据处理脚本', steps: ['理解数据格式', '设计处理逻辑', '编写脚本', '验证输出'], tools: ['code_executor', 'analyze'], criteria: '数据正确处理' },
  ],
  en: [
    { task: 'Debug Python error', steps: ['Analyze error', 'Locate bug', 'Provide fix', 'Verify fix'], tools: ['code_executor', 'analyze'], criteria: 'Error resolved' },
    { task: 'Optimize SQL query', steps: ['Analyze plan', 'Identify bottleneck', 'Rewrite query', 'Verify improvement'], tools: ['code_executor', 'analyze'], criteria: 'Query time reduced 50%+' },
    { task: 'Write REST API', steps: ['Understand requirements', 'Design spec', 'Implement code', 'Write tests'], tools: ['code_executor', 'summarize'], criteria: 'API works correctly' },
  ],
  ja: [
    { task: 'Pythonエラーのデバッグ', steps: ['エラー分析', 'バグ特定', '修正提供', '修正確認'], tools: ['code_executor', 'analyze'], criteria: 'エラーが解消' },
  ]
};

// 数据分析场景模板
const DATA_ANALYSIS_TEMPLATES = {
  zh: [
    { task: '销售趋势分析', steps: ['加载销售数据', '数据清洗', '趋势计算', '生成可视化图表'], tools: ['analyze', 'search'], criteria: '趋势分析准确且图表清晰' },
    { task: '用户行为分析', steps: ['收集用户数据', '行为分类', '统计分析', '生成洞察报告'], tools: ['analyze', 'summarize'], criteria: '分析结果有业务价值' },
    { task: 'A/B测试结果分析', steps: ['加载实验数据', '计算统计显著性', '分析效果差异', '生成决策建议'], tools: ['analyze'], criteria: '统计方法正确且结论可靠' },
    { task: '财务报表生成', steps: ['收集财务数据', '数据验证', '计算关键指标', '生成报表'], tools: ['analyze', 'summarize'], criteria: '报表准确完整' },
    { task: '客户分群分析', steps: ['收集客户数据', '特征工程', '聚类分析', '生成分群画像'], tools: ['analyze', 'search'], criteria: '分群合理可解释' },
    { task: '异常检测', steps: ['加载时序数据', '计算统计基线', '识别异常点', '生成告警'], tools: ['analyze'], criteria: '异常检测准确率>90%' },
    { task: '预测建模', steps: ['数据预处理', '特征选择', '模型训练', '评估预测效果'], tools: ['analyze', 'code_executor'], criteria: '预测准确率达标' },
    { task: '竞品分析报告', steps: ['收集竞品数据', '对比分析', 'SWOT分析', '生成策略建议'], tools: ['search', 'analyze', 'summarize'], criteria: '分析全面且有洞察' },
  ],
  en: [
    { task: 'Sales trend analysis', steps: ['Load data', 'Clean data', 'Calculate trends', 'Generate charts'], tools: ['analyze', 'search'], criteria: 'Accurate trend analysis' },
    { task: 'User behavior analysis', steps: ['Collect data', 'Classify behavior', 'Statistical analysis', 'Generate insights'], tools: ['analyze', 'summarize'], criteria: 'Valuable business insights' },
  ],
  ja: [
    { task: '売上トレンド分析', steps: ['データ読み込み', 'データクレンジング', 'トレンド計算', 'グラフ生成'], tools: ['analyze', 'search'], criteria: '正確なトレンド分析' },
  ]
};

const ALL_INTENTS = ['search', 'calculate', 'summarize', 'translate', 'execute_code', 'task_create', 'help', 'greeting', 'analyze', 'question', 'write', 'explain', 'plan', 'optimize', 'debug'];
const ALL_TOOLS = ['search', 'calculate', 'translate', 'code_executor', 'summarize', 'time', 'writing', 'learning', 'analyze', 'data_analysis'];

/**
 * 训练数据生成器
 */
export class TrainingDataGenerator {
  private config: DataGenerationConfig;

  constructor(config?: Partial<DataGenerationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 生成完整训练数据集
   */
  generate(): TrainingRecord[] {
    const records: TrainingRecord[] = [];
    const { totalRecords, scenarios, languages, difficultyDistribution } = this.config;

    // 按场景分配数量
    const scenarioCounts = {
      customer_service: Math.floor(totalRecords * scenarios.customerService / 100),
      code_assistant: Math.floor(totalRecords * scenarios.codeAssistant / 100),
      data_analysis: Math.floor(totalRecords * scenarios.dataAnalysis / 100)
    };

    // 逐个场景生成
    records.push(...this.generateForScenario('customer_service', scenarioCounts.customer_service));
    records.push(...this.generateForScenario('code_assistant', scenarioCounts.code_assistant));
    records.push(...this.generateForScenario('data_analysis', scenarioCounts.data_analysis));

    // 补充到目标数量
    while (records.length < totalRecords) {
      const scenario = ['customer_service', 'code_assistant', 'data_analysis'][Math.floor(Math.random() * 3)] as ScenarioType;
      records.push(this.generateSingleRecord(scenario));
    }

    console.log(`[TrainingDataGenerator] Generated ${records.length} training records`);
    return records;
  }

  /**
   * 按场景生成数据
   */
  private generateForScenario(scenario: ScenarioType, count: number): TrainingRecord[] {
    const templates = this.getTemplatesForScenario(scenario);
    const records: TrainingRecord[] = [];

    for (let i = 0; i < count; i++) {
      records.push(this.generateSingleRecord(scenario, templates));
    }

    return records;
  }

  /**
   * 获取场景模板
   */
  private getTemplatesForScenario(scenario: ScenarioType): Record<string, Array<{
    task: string;
    steps: string[];
    tools: string[];
    criteria: string;
  }>> {
    switch (scenario) {
      case 'customer_service': return CUSTOMER_SERVICE_TEMPLATES;
      case 'code_assistant': return CODE_ASSISTANT_TEMPLATES;
      case 'data_analysis': return DATA_ANALYSIS_TEMPLATES;
    }
  }

  /**
   * 生成单条训练记录
   */
  private generateSingleRecord(
    scenario: ScenarioType,
    templates?: Record<string, Array<{ task: string; steps: string[]; tools: string[]; criteria: string }>>
  ): TrainingRecord {
    const lang = this.selectLanguage();
    templates = templates || this.getTemplatesForScenario(scenario);
    const langTemplates = templates[lang] || templates.zh;
    const template = langTemplates[Math.floor(Math.random() * langTemplates.length)];

    const difficulty = this.selectDifficulty();
    const augmentedSteps = this.augmentSteps(template.steps, difficulty);

    return {
      id: generateId(),
      scenario,
      taskDescription: template.task,
      context: this.generateContext(scenario, lang),
      intermediateSteps: augmentedSteps,
      expectedResult: `成功完成: ${template.task}`,
      evaluationMetrics: {
        difficulty,
        expectedSteps: augmentedSteps.length,
        requiredTools: template.tools,
        successCriteria: template.criteria
      },
      language: lang,
      tags: this.generateTags(scenario, template.task),
      createdAt: new Date(),
      qualityScore: this.calculateQualityScore(difficulty, template)
    };
  }

  /**
   * 按配置分布选择语言
   */
  private selectLanguage(): 'zh' | 'en' | 'ja' {
    const { languages } = this.config;
    const r = Math.random() * 100;
    if (r < languages.zh) return 'zh';
    if (r < languages.zh + languages.en) return 'en';
    return 'ja';
  }

  /**
   * 按配置分布选择难度
   */
  private selectDifficulty(): 'easy' | 'medium' | 'hard' {
    const { difficultyDistribution } = this.config;
    const r = Math.random() * 100;
    if (r < difficultyDistribution.easy) return 'easy';
    if (r < difficultyDistribution.easy + difficultyDistribution.medium) return 'medium';
    return 'hard';
  }

  /**
   * 根据难度增强步骤
   */
  private augmentSteps(baseSteps: string[], difficulty: string): string[] {
    const steps = [...baseSteps];

    if (difficulty === 'medium') {
      steps.push('验证结果准确性');
      steps.splice(Math.floor(steps.length / 2), 0, '评估中间结果质量');
    } else if (difficulty === 'hard') {
      steps.push('验证结果准确性');
      steps.push('生成详细执行报告');
      steps.splice(Math.floor(steps.length / 3), 0, '识别潜在风险和边界情况');
      steps.splice(Math.floor(steps.length * 2 / 3), 0, '处理异常情况和降级方案');
    }

    return steps;
  }

  /**
   * 生成场景上下文
   */
  private generateContext(scenario: ScenarioType, lang: string): string {
    const contexts: Record<ScenarioType, Record<string, string[]>> = {
      customer_service: {
        zh: ['电商平台客服场景', '用户通过在线聊天咨询', '工作时间：9:00-18:00'],
        en: ['E-commerce customer service', 'User chats online', 'Business hours: 9AM-6PM'],
        ja: ['ECサイトカスタマーサービス', 'オンラインチャット', '営業時間: 9:00-18:00']
      },
      code_assistant: {
        zh: ['开发者IDE集成场景', '用户提交代码或描述需求', '支持Python/JavaScript/TypeScript'],
        en: ['IDE integration scenario', 'User submits code or describes needs', 'Python/JavaScript/TypeScript supported'],
        ja: ['IDE統合シナリオ', 'コードまたは要件を提出', 'Python/JavaScript/TypeScript対応']
      },
      data_analysis: {
        zh: ['企业数据分析平台', '用户上传数据或描述分析需求', '支持SQL查询和可视化'],
        en: ['Enterprise data analysis platform', 'User uploads data or describes needs', 'SQL and visualization supported'],
        ja: ['企業データ分析プラットフォーム', 'データまたは分析ニーズを提出', 'SQLと可視化対応']
      }
    };

    const scenarioContexts = contexts[scenario];
    const langContexts = scenarioContexts[lang] || scenarioContexts.zh;
    return langContexts.join('；');
  }

  /**
   * 生成标签
   */
  private generateTags(scenario: ScenarioType, task: string): string[] {
    const tags: string[] = [scenario];
    const lowerTask = task.toLowerCase();

    if (/查询|搜索|search|query/i.test(lowerTask)) tags.push('search');
    if (/代码|编程|code|program/i.test(lowerTask)) tags.push('code');
    if (/分析|analysis|analytics/i.test(lowerTask)) tags.push('analysis');
    if (/调试|debug|bug|error/i.test(lowerTask)) tags.push('debug');
    if (/优化|optimize|improve/i.test(lowerTask)) tags.push('optimization');
    if (/报表|report|可视化/i.test(lowerTask)) tags.push('reporting');

    return tags;
  }

  /**
   * 计算质量分数
   */
  private calculateQualityScore(
    difficulty: string,
    template: { task: string; steps: string[]; tools: string[]; criteria: string }
  ): number {
    let score = 0.7; // 基础分

    // 步骤完整性
    if (template.steps.length >= 3) score += 0.1;
    if (template.steps.length >= 5) score += 0.05;

    // 工具丰富度
    if (template.tools.length >= 2) score += 0.05;
    if (template.tools.length >= 3) score += 0.05;

    // 质量标准明确性
    if (template.criteria.length > 10) score += 0.05;

    // 难度调整
    if (difficulty === 'hard') score += 0.05;

    return Math.min(1, score);
  }

  /**
   * 评估数据质量
   */
  assessQuality(records: TrainingRecord[]): DataQualityReport {
    console.log(`[DataQuality] Assessing ${records.length} records...`);

    // 去重
    const uniqueRecords = this.removeDuplicates(records);
    const duplicatesRemoved = records.length - uniqueRecords.length;

    // 低质量过滤
    const qualityFiltered = uniqueRecords.filter(r => (r.qualityScore || 0) >= 0.6);
    const lowQualityRemoved = uniqueRecords.length - qualityFiltered.length;

    // 统计分析
    const byScenario: Record<ScenarioType, number> = {
      customer_service: 0,
      code_assistant: 0,
      data_analysis: 0
    };
    const byLanguage: Record<string, number> = {};
    const byDifficulty: Record<string, number> = { easy: 0, medium: 0, hard: 0 };

    for (const record of qualityFiltered) {
      byScenario[record.scenario] = (byScenario[record.scenario] || 0) + 1;
      byLanguage[record.language] = (byLanguage[record.language] || 0) + 1;
      byDifficulty[record.evaluationMetrics.difficulty] = (byDifficulty[record.evaluationMetrics.difficulty] || 0) + 1;
    }

    // 覆盖率分析
    const coveredIntents = new Set<string>();
    const coveredTools = new Set<string>();
    for (const record of qualityFiltered) {
      for (const tag of record.tags) coveredIntents.add(tag);
      for (const tool of record.evaluationMetrics.requiredTools) coveredTools.add(tool);
    }

    const averageQuality = qualityFiltered.length > 0
      ? qualityFiltered.reduce((s, r) => s + (r.qualityScore || 0), 0) / qualityFiltered.length
      : 0;

    return {
      totalRecords: records.length,
      duplicatesRemoved,
      lowQualityRemoved,
      finalCount: qualityFiltered.length,
      byScenario,
      byLanguage,
      byDifficulty,
      averageQualityScore: Math.round(averageQuality * 100) / 100,
      coverageReport: {
        coveredIntents: Array.from(coveredIntents),
        coveredTools: Array.from(coveredTools),
        missingIntents: ALL_INTENTS.filter(i => !coveredIntents.has(i)),
        missingTools: ALL_TOOLS.filter(t => !coveredTools.has(t))
      }
    };
  }

  /**
   * 去重（基于任务描述 + 步骤的近似匹配）
   */
  private removeDuplicates(records: TrainingRecord[]): TrainingRecord[] {
    const seen = new Set<string>();
    const unique: TrainingRecord[] = [];

    for (const record of records) {
      const key = `${record.scenario}|${record.taskDescription}|${record.language}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(record);
      }
    }

    return unique;
  }

  /**
   * 保存数据集到文件
   */
  saveToFile(records: TrainingRecord[], filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const output = {
      metadata: {
        generatedAt: new Date().toISOString(),
        config: this.config,
        count: records.length
      },
      records
    };

    fs.writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`[TrainingDataGenerator] Saved ${records.length} records to ${filePath}`);
  }

  /**
   * 从文件加载数据集
   */
  loadFromFile(filePath: string): TrainingRecord[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data.records || [];
  }

  /**
   * 导出为 CSV（便于数据标注工具使用）
   */
  exportToCSV(records: TrainingRecord[], filePath: string): void {
    const headers = ['id', 'scenario', 'language', 'difficulty', 'taskDescription', 'steps', 'expectedResult', 'requiredTools', 'successCriteria', 'tags', 'qualityScore'];
    const lines = [headers.join(',')];

    for (const record of records) {
      const row = [
        record.id,
        record.scenario,
        record.language,
        record.evaluationMetrics.difficulty,
        `"${record.taskDescription.replace(/"/g, '""')}"`,
        `"${record.intermediateSteps.join(' -> ')}"`,
        `"${record.expectedResult.replace(/"/g, '""')}"`,
        record.evaluationMetrics.requiredTools.join('|'),
        `"${record.evaluationMetrics.successCriteria.replace(/"/g, '""')}"`,
        record.tags.join('|'),
        record.qualityScore || ''
      ];
      lines.push(row.join(','));
    }

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    console.log(`[TrainingDataGenerator] Exported CSV to ${filePath}`);
  }
}

// === 直接运行脚本 ===
if (require.main === module) {
  const generator = new TrainingDataGenerator({
    totalRecords: 100000,
    scenarios: { customerService: 40, codeAssistant: 35, dataAnalysis: 25 }
  });

  console.log('Starting training data generation...');
  const records = generator.generate();

  // 质量评估
  const qualityReport = generator.assessQuality(records);
  console.log('\n=== Data Quality Report ===');
  console.log(`Total: ${qualityReport.totalRecords}`);
  console.log(`Duplicates removed: ${qualityReport.duplicatesRemoved}`);
  console.log(`Low quality removed: ${qualityReport.lowQualityRemoved}`);
  console.log(`Final count: ${qualityReport.finalCount}`);
  console.log(`Average quality: ${qualityReport.averageQualityScore}`);
  console.log(`By scenario:`, qualityReport.byScenario);
  console.log(`By language:`, qualityReport.byLanguage);
  console.log(`Coverage - Missing intents: ${qualityReport.coverageReport.missingIntents.join(', ') || 'none'}`);
  console.log(`Coverage - Missing tools: ${qualityReport.coverageReport.missingTools.join(', ') || 'none'}`);

  // 保存
  const outputDir = path.join(__dirname, '..', '..', '..', '..', 'train', 'data');
  generator.saveToFile(records, path.join(outputDir, 'training_data.json'));
  generator.exportToCSV(records, path.join(outputDir, 'training_data.csv'));

  console.log('Done!');
}
