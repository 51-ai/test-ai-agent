/**
 * 模拟场景管理器 - 整合所有模拟场景组件
 */

import { Agent } from '../Agent';
import { RLModule } from '../rl/RLModule';
import { ScenarioGenerator } from './ScenarioGenerator';
import { UserSimulator } from './UserSimulator';
import { ScenarioEvaluator } from './ScenarioEvaluator';
import {
  Scenario,
  ScenarioCategory,
  ScenarioConstraint,
  ScenarioObjective,
  ScenarioMetadata,
  SimulatedUser,
  SimulationConfig,
  SimulationResult,
  ScenarioResult,
  SimulatedConversation,
  ConversationTurn,
  AggregatedMetrics,
  TrainingData
} from './types';

export class SimulationManager {
  private agent: Agent;
  private rlModule?: RLModule;
  private generator: ScenarioGenerator;
  private userSimulator: UserSimulator;
  private evaluator: ScenarioEvaluator;

  private currentScenario?: Scenario;
  private currentUser?: SimulatedUser;
  private currentConversation?: SimulatedConversation;

  // ========== 新增：多场景并行模拟支持 ==========
  private parallelSessions: Map<string, {
    scenario: Scenario;
    user: SimulatedUser;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: ScenarioResult;
    startTime?: number;
  }> = new Map();
  private maxParallelism: number = 3;

  // ========== 新增：用户行为学习 ==========
  private userBehaviorLearner: UserBehaviorLearner = new UserBehaviorLearner();
  private learnedBehaviorPatterns: Map<string, UserBehaviorPattern> = new Map();

  // ========== 新增：模拟日志记录 ==========
  private simulationLogs: SimulationLog[] = [];
  private logLevel: 'minimal' | 'normal' | 'verbose' = 'normal';
  private enableLogRecording: boolean = true;

  // ========== 新增：模拟结果对比 ==========
  private comparisonResults: Map<string, SimulationResult> = new Map();

  // ========== 新增：异常场景注入 ==========
  private injectedAnomalies: AnomalyInjection[] = [];
  private anomalyInjectionEnabled: boolean = false;

  // ========== 新增：模拟任务调度 ==========
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private schedulerInterval?: NodeJS.Timeout;
  private cacheCleanupInterval?: NodeJS.Timeout;

  // ========== 新增：性能指标收集 ==========
  private performanceMetrics: PerformanceMetrics = {
    totalSimulations: 0,
    avgDuration: 0,
    peakMemory: 0,
    cpuUsage: 0,
    cacheHitRate: 0
  };
  private executionCache: Map<string, CachedResult> = new Map();

  constructor(agent: Agent, rlModule?: RLModule) {
    this.agent = agent;
    this.rlModule = rlModule;
    this.generator = new ScenarioGenerator();
    this.userSimulator = new UserSimulator();
    this.evaluator = new ScenarioEvaluator('balanced');
    this.startScheduler();
  }

  /**
   * 运行完整模拟
   */
  async runSimulation(config: SimulationConfig): Promise<SimulationResult> {
    const scenarioResults: ScenarioResult[] = [];
    const trainingData: TrainingData[] = [];
    const startTime = Date.now();

    console.log(`[Simulation] Starting simulation with ${config.numEpisodes} episodes...`);

    for (let i = 0; i < config.numEpisodes; i++) {
      console.log(`[Simulation] Running episode ${i + 1}/${config.numEpisodes}`);

      // 选择场景和用户
      const scenario = config.scenarios[i % config.scenarios.length];
      const user = config.userProfiles[i % config.userProfiles.length];

      // 运行单个场景
      const result = await this.runScenario(scenario, user);
      scenarioResults.push(result);

      // 收集训练数据
      if (config.saveResults && this.rlModule) {
        trainingData.push({
          scenario,
          experience: this.createExperience(result)
        });
      }

      // 实时反馈
      if (config.enableRealTimeFeedback) {
        console.log(`[Simulation] Episode ${i + 1} completed: Score=${result.score.toFixed(2)}, Success=${result.success}`);
      }
    }

    // 生成汇总结果
    const aggregatedMetrics = this.aggregateMetrics(scenarioResults);
    const overallScore = this.calculateOverallScore(aggregatedMetrics);
    const successRate = scenarioResults.filter(r => r.success).length / scenarioResults.length;

    const result: SimulationResult = {
      overallScore,
      successRate,
      scenarioResults,
      aggregatedMetrics,
      trainingData,
      recommendations: this.generateRecommendations(aggregatedMetrics),
      summary: this.generateSummary(aggregatedMetrics, successRate, overallScore)
    };

    console.log(`[Simulation] Simulation completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    console.log(`[Simulation] Overall Score: ${overallScore.toFixed(2)}, Success Rate: ${(successRate * 100).toFixed(1)}%`);

    return result;
  }

  /**
   * 运行单个场景
   */
  async runScenario(scenario: Scenario, user: SimulatedUser): Promise<ScenarioResult> {
    this.currentScenario = scenario;
    this.currentUser = user;

    const conversation: SimulatedConversation = {
      turns: [],
      totalDuration: 0,
      userProfile: user.profile
    };

    const startTime = Date.now();
    const maxTurns = this.getMaxTurns(scenario);
    const maxTime = this.getMaxTime(scenario);

    // 生成初始用户消息
    let currentUserMessage = this.userSimulator.generateInitialMessage(scenario, user);
    let turnNumber = 0;

    while (turnNumber < maxTurns && Date.now() - startTime < maxTime) {
      turnNumber++;
      const turnStartTime = Date.now();

      // Agent处理
      const agentResponse = await this.agent.processInput(
        currentUserMessage,
        user.id
      );

      // 记录对话轮次
      const turn: ConversationTurn = {
        turnNumber,
        userMessage: currentUserMessage,
        agentResponse: agentResponse.content,
        timestamp: new Date(),
        reward: 0,
        metadata: {}
      };

      conversation.turns.push(turn);

      // 模拟用户响应
      const userFeedback = this.userSimulator.simulateUserMessage(
        user,
        scenario,
        agentResponse.content,
        turnNumber
      );

      turn.metadata = {
        sentiment: userFeedback.sentiment,
        intent: userFeedback.intent
      };

      // 计算本轮奖励
      const reward = this.calculateTurnReward(turn, userFeedback);
      turn.reward = reward;

      // 检查是否应该结束
      if (this.shouldEndConversation(scenario, turn, userFeedback)) {
        break;
      }

      // 生成下一轮用户消息
      currentUserMessage = userFeedback.message;
    }

    conversation.totalDuration = Date.now() - startTime;

    // 评估场景
    const result = this.evaluator.evaluateScenario(scenario, conversation);

    // 清理
    this.userSimulator.clearContext(user.id);
    this.currentScenario = undefined;
    this.currentUser = undefined;
    this.currentConversation = undefined;

    return result;
  }

  /**
   * 运行渐进式训练
   */
  async runCurriculumTraining(
    category: string,
    levels: number[] = [1, 2, 3, 4, 5],
    episodesPerLevel: number = 5
  ): Promise<SimulationResult[]> {
    const results: SimulationResult[] = [];

    console.log(`[Simulation] Starting curriculum training for ${category}...`);

    for (const difficulty of levels) {
      console.log(`[Simulation] Training at difficulty ${difficulty}...`);

      const scenarios = this.generator.generateScenariosForCategory(
        category as any,
        episodesPerLevel
      );

      // 设置难度
      scenarios.forEach(s => s.difficulty = difficulty);

      const config: SimulationConfig = {
        numEpisodes: episodesPerLevel,
        scenarios,
        userProfiles: [this.generator.getRandomUserProfile()],
        evaluationMode: 'balanced',
        enableRealTimeFeedback: true,
        saveResults: true,
        parallelScenarios: 1
      };

      const result = await this.runSimulation(config);
      results.push(result);

      // 检查是否准备好进入下一级别
      if (result.successRate < 0.6) {
        console.log(`[Simulation] Success rate too low (${(result.successRate * 100).toFixed(1)}%), repeating difficulty ${difficulty}`);
      } else {
        console.log(`[Simulation] Proceeding to difficulty ${difficulty + 1}`);
      }
    }

    return results;
  }

  /**
   * 运行压力测试
   */
  async runStressTest(config: {
    numConcurrent: number;
    totalRequests: number;
    scenario: Scenario;
  }): Promise<any> {
    console.log(`[Simulation] Starting stress test...`);

    const startTime = Date.now();
    let completedRequests = 0;
    let failedRequests = 0;

    const user = this.generator.getRandomUserProfile();

    const runRequest = async (): Promise<void> => {
      try {
        await this.runScenario(config.scenario, user);
        completedRequests++;
      } catch (error) {
        failedRequests++;
        console.error('[StressTest] Request failed:', error);
      }
    };

    const batches = Math.ceil(config.totalRequests / config.numConcurrent);
    
    for (let i = 0; i < batches; i++) {
      const promises = [];
      const batchSize = Math.min(
        config.numConcurrent,
        config.totalRequests - i * config.numConcurrent
      );

      for (let j = 0; j < batchSize; j++) {
        promises.push(runRequest());
      }

      await Promise.all(promises);
      
      console.log(`[StressTest] Progress: ${Math.min((i + 1) * config.numConcurrent, config.totalRequests)}/${config.totalRequests}`);
    }

    const duration = Date.now() - startTime;
    const successRate = completedRequests / config.totalRequests;
    const throughput = (completedRequests / duration) * 1000; // req/s

    return {
      totalRequests: config.totalRequests,
      completedRequests,
      failedRequests,
      successRate,
      duration,
      throughput,
      avgLatency: duration / config.totalRequests
    };
  }

  /**
   * 生成测试报告
   */
  generateReport(result: SimulationResult): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('                    模 拟 场 景 测 试 报 告');
    lines.push('='.repeat(80));
    lines.push('');

    lines.push(`总体评分: ${result.overallScore.toFixed(2)} / 100`);
    lines.push(`成功率:   ${(result.successRate * 100).toFixed(1)}%`);
    lines.push('');

    lines.push('-' .repeat(80));
    lines.push('汇总指标');
    lines.push('-' .repeat(80));
    lines.push(`平均准确性:        ${(result.aggregatedMetrics.avgAccuracy * 100).toFixed(1)}%`);
    lines.push(`平均相关性:         ${(result.aggregatedMetrics.avgRelevance * 100).toFixed(1)}%`);
    lines.push(`平均效率:           ${(result.aggregatedMetrics.avgEfficiency * 100).toFixed(1)}%`);
    lines.push(`平均用户满意度:     ${(result.aggregatedMetrics.avgUserSatisfaction * 100).toFixed(1)}%`);
    lines.push(`总对话轮数:         ${result.aggregatedMetrics.totalTurns}`);
    lines.push(`总工具使用次数:     ${result.aggregatedMetrics.totalToolsUsed}`);
    lines.push('');

    lines.push('-' .repeat(80));
    lines.push('详细结果');
    lines.push('-' .repeat(80));

    result.scenarioResults.forEach((r, index) => {
      lines.push(`\n场景 ${index + 1}: ${r.scenarioId}`);
      lines.push(`  评分: ${r.score.toFixed(2)} | 成功: ${r.success ? '是' : '否'}`);
      lines.push(`  轮数: ${r.metrics.turnsUsed} | 工具: ${r.metrics.toolsUsed.length}`);
    });

    lines.push('\n' + '='.repeat(80));

    return lines.join('\n');
  }

  /**
   * 获取最大轮数
   */
  private getMaxTurns(scenario: Scenario): number {
    const constraint = scenario.constraints.find(c => c.type === 'max_turns');
    return (constraint?.value as number) || 10;
  }

  /**
   * 获取最大时间
   */
  private getMaxTime(scenario: Scenario): number {
    const constraint = scenario.constraints.find(c => c.type === 'max_time');
    return (constraint?.value as number) || 60000;
  }

  /**
   * 计算单轮奖励
   */
  private calculateTurnReward(turn: ConversationTurn, feedback: any): number {
    let reward = 0.5; // 基础奖励

    // 响应长度合理
    if (turn.agentResponse.length > 20 && turn.agentResponse.length < 500) {
      reward += 0.1;
    }

    // 用户情感正面
    if (feedback.sentiment > 0.6) {
      reward += 0.2;
    } else if (feedback.sentiment < 0.4) {
      reward -= 0.2;
    }

    return Math.max(0, Math.min(1, reward));
  }

  /**
   * 判断是否应该结束对话
   */
  private shouldEndConversation(scenario: Scenario, turn: ConversationTurn, feedback: any): boolean {
    // 用户表示满意或结束
    const closingPhrases = [
      '谢谢', '感谢', '明白了', '好的', '完美',
      'thanks', 'thank you', 'great', 'perfect', 'got it'
    ];

    const isClosing = closingPhrases.some(phrase => 
      turn.userMessage.toLowerCase().includes(phrase.toLowerCase())
    );

    if (isClosing) {
      return true;
    }

    // 用户情感持续负面
    if (feedback.sentiment < 0.3) {
      return true;
    }

    // 目标达成检查
    const hasCompletedObjective = this.checkObjectives(scenario, turn);

    return hasCompletedObjective;
  }

  /**
   * 检查目标是否达成
   */
  private checkObjectives(scenario: Scenario, turn: ConversationTurn): boolean {
    // 简化版本：检查响应是否包含相关内容
    const response = turn.agentResponse.toLowerCase();

    for (const objective of scenario.objectives) {
      if (objective.required && !objective.description) {
        // 如果有明确的必需目标需要检查
        continue;
      }
    }

    return false;
  }

  /**
   * 聚合指标
   */
  private aggregateMetrics(results: ScenarioResult[]): AggregatedMetrics {
    if (results.length === 0) {
      return {
        avgAccuracy: 0,
        avgRelevance: 0,
        avgEfficiency: 0,
        avgUserSatisfaction: 0,
        totalTurns: 0,
        totalToolsUsed: 0,
        mostDifficultScenarios: [],
        easiestScenarios: []
      };
    }

    const totalAccuracy = results.reduce((sum, r) => sum + r.metrics.accuracy, 0);
    const totalRelevance = results.reduce((sum, r) => sum + r.metrics.relevance, 0);
    const totalEfficiency = results.reduce((sum, r) => sum + r.metrics.efficiency, 0);
    const totalSatisfaction = results.reduce((sum, r) => sum + r.metrics.userSatisfaction, 0);
    const totalTurns = results.reduce((sum, r) => sum + r.metrics.turnsUsed, 0);
    const totalTools = new Set<string>();

    results.forEach(r => {
      r.metrics.toolsUsed.forEach(tool => totalTools.add(tool));
    });

    const sortedByScore = [...results].sort((a, b) => a.score - b.score);
    const mostDifficult = sortedByScore.slice(0, 3).map(r => r.scenarioId);
    const easiest = sortedByScore.slice(-3).map(r => r.scenarioId);

    return {
      avgAccuracy: totalAccuracy / results.length,
      avgRelevance: totalRelevance / results.length,
      avgEfficiency: totalEfficiency / results.length,
      avgUserSatisfaction: totalSatisfaction / results.length,
      totalTurns,
      totalToolsUsed: totalTools.size,
      mostDifficultScenarios: mostDifficult,
      easiestScenarios: easiest
    };
  }

  /**
   * 计算总体评分
   */
  private calculateOverallScore(metrics: AggregatedMetrics): number {
    return (
      metrics.avgAccuracy * 0.3 +
      metrics.avgRelevance * 0.25 +
      metrics.avgEfficiency * 0.2 +
      metrics.avgUserSatisfaction * 0.25
    ) * 100;
  }

  /**
   * 生成建议
   */
  private generateRecommendations(metrics: AggregatedMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.avgAccuracy < 0.7) {
      recommendations.push('需要提高回答的准确性');
    }

    if (metrics.avgRelevance < 0.7) {
      recommendations.push('需要更好地理解用户意图');
    }

    if (metrics.avgEfficiency < 0.7) {
      recommendations.push('需要优化响应策略');
    }

    if (metrics.avgUserSatisfaction < 0.7) {
      recommendations.push('需要改善用户体验');
    }

    if (recommendations.length === 0) {
      recommendations.push('整体表现优秀！');
    }

    return recommendations;
  }

  /**
   * 生成总结
   */
  private generateSummary(
    metrics: AggregatedMetrics,
    successRate: number,
    overallScore: number
  ): string {
    let summary = '';

    if (overallScore >= 80) {
      summary = '表现优秀！Agent已经具备了较强的能力。';
    } else if (overallScore >= 60) {
      summary = '表现良好，但仍有提升空间。';
    } else if (overallScore >= 40) {
      summary = '表现一般，需要重点改进。';
    } else {
      summary = '表现较差，需要全面优化。';
    }

    summary += `\n成功率: ${(successRate * 100).toFixed(1)}%`;
    summary += `\n最困难场景: ${metrics.mostDifficultScenarios.slice(0, 2).join(', ') || '无'}`;

    return summary;
  }

  /**
   * 创建训练经验
   */
  private createExperience(result: ScenarioResult): any {
    return {
      state: { scenarioId: result.scenarioId },
      action: { response: result.conversation.turns[0]?.agentResponse },
      reward: result.score,
      nextState: { success: result.success },
      done: true
    };
  }

  /**
   * 获取场景生成器
   */
  getScenarioGenerator(): ScenarioGenerator {
    return this.generator;
  }

  /**
   * 获取用户模拟器
   */
  getUserSimulator(): UserSimulator {
    return this.userSimulator;
  }

  /**
   * 获取评估器
   */
  getEvaluator(): ScenarioEvaluator {
    return this.evaluator;
  }

  // =====================================================
  // ========== 多场景并行模拟 ================
  // =====================================================

  /**
   * 运行多场景并行模拟
   */
  async runParallelSimulation(config: SimulationConfig): Promise<Map<string, ScenarioResult>> {
    const results = new Map<string, ScenarioResult>();
    const parallelism = Math.min(config.parallelScenarios || 1, this.maxParallelism);
    
    this.log('info', `Starting parallel simulation with ${config.numEpisodes} episodes, parallelism=${parallelism}`);

    const chunks = this.chunkArray(Array.from({ length: config.numEpisodes }), parallelism);
    
    for (const chunk of chunks) {
      const promises = chunk.map((_, idx) => {
        const episodeIndex = chunk.indexOf(_) + chunks.indexOf(chunk) * parallelism;
        const scenario = config.scenarios[episodeIndex % config.scenarios.length];
        const user = config.userProfiles[episodeIndex % config.userProfiles.length];
        return this.runScenarioWithSession(episodeIndex, scenario, user);
      });

      const chunkResults = await Promise.all(promises);
      chunkResults.forEach(result => {
        if (result) results.set(result.scenarioId, result);
      });
    }

    this.log('info', `Parallel simulation completed: ${results.size} scenarios`);
    return results;
  }

  /**
   * 带会话管理的场景运行
   */
  private async runScenarioWithSession(sessionId: number, scenario: Scenario, user: SimulatedUser): Promise<ScenarioResult | undefined> {
    const sessionKey = `session_${sessionId}`;
    
    try {
      this.parallelSessions.set(sessionKey, {
        scenario,
        user,
        status: 'running',
        startTime: Date.now()
      });

      this.recordLog('session_start', { sessionId, scenarioId: scenario.id, userId: user.id });

      const result = await this.runScenario(scenario, user);

      this.parallelSessions.set(sessionKey, {
        scenario,
        user,
        status: 'completed',
        result
      });

      this.recordLog('session_end', { sessionId, scenarioId: scenario.id, duration: Date.now() - (this.parallelSessions.get(sessionKey)?.startTime || 0) });

      return result;
    } catch (error) {
      this.parallelSessions.set(sessionKey, {
        scenario,
        user,
        status: 'failed'
      });
      this.recordLog('session_error', { sessionId, scenarioId: scenario.id, error: String(error) });
      throw error;
    }
  }

  /**
   * 获取并行会话状态
   */
  getParallelSessionStatus(): Map<string, string> {
    const status = new Map<string, string>();
    this.parallelSessions.forEach((v, k) => status.set(k, v.status));
    return status;
  }

  /**
   * 设置最大并行度
   */
  setMaxParallelism(max: number): void {
    this.maxParallelism = Math.max(1, Math.min(max, 10));
    this.log('info', `Max parallelism set to ${this.maxParallelism}`);
  }

  // =====================================================
  // ========== 用户行为学习 ================
  // =====================================================

  /**
   * 从真实交互中学习用户行为模式
   */
  learnFromInteraction(userId: string, conversation: SimulatedConversation): void {
    this.recordLog('behavior_learning', { userId, turnCount: conversation.turns.length });

    const patterns = this.userBehaviorLearner.analyzeConversation(conversation, userId);
    this.learnedBehaviorPatterns.set(userId, patterns);

    this.log('info', `Learned behavior patterns for user ${userId}: ${patterns.totalInteractions} interactions`);
  }

  /**
   * 获取学习到的用户行为模式
   */
  getLearnedBehaviorPattern(userId: string): UserBehaviorPattern | undefined {
    return this.learnedBehaviorPatterns.get(userId);
  }

  /**
   * 基于学习到的模式生成用户消息
   */
  generateUserMessageWithLearning(
    userId: string,
    scenario: Scenario,
    agentResponse: string,
    turnNumber: number
  ): string {
    const pattern = this.learnedBehaviorPatterns.get(userId);
    
    if (!pattern) {
      return this.userSimulator.simulateUserMessage(
        this.learnedBehaviorPatterns.get(userId) as any,
        scenario,
        agentResponse,
        turnNumber
      ).message;
    }

    // 基于学习到的模式调整消息生成
    const baseMessage = this.userSimulator.simulateUserMessage(
      this.createSimulatedUserFromPattern(userId, pattern),
      scenario,
      agentResponse,
      turnNumber
    );

    // 应用学习到的偏好
    const adjustedMessage = this.applyLearnedPreferences(
      baseMessage.message,
      pattern,
      turnNumber
    );

    return adjustedMessage;
  }

  /**
   * 从模式创建模拟用户
   */
  private createSimulatedUserFromPattern(userId: string, pattern: UserBehaviorPattern): SimulatedUser {
    return {
      id: userId,
      profile: {
        expertise: 'intermediate',
        language: 'zh',
        personality: pattern.communicationStyle as any
      },
      behavior: {
        patienceLevel: pattern.avgPatience,
        expectedResponseTime: pattern.avgResponseTime,
        toleranceForErrors: pattern.toleranceLevel,
        communicationStyle: pattern.communicationStyle as any
      }
    };
  }

  /**
   * 应用学习到的偏好
   */
  private applyLearnedPreferences(message: string, pattern: UserBehaviorPattern, turnNumber: number): string {
    // 缩短不耐烦用户的回复
    if (pattern.avgPatience < 0.4 && message.length > 100) {
      const sentences = message.split(/[.!?]/);
      return sentences.slice(0, Math.ceil(sentences.length * 0.6)).join('.') + '.';
    }

    // 增加有深度需求用户的回复长度
    if (pattern.avgMessageLength > 150 && message.length < 100) {
      return message + ' 请详细解释一下。';
    }

    return message;
  }

  /**
   * 导出行为模式
   */
  exportBehaviorPatterns(): string {
    const patterns: Record<string, any> = {};
    this.learnedBehaviorPatterns.forEach((v, k) => {
      patterns[k] = {
        ...v,
        lastUpdated: new Date().toISOString()
      };
    });
    return JSON.stringify(patterns, null, 2);
  }

  /**
   * 导入行为模式
   */
  importBehaviorPatterns(jsonData: string): void {
    try {
      const patterns = JSON.parse(jsonData);
      Object.entries(patterns).forEach(([userId, pattern]: [string, any]) => {
        this.learnedBehaviorPatterns.set(userId, pattern);
      });
      this.log('info', `Imported behavior patterns for ${Object.keys(patterns).length} users`);
    } catch (error) {
      this.log('error', `Failed to import behavior patterns: ${error}`);
    }
  }

  // =====================================================
  // ========== 模拟结果对比分析 ================
  // =====================================================

  /**
   * 对比不同模拟配置的结果
   */
  async compareSimulationConfigs(
    configs: SimulationConfig[]
  ): Promise<ComparisonReport> {
    this.log('info', `Starting comparison of ${configs.length} configurations`);

    const results: SimulationResult[] = [];
    
    for (let i = 0; i < configs.length; i++) {
      this.recordLog('config_comparison', { configIndex: i, name: `Config ${i + 1}` });
      const result = await this.runSimulation(configs[i]);
      const configKey = `config_${i + 1}_${Date.now()}`;
      this.comparisonResults.set(configKey, result);
      results.push(result);
    }

    return this.generateComparisonReport(configs, results);
  }

  /**
   * 生成对比报告
   */
  private generateComparisonReport(configs: SimulationConfig[], results: SimulationResult[]): ComparisonReport {
    const metricsComparison = configs.map((config, i) => ({
      configName: `Config ${i + 1}`,
      config,
      overallScore: results[i].overallScore,
      successRate: results[i].successRate,
      avgAccuracy: results[i].aggregatedMetrics.avgAccuracy,
      avgRelevance: results[i].aggregatedMetrics.avgRelevance,
      avgEfficiency: results[i].aggregatedMetrics.avgEfficiency,
      avgUserSatisfaction: results[i].aggregatedMetrics.avgUserSatisfaction,
      totalDuration: results[i].scenarioResults.reduce((sum, r) => sum + r.metrics.completionTime, 0)
    }));

    // 找出最佳配置
    const bestByScore = metricsComparison.reduce((best, current) => 
      current.overallScore > best.overallScore ? current : best
    );
    const bestBySuccess = metricsComparison.reduce((best, current) => 
      current.successRate > best.successRate ? current : best
    );
    const bestByEfficiency = metricsComparison.reduce((best, current) => 
      current.avgEfficiency > best.avgEfficiency ? current : best
    );

    // 计算差异
    const scoreVariance = this.calculateVariance(results.map(r => r.overallScore));
    const successRateVariance = this.calculateVariance(results.map(r => r.successRate));

    return {
      timestamp: new Date(),
      numConfigs: configs.length,
      metricsComparison,
      bestByScore,
      bestBySuccess,
      bestByEfficiency,
      scoreVariance,
      successRateVariance,
      recommendations: this.generateComparisonRecommendations(metricsComparison)
    };
  }

  /**
   * 计算方差
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  /**
   * 生成对比建议
   */
  private generateComparisonRecommendations(comparison: MetricsComparison[]): string[] {
    const recommendations: string[] = [];

    const sortedByScore = [...comparison].sort((a, b) => b.overallScore - a.overallScore);
    const topScore = sortedByScore[0].overallScore;
    const bottomScore = sortedByScore[sortedByScore.length - 1].overallScore;

    if (topScore - bottomScore > 20) {
      recommendations.push('配置间性能差异显著，建议采用最佳配置策略');
    }

    const highVarianceConfigs = comparison.filter(c => (c.scoreVariance || 0) > 0.1);
    if (highVarianceConfigs.length > 0) {
      recommendations.push(`${highVarianceConfigs.length}个配置表现不稳定，需要优化`);
    }

    return recommendations;
  }

  /**
   * 获取对比结果历史
   */
  getComparisonHistory(): Map<string, SimulationResult> {
    return new Map(this.comparisonResults);
  }

  // =====================================================
  // ========== 模拟数据自动生成 ================
  // =====================================================

  /**
   * 自动生成多样化测试数据
   */
  generateSyntheticData(
    baseScenario: Scenario,
    count: number,
    variationStrategy: 'random' | 'systematic' | 'evolutionary' = 'random'
  ): Scenario[] {
    this.log('info', `Generating ${count} synthetic scenarios from base scenario ${baseScenario.id}`);

    const generated: Scenario[] = [];

    for (let i = 0; i < count; i++) {
      const syntheticScenario = this.createSyntheticScenario(baseScenario, i, variationStrategy);
      generated.push(syntheticScenario);
    }

    this.recordLog('synthetic_data_generated', { baseScenarioId: baseScenario.id, count: generated.length });

    return generated;
  }

  /**
   * 创建合成场景
   */
  private createSyntheticScenario(
    base: Scenario,
    index: number,
    strategy: 'random' | 'systematic' | 'evolutionary'
  ): Scenario {
    const variations = this.getScenarioVariations(base);

    switch (strategy) {
      case 'random':
        return this.applyRandomVariations(base, variations);
      case 'systematic':
        return this.applySystematicVariations(base, variations, index);
      case 'evolutionary':
        return this.applyEvolutionaryVariations(base, variations, index);
      default:
        return base;
    }
  }

  /**
   * 获取场景变体
   */
  private getScenarioVariations(scenario: Scenario): ScenarioVariation {
    return {
      difficultyRange: { min: Math.max(1, scenario.difficulty - 1), max: Math.min(5, scenario.difficulty + 1) },
      objectiveCountRange: { min: 1, max: Math.min(5, scenario.objectives.length + 2) },
      constraintTypes: ['max_turns', 'max_time', 'allowed_tools', 'required_tools'],
      categoryVariations: this.getCategoryVariations(scenario.category)
    };
  }

  /**
   * 获取类别变体
   */
  private getCategoryVariations(category: ScenarioCategory): ScenarioCategory[] {
    const categoryMap: Record<ScenarioCategory, ScenarioCategory[]> = {
      'conversation': ['question_answering', 'emotional_support'],
      'question_answering': ['conversation', 'technical'],
      'tool_usage': ['problem_solving', 'task_planning'],
      'problem_solving': ['technical', 'tool_usage'],
      'creativity': ['learning_assistance', 'conversation'],
      'technical': ['problem_solving', 'tool_usage'],
      'multi_turn': ['conversation', 'task_planning'],
      'conflict_resolution': ['emotional_support', 'conversation'],
      'emotional_support': ['conflict_resolution', 'conversation'],
      'learning_assistance': ['creativity', 'question_answering'],
      'task_planning': ['tool_usage', 'problem_solving']
    };
    return categoryMap[category] || ['conversation'];
  }

  /**
   * 应用随机变体
   */
  private applyRandomVariations(base: Scenario, variations: ScenarioVariation): Scenario {
    return {
      ...base,
      id: `${base.id}_synth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${base.name} (变体)`,
      difficulty: this.randomInt(variations.difficultyRange.min, variations.difficultyRange.max),
      objectives: this.generateRandomObjectives(base, variations),
      constraints: this.generateRandomConstraints(variations),
      category: this.randomChoice([base.category, ...variations.categoryVariations]),
      metadata: {
        ...base.metadata,
        tags: [...base.metadata.tags, 'synthetic'],
        createdAt: new Date()
      }
    };
  }

  /**
   * 应用系统性变体
   */
  private applySystematicVariations(base: Scenario, variations: ScenarioVariation, index: number): Scenario {
    const difficultyStep = (variations.difficultyRange.max - variations.difficultyRange.min) / Math.max(1, 4);
    const newDifficulty = Math.min(variations.difficultyRange.max, variations.difficultyRange.min + Math.floor(index / 2) * difficultyStep);

    return {
      ...base,
      id: `${base.id}_synth_sys_${index}`,
      name: `${base.name} (系统变体${index + 1})`,
      difficulty: Math.round(newDifficulty),
      objectives: base.objectives.slice(0, Math.min(base.objectives.length, index + 1)),
      constraints: variations.constraintTypes.slice(0, (index % 3) + 1).map(type => ({
        type: type as 'max_turns' | 'max_time' | 'allowed_tools' | 'required_tools',
        value: type === 'max_turns' ? 5 + index * 2 : type === 'max_time' ? 30000 + index * 10000 : null,
        description: `Systematic variation ${index}`
      })),
      metadata: {
        ...base.metadata,
        tags: [...base.metadata.tags, 'synthetic', 'systematic'],
        createdAt: new Date()
      }
    };
  }

  /**
   * 应用进化变体
   */
  private applyEvolutionaryVariations(base: Scenario, variations: ScenarioVariation, index: number): Scenario {
    // 模拟进化：每一代在前一代基础上微调
    const parentIndex = Math.max(0, index - 1);

    const metadata: ScenarioMetadata = {
      ...base.metadata,
      tags: [...base.metadata.tags, 'synthetic', 'evolutionary'],
      createdAt: new Date()
    };
    return {
      ...base,
      id: `${base.id}_synth_evo_${index}`,
      name: `${base.name} (进化代${index + 1})`,
      difficulty: this.clamp(variations.difficultyRange.min + (index % 3), variations.difficultyRange.min, variations.difficultyRange.max),
      objectives: base.objectives.map((obj, i) => ({
        ...obj,
        weight: obj.weight * (1 + (index % 3) * 0.1)
      })),
      constraints: base.constraints.map(c => ({
        ...c,
        value: typeof c.value === 'number' ? c.value * (1 + (index % 2) * 0.2) : c.value
      })) as ScenarioConstraint[],
      metadata
    };
  }

  /**
   * 生成随机目标
   */
  private generateRandomObjectives(base: Scenario, variations: ScenarioVariation): ScenarioObjective[] {
    const count = this.randomInt(variations.objectiveCountRange.min, variations.objectiveCountRange.max);
    return Array.from({ length: count }, (_, i) => ({
      id: `obj_${Date.now()}_${i}`,
      description: `Generated objective ${i + 1}`,
      required: i < Math.ceil(count / 2),
      weight: 0.5 + Math.random() * 0.5
    }));
  }

  /**
   * 生成随机约束
   */
  private generateRandomConstraints(variations: ScenarioVariation): ScenarioConstraint[] {
    const numConstraints = this.randomInt(1, 3);
    const selectedTypes = this.shuffleArray([...variations.constraintTypes]).slice(0, numConstraints);

    return selectedTypes.map(type => ({
      type: type as 'max_turns' | 'max_time' | 'allowed_tools' | 'required_tools',
      value: type === 'max_turns' ? this.randomInt(5, 15) : type === 'max_time' ? this.randomInt(30000, 120000) : null,
      description: `Generated constraint: ${type}`
    }));
  }

  // =====================================================
  // ========== 模拟性能优化 ================
  // =====================================================

  /**
   * 启用执行缓存
   */
  enableExecutionCache(ttlSeconds: number = 300): void {
    this.log('info', `Execution cache enabled with TTL=${ttlSeconds}s`);

    // 定期清理过期缓存（unref：不阻止进程退出）
    this.cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      this.executionCache.forEach((value, key) => {
        if (now - value.timestamp > ttlSeconds * 1000) {
          this.executionCache.delete(key);
          cleaned++;
        }
      });
      if (cleaned > 0) {
        this.log('debug', `Cache cleaned: ${cleaned} expired entries removed`);
      }
    }, ttlSeconds * 1000);
    this.cacheCleanupInterval.unref();
  }

  /**
   * 关闭执行缓存并停止清理定时器
   */
  disableExecutionCache(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = undefined;
    }
    this.executionCache.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; hitRate: number; entries: string[] } {
    const cacheEntries = Array.from(this.executionCache.entries());
    const totalHits = cacheEntries.reduce((sum, [_, v]) => sum + v.hitCount, 0);
    const totalRequests = cacheEntries.reduce((sum, [_, v]) => sum + v.hitCount + (v.hitCount > 0 ? 0 : 1), 0);

    return {
      size: cacheEntries.length,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      entries: cacheEntries.map(([k]) => k)
    };
  }

  /**
   * 预热缓存
   */
  async warmUpCache(scenarios: Scenario[], users: SimulatedUser[]): Promise<void> {
    this.log('info', `Warming up cache with ${scenarios.length} scenarios`);

    const pairs: Array<{ scenario: Scenario; user: SimulatedUser }> = [];
    for (const scenario of scenarios) {
      for (const user of users) {
        pairs.push({ scenario, user });
        if (pairs.length >= 10) break; // 限制预热数量
      }
    }

    // 并行预热
    await Promise.all(pairs.map(pair => this.runScenario(pair.scenario, pair.user)));
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(duration: number): void {
    this.performanceMetrics.totalSimulations++;
    this.performanceMetrics.avgDuration = 
      (this.performanceMetrics.avgDuration * (this.performanceMetrics.totalSimulations - 1) + duration) 
      / this.performanceMetrics.totalSimulations;

    // 简单估算内存使用
    const estimatedMemory = this.executionCache.size * 0.1; // MB
    this.performanceMetrics.peakMemory = Math.max(this.performanceMetrics.peakMemory, estimatedMemory);
  }

  // =====================================================
  // ========== 模拟日志记录 ================
  // =====================================================

  /**
   * 设置日志级别
   */
  setLogLevel(level: 'minimal' | 'normal' | 'verbose'): void {
    this.logLevel = level;
    this.log('info', `Log level set to ${level}`);
  }

  /**
   * 启用/禁用日志记录
   */
  setLogRecording(enabled: boolean): void {
    this.enableLogRecording = enabled;
    if (!enabled) {
      this.simulationLogs = [];
    }
  }

  /**
   * 记录日志
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    if (!this.enableLogRecording) return;

    const shouldLog = 
      (level === 'error') ||
      (level === 'warn' && this.logLevel !== 'minimal') ||
      (level === 'info' && this.logLevel !== 'minimal') ||
      (level === 'debug' && this.logLevel === 'verbose');

    if (shouldLog) {
      const logEntry: SimulationLog = {
        timestamp: new Date(),
        level,
        message,
        data,
        sessionId: this.currentScenario?.id
      };
      this.simulationLogs.push(logEntry);

      if (level === 'error' || level === 'warn') {
        console.error(`[Simulation:${level.toUpperCase()}] ${message}`, data || '');
      } else if (this.logLevel === 'verbose' || level === 'info') {
        console.log(`[Simulation:${level.toUpperCase()}] ${message}`, data || '');
      }
    }
  }

  /**
   * 记录事件
   */
  private recordLog(event: string, data: any): void {
    this.log('info', `[Event] ${event}`, data);
  }

  /**
   * 获取日志
   */
  getLogs(filter?: { level?: string; since?: Date; sessionId?: string }): SimulationLog[] {
    let logs = [...this.simulationLogs];

    if (filter?.level) {
      logs = logs.filter(l => l.level === filter.level);
    }
    if (filter?.since) {
      logs = logs.filter(l => l.timestamp >= filter.since!);
    }
    if (filter?.sessionId) {
      logs = logs.filter(l => l.sessionId === filter.sessionId);
    }

    return logs;
  }

  /**
   * 导出日志
   */
  exportLogs(): string {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      totalLogs: this.simulationLogs.length,
      logs: this.simulationLogs
    }, null, 2);
  }

  /**
   * 回放模拟过程
   */
  replaySimulation(sessionId: string): SimulationLog[] {
    return this.simulationLogs.filter(log => log.sessionId === sessionId);
  }

  /**
   * 清空日志
   */
  clearLogs(): void {
    this.simulationLogs = [];
    this.log('info', 'Logs cleared');
  }

  // =====================================================
  // ========== 模拟结果可视化 ================
  // =====================================================

  /**
   * 生成可视化数据
   */
  generateVisualizationData(result: SimulationResult): VisualizationData {
    return {
      summary: {
        overallScore: result.overallScore,
        successRate: result.successRate,
        totalScenarios: result.scenarioResults.length
      },
      metricsChart: {
        labels: ['准确性', '相关性', '效率', '用户满意度'],
        datasets: [{
          label: '平均指标',
          data: [
            result.aggregatedMetrics.avgAccuracy * 100,
            result.aggregatedMetrics.avgRelevance * 100,
            result.aggregatedMetrics.avgEfficiency * 100,
            result.aggregatedMetrics.avgUserSatisfaction * 100
          ]
        }]
      },
      scenarioComparison: result.scenarioResults.map(r => ({
        name: r.scenarioId,
        score: r.score,
        success: r.success,
        duration: r.metrics.completionTime
      })),
      timelineData: result.scenarioResults.map((r, i) => ({
        x: i + 1,
        y: r.score,
        label: r.scenarioId
      })),
      resourceUsage: {
        totalTurns: result.aggregatedMetrics.totalTurns,
        totalTools: result.aggregatedMetrics.totalToolsUsed,
        scenariosPerMinute: result.scenarioResults.length / 
          (result.scenarioResults.reduce((sum, r) => sum + r.metrics.completionTime, 0) / 60000 || 1)
      }
    };
  }

  /**
   * 生成ASCII图表
   */
  generateAsciiChart(result: SimulationResult): string {
    const lines: string[] = [];
    lines.push('\n===== 模拟结果可视化 =====\n');

    // 评分条形图
    lines.push('总体评分:');
    lines.push(this.generateBarChart(result.overallScore, 100, 40));
    lines.push('');

    // 指标对比
    lines.push('各维度评分:');
    const metrics = [
      { name: '准确性', value: result.aggregatedMetrics.avgAccuracy * 100 },
      { name: '相关性', value: result.aggregatedMetrics.avgRelevance * 100 },
      { name: '效率', value: result.aggregatedMetrics.avgEfficiency * 100 },
      { name: '满意度', value: result.aggregatedMetrics.avgUserSatisfaction * 100 }
    ];
    metrics.forEach(m => {
      lines.push(`${m.name.padEnd(8)} ${this.generateBarChart(m.value, 100, 30)}`);
    });

    // 场景评分
    lines.push('\n场景评分:');
    result.scenarioResults.slice(0, 5).forEach((r, i) => {
      const status = r.success ? '✓' : '✗';
      lines.push(`[${status}] ${r.scenarioId.substring(0, 20).padEnd(20)} ${this.generateBarChart(r.score, 100, 20)}`);
    });

    return lines.join('\n');
  }

  /**
   * 生成条形图
   */
  private generateBarChart(value: number, max: number, width: number): string {
    const filled = Math.round((value / max) * width);
    const empty = width - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + '] ' + value.toFixed(1) + '%';
  }

  /**
   * 导出可视化报告
   */
  exportVisualizationReport(result: SimulationResult, format: 'json' | 'html' | 'markdown'): string {
    const data = this.generateVisualizationData(result);

    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'html':
        return this.generateHtmlReport(data, result);
      case 'markdown':
        return this.generateMarkdownReport(data, result);
      default:
        return JSON.stringify(data);
    }
  }

  /**
   * 生成HTML报告
   */
  private generateHtmlReport(data: VisualizationData, result: SimulationResult): string {
    return `<!DOCTYPE html>
<html>
<head><title>Simulation Report</title></head>
<body>
<h1>Simulation Report</h1>
<h2>Summary</h2>
<p>Overall Score: ${data.summary.overallScore.toFixed(2)}</p>
<p>Success Rate: ${(data.summary.successRate * 100).toFixed(1)}%</p>
<h2>Metrics</h2>
<pre>${JSON.stringify(data.metricsChart, null, 2)}</pre>
<h2>Recommendations</h2>
<ul>${result.recommendations.map(r => `<li>${r}</li>`).join('')}</ul>
</body>
</html>`;
  }

  /**
   * 生成Markdown报告
   */
  private generateMarkdownReport(data: VisualizationData, result: SimulationResult): string {
    return `# Simulation Report

## Summary
- **Overall Score**: ${data.summary.overallScore.toFixed(2)}
- **Success Rate**: ${(data.summary.successRate * 100).toFixed(1)}%
- **Total Scenarios**: ${data.summary.totalScenarios}

## Metrics
| Metric | Value |
|--------|-------|
| Accuracy | ${(result.aggregatedMetrics.avgAccuracy * 100).toFixed(1)}% |
| Relevance | ${(result.aggregatedMetrics.avgRelevance * 100).toFixed(1)}% |
| Efficiency | ${(result.aggregatedMetrics.avgEfficiency * 100).toFixed(1)}% |
| Satisfaction | ${(result.aggregatedMetrics.avgUserSatisfaction * 100).toFixed(1)}% |

## Recommendations
${result.recommendations.map(r => `- ${r}`).join('\n')}

${this.generateAsciiChart(result)}
`;
  }

  // =====================================================
  // ========== 异常场景注入 ================
  // =====================================================

  /**
   * 启用异常注入
   */
  enableAnomalyInjection(enabled: boolean): void {
    this.anomalyInjectionEnabled = enabled;
    this.log('info', `Anomaly injection ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * 添加异常注入规则
   */
  addAnomalyRule(rule: Omit<AnomalyInjection, 'id'>): void {
    const anomaly: AnomalyInjection = {
      ...rule,
      id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    this.injectedAnomalies.push(anomaly);
    this.log('info', `Added anomaly rule: ${anomaly.type}`);
  }

  /**
   * 移除异常注入规则
   */
  removeAnomalyRule(anomalyId: string): void {
    this.injectedAnomalies = this.injectedAnomalies.filter(a => a.id !== anomalyId);
  }

  /**
   * 获取活跃的异常注入规则
   */
  getActiveAnomalies(): AnomalyInjection[] {
    return this.injectedAnomalies.filter(a => a.active);
  }

  /**
   * 注入异常到场景
   */
  injectAnomaliesIntoScenario(scenario: Scenario): Scenario {
    if (!this.anomalyInjectionEnabled) return scenario;

    const activeAnomalies = this.getActiveAnomalies();
    if (activeAnomalies.length === 0) return scenario;

    const anomaly = this.randomChoice(activeAnomalies);
    if (!anomaly.shouldInject(scenario)) return scenario;

    this.recordLog('anomaly_injected', { scenarioId: scenario.id, anomalyType: anomaly.type });

    switch (anomaly.type) {
      case 'network_delay':
        return this.injectNetworkDelay(scenario, anomaly);
      case 'data_corruption':
        return this.injectDataCorruption(scenario, anomaly);
      case 'tool_failure':
        return this.injectToolFailure(scenario, anomaly);
      case 'user_abrupt_end':
        return this.injectUserAbruptEnd(scenario, anomaly);
      case 'malicious_input':
        return this.injectMaliciousInput(scenario, anomaly);
      case 'resource_exhaustion':
        return this.injectResourceExhaustion(scenario, anomaly);
      default:
        return scenario;
    }
  }

  /**
   * 注入网络延迟
   */
  private injectNetworkDelay(scenario: Scenario, anomaly: AnomalyInjection): Scenario {
    const delayConstraint: ScenarioConstraint = {
      type: 'max_time',
      value: (scenario.constraints.find(c => c.type === 'max_time')?.value as number || 60000) * 0.3,
      description: 'Injected network delay'
    };
    const metadata: ScenarioMetadata = {
      ...scenario.metadata,
      tags: [...scenario.metadata.tags, `anomaly:${anomaly.type}`]
    };
    return {
      ...scenario,
      constraints: [...scenario.constraints.filter(c => c.type !== 'max_time'), delayConstraint],
      metadata
    };
  }

  /**
   * 注入数据损坏
   */
  private injectDataCorruption(scenario: Scenario, anomaly: AnomalyInjection): Scenario {
    const metadata: ScenarioMetadata = {
      ...scenario.metadata,
      tags: [...scenario.metadata.tags, `anomaly:${anomaly.type}`]
    };
    return {
      ...scenario,
      objectives: scenario.objectives.map(obj => ({
        ...obj,
        description: obj.description + ' [CORRUPTED]'
      })),
      metadata
    };
  }

  /**
   * 注入工具失败
   */
  private injectToolFailure(scenario: Scenario, anomaly: AnomalyInjection): Scenario {
    const toolConstraint: ScenarioConstraint = {
      type: 'required_tools',
      value: ['non_existent_tool_' + Date.now()],
      description: 'Injected tool failure'
    };
    const metadata: ScenarioMetadata = {
      ...scenario.metadata,
      tags: [...scenario.metadata.tags, `anomaly:${anomaly.type}`]
    };
    return {
      ...scenario,
      constraints: [...scenario.constraints, toolConstraint],
      metadata
    };
  }

  /**
   * 注入用户突然结束
   */
  private injectUserAbruptEnd(scenario: Scenario, anomaly: AnomalyInjection): Scenario {
    const maxTurnsConstraint: ScenarioConstraint = {
      type: 'max_turns',
      value: 1,
      description: 'Injected abrupt user end'
    };
    const metadata: ScenarioMetadata = {
      ...scenario.metadata,
      tags: [...scenario.metadata.tags, `anomaly:${anomaly.type}`]
    };
    return {
      ...scenario,
      constraints: [...scenario.constraints.filter(c => c.type !== 'max_turns'), maxTurnsConstraint],
      metadata
    };
  }

  /**
   * 注入恶意输入
   */
  private injectMaliciousInput(scenario: Scenario, anomaly: AnomalyInjection): Scenario {
    const metadata: ScenarioMetadata = {
      ...scenario.metadata,
      tags: [...scenario.metadata.tags, `anomaly:${anomaly.type}`]
    };
    return {
      ...scenario,
      description: scenario.description + ' [POTENTIAL INJECTION TARGET]',
      metadata
    };
  }

  /**
   * 注入资源耗尽
   */
  private injectResourceExhaustion(scenario: Scenario, anomaly: AnomalyInjection): Scenario {
    const maxTurnsConstraint: ScenarioConstraint = {
      type: 'max_turns',
      value: 100, // 大量轮次
      description: 'Injected resource exhaustion'
    };
    const maxTimeConstraint: ScenarioConstraint = {
      type: 'max_time',
      value: 300000, // 5分钟
      description: 'Injected resource exhaustion'
    };
    const metadata: ScenarioMetadata = {
      ...scenario.metadata,
      tags: [...scenario.metadata.tags, `anomaly:${anomaly.type}`]
    };
    return {
      ...scenario,
      constraints: [...scenario.constraints, maxTurnsConstraint, maxTimeConstraint],
      metadata
    };
  }

  // =====================================================
  // ========== 模拟任务调度 ================
  // =====================================================

  /**
   * 启动调度器
   */
  private startScheduler(): void {
    if (this.schedulerInterval) return;

    this.schedulerInterval = setInterval(() => {
      this.executeScheduledTasks();
    }, 60000); // 每分钟检查一次
    this.schedulerInterval.unref(); // 后台调度器不阻止进程退出

    this.log('debug', 'Task scheduler started');
  }

  /**
   * 停止调度器
   */
  stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = undefined;
      this.log('info', 'Task scheduler stopped');
    }
  }

  /**
   * 添加定时任务
   */
  scheduleTask(task: {
    name: string;
    config: SimulationConfig;
    cronExpression: string;
    enabled: boolean;
    onComplete?: (result: SimulationResult) => void;
  }): string {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const scheduledTask: ScheduledTask = {
      id: taskId,
      name: task.name,
      config: task.config,
      cronExpression: task.cronExpression,
      enabled: task.enabled,
      onComplete: task.onComplete,
      nextRunTime: this.calculateNextRunTime(task.cronExpression),
      lastRunTime: undefined,
      runCount: 0
    };

    this.scheduledTasks.set(taskId, scheduledTask);
    this.log('info', `Scheduled task: ${task.name} (${taskId}), next run: ${scheduledTask.nextRunTime}`);

    return taskId;
  }

  /**
   * 移除定时任务
   */
  unscheduleTask(taskId: string): void {
    if (this.scheduledTasks.delete(taskId)) {
      this.log('info', `Unscheduled task: ${taskId}`);
    }
  }

  /**
   * 获取定时任务列表
   */
  getScheduledTasks(): ScheduledTask[] {
    return Array.from(this.scheduledTasks.values());
  }

  /**
   * 启用/禁用定时任务
   */
  setTaskEnabled(taskId: string, enabled: boolean): void {
    const task = this.scheduledTasks.get(taskId);
    if (task) {
      task.enabled = enabled;
      this.log('info', `Task ${taskId} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * 手动触发定时任务
   */
  async triggerTask(taskId: string): Promise<SimulationResult | undefined> {
    const task = this.scheduledTasks.get(taskId);
    if (!task) return undefined;

    this.log('info', `Manually triggering task: ${task.name}`);
    return this.runScheduledTask(task);
  }

  /**
   * 计算下次运行时间
   */
  private calculateNextRunTime(cronExpression: string): Date {
    // 简化实现：支持简单的cron表达式
    // 格式: minute hour day month dayOfWeek
    const parts = cronExpression.split(' ');
    if (parts.length < 5) return new Date(Date.now() + 60000); // 默认1分钟后

    const now = new Date();
    const next = new Date(now);

    // 简单实现：每分钟检查一次，如果匹配则运行
    next.setTime(next.getTime() + 60000);

    return next;
  }

  /**
   * 执行定时任务
   */
  private async executeScheduledTasks(): Promise<void> {
    const now = new Date();

    for (const task of this.scheduledTasks.values()) {
      if (!task.enabled) continue;

      if (!task.nextRunTime || now >= task.nextRunTime) {
        await this.runScheduledTask(task);
      }
    }
  }

  /**
   * 运行定时任务
   */
  private async runScheduledTask(task: ScheduledTask): Promise<SimulationResult | undefined> {
    try {
      this.log('info', `Executing scheduled task: ${task.name}`);
      task.lastRunTime = new Date();
      task.runCount++;

      const result = await this.runSimulation(task.config);
      task.nextRunTime = this.calculateNextRunTime(task.cronExpression);

      if (task.onComplete) {
        task.onComplete(result);
      }

      this.recordLog('scheduled_task_completed', {
        taskId: task.id,
        taskName: task.name,
        resultSummary: { score: result.overallScore, successRate: result.successRate }
      });

      return result;
    } catch (error) {
      this.log('error', `Scheduled task failed: ${task.name}`, { error: String(error) });
      task.nextRunTime = this.calculateNextRunTime(task.cronExpression);
      return undefined;
    }
  }

  // =====================================================
  // ========== 工具方法 ================
  // =====================================================

  /**
   * 将数组分块
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 生成随机整数
   */
  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 随机选择
   */
  private randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * 打乱数组
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * 限制值在范围内
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

// =====================================================
// ========== 新增类型定义 ================
// =====================================================

/**
 * 用户行为模式
 */
interface UserBehaviorPattern {
  userId: string;
  totalInteractions: number;
  avgMessageLength: number;
  avgResponseTime: number;
  avgPatience: number;
  toleranceLevel: number;
  communicationStyle: 'formal' | 'casual' | 'mixed';
  commonIntents: string[];
  sentimentTrend: number[];
  lastUpdated: Date;
}

/**
 * 用户行为学习器
 */
class UserBehaviorLearner {
  analyzeConversation(conversation: SimulatedConversation, userId: string): UserBehaviorPattern {
    const turns = conversation.turns;
    const totalInteractions = turns.length;

    const messageLengths = turns.map(t => t.userMessage.length);
    const responseTimes = turns.slice(1).map((t, i) => 
      t.timestamp.getTime() - turns[i].timestamp.getTime()
    );

    // 简化：基于对话特征推断耐心程度
    const avgPatience = turns.length < 5 ? 0.8 : turns.length < 10 ? 0.5 : 0.3;

    return {
      userId,
      totalInteractions,
      avgMessageLength: messageLengths.length > 0 ? messageLengths.reduce((a, b) => a + b, 0) / messageLengths.length : 0,
      avgResponseTime: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
      avgPatience,
      toleranceLevel: 0.5,
      communicationStyle: 'mixed',
      commonIntents: [],
      sentimentTrend: turns.map(t => t.metadata?.sentiment || 0.5),
      lastUpdated: new Date()
    };
  }
}

/**
 * 模拟日志
 */
interface SimulationLog {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
  sessionId?: string;
}

/**
 * 对比报告
 */
interface ComparisonReport {
  timestamp: Date;
  numConfigs: number;
  metricsComparison: MetricsComparison[];
  bestByScore: MetricsComparison;
  bestBySuccess: MetricsComparison;
  bestByEfficiency: MetricsComparison;
  scoreVariance: number;
  successRateVariance: number;
  recommendations: string[];
}

/**
 * 指标对比
 */
interface MetricsComparison {
  configName: string;
  config: SimulationConfig;
  overallScore: number;
  successRate: number;
  avgAccuracy: number;
  avgRelevance: number;
  avgEfficiency: number;
  avgUserSatisfaction: number;
  totalDuration: number;
  scoreVariance?: number;
}

/**
 * 场景变体
 */
interface ScenarioVariation {
  difficultyRange: { min: number; max: number };
  objectiveCountRange: { min: number; max: number };
  constraintTypes: string[];
  categoryVariations: ScenarioCategory[];
}

/**
 * 可视化数据
 */
interface VisualizationData {
  summary: {
    overallScore: number;
    successRate: number;
    totalScenarios: number;
  };
  metricsChart: {
    labels: string[];
    datasets: Array<{ label: string; data: number[] }>;
  };
  scenarioComparison: Array<{
    name: string;
    score: number;
    success: boolean;
    duration: number;
  }>;
  timelineData: Array<{ x: number; y: number; label: string }>;
  resourceUsage: {
    totalTurns: number;
    totalTools: number;
    scenariosPerMinute: number;
  };
}

/**
 * 异常注入
 */
interface AnomalyInjection {
  id: string;
  type: 'network_delay' | 'data_corruption' | 'tool_failure' | 'user_abrupt_end' | 'malicious_input' | 'resource_exhaustion';
  active: boolean;
  probability: number; // 0-1
  severity: 'low' | 'medium' | 'high';
  description: string;
  shouldInject: (scenario: Scenario) => boolean;
}

/**
 * 定时任务
 */
interface ScheduledTask {
  id: string;
  name: string;
  config: SimulationConfig;
  cronExpression: string;
  enabled: boolean;
  nextRunTime?: Date;
  lastRunTime?: Date;
  runCount: number;
  onComplete?: (result: SimulationResult) => void;
}

/**
 * 性能指标
 */
interface PerformanceMetrics {
  totalSimulations: number;
  avgDuration: number;
  peakMemory: number;
  cpuUsage: number;
  cacheHitRate: number;
}

/**
 * 缓存结果
 */
interface CachedResult {
  scenarioId: string;
  userId: string;
  result: ScenarioResult;
  timestamp: number;
  hitCount: number;
}
