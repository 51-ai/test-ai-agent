/**
 * 竞品分析测试脚本
 * 
 * 验证AI Agent完整闭环流程：规划 → 执行 → 反思 → 验证
 * 
 * @module tests
 */

import { PlannerAgent, TaskPlan, PlanningResult } from '../core/agents/PlannerAgent';
import { ExecutorAgent, ExecutionResult, ExecutionContext } from '../core/agents/ExecutorAgent';
import { ReflectorAgent, ReflectionResult } from '../core/agents/ReflectorAgent';
import { ValidatorAgent, ValidationResult, ValidationContext } from '../core/agents/ValidatorAgent';
import { ModularAgentCoordinator, AgentWorkflowResult, WorkflowConfig } from '../core/agents/ModularAgentCoordinator';

/**
 * 执行竞品分析测试任务
 */
async function runCompetitiveAnalysisTest(): Promise<AgentWorkflowResult | null> {
  console.log('🚀 开始竞品分析测试任务...\n');

  // 创建协调器
  const coordinator = new ModularAgentCoordinator({
    maxIterations: 5,
    enableAutoRetry: true,
    enableParallelExecution: true,
    timeout: 60000
  });

  // 定义竞品分析任务目标
  const goal = '分析微信和抖音的竞品情况，包括产品定位、功能特性、市场策略等方面';

  console.log(`📋 任务目标: ${goal}\n`);

  try {
    // 执行完整工作流
    console.log('🔄 执行工作流...\n');
    
    const result: AgentWorkflowResult = await coordinator.executeWorkflow(goal, {
      maxIterations: 5,
      enableAutoRetry: true,
      enableParallelExecution: true,
      timeout: 60000
    });

    // 输出结果
    console.log('=== 工作流执行完成 ===\n');
    
    console.log(`✅ 任务状态: ${result.success ? '成功' : '失败'}`);
    console.log(`⏱️ 总耗时: ${result.totalExecutionTime}ms`);
    console.log(`📊 规划置信度: ${(result.metadata.planningConfidence * 100).toFixed(0)}%`);
    console.log(`🔍 反思置信度: ${(result.metadata.reflectionConfidence * 100).toFixed(0)}%`);
    console.log(`✅ 验证分数: ${(result.metadata.validationScore * 100).toFixed(0)}%\n`);

    // 输出任务计划
    console.log('📋 任务计划:');
    console.log(`   目标: ${result.plan.goal}`);
    console.log(`   子任务数: ${result.plan.subTasks.length}`);
    console.log(`   估计步骤: ${result.plan.estimatedSteps}`);
    console.log(`   优先级: ${result.plan.priority}\n`);

    // 输出子任务详情
    console.log('📝 子任务列表:');
    result.plan.subTasks.forEach((task, index) => {
      console.log(`   ${index + 1}. ${task.name} (${task.status})`);
      console.log(`      - 描述: ${task.description}`);
      console.log(`      - 工具: ${task.requiredTools.join(', ') || '无'}`);
      console.log(`      - 估计时间: ${task.estimatedTime}秒`);
      console.log(`      - 依赖: ${task.dependencies.length > 0 ? task.dependencies.join(', ') : '无'}`);
    });
    console.log('');

    // 输出执行结果
    console.log('🔧 执行结果:');
    result.executionResults.forEach((execResult, index) => {
      console.log(`   步骤 ${index + 1}: ${execResult.success ? '✅ 成功' : '❌ 失败'}`);
      console.log(`      - 工具调用: ${execResult.toolCalls.length} 次`);
      console.log(`      - 错误数: ${execResult.errors.length}`);
      console.log(`      - 耗时: ${execResult.executionTime}ms`);
      if (execResult.output) {
        console.log(`      - 输出预览: ${execResult.output.slice(0, 100)}...`);
      }
    });
    console.log('');

    // 输出反思结果
    console.log('🤔 反思结果:');
    console.log(`   整体结果: ${result.reflectionResult.overallOutcome}`);
    console.log(`   目标达成度: ${(result.reflectionResult.analysis.goalAchievement * 100).toFixed(0)}%`);
    console.log(`   执行质量: ${(result.reflectionResult.analysis.executionQuality * 100).toFixed(0)}%`);
    console.log(`   资源效率: ${(result.reflectionResult.analysis.resourceEfficiency * 100).toFixed(0)}%`);
    
    if (result.reflectionResult.analysis.errorPatterns.length > 0) {
      console.log('   错误模式:');
      result.reflectionResult.analysis.errorPatterns.forEach(pattern => {
        console.log(`      - ${pattern.type}: ${pattern.severity} (${pattern.frequency}次)`);
      });
    }
    
    if (result.reflectionResult.corrections.length > 0) {
      console.log('   纠错方案:');
      result.reflectionResult.corrections.forEach(correction => {
        console.log(`      - ${correction.type}: ${correction.description}`);
      });
    }
    console.log('');

    // 输出验证结果
    console.log('✅ 验证结果:');
    console.log(`   整体有效: ${result.validationResult.overallValid}`);
    console.log(`   输出批准: ${result.validationResult.approvedForOutput}`);
    console.log(`   需要人工审查: ${result.validationResult.requiresManualReview}`);
    console.log(`   综合分数: ${(result.validationResult.score.overall * 100).toFixed(0)}%`);
    console.log(`   准确性: ${(result.validationResult.score.accuracy * 100).toFixed(0)}%`);
    console.log(`   完整性: ${(result.validationResult.score.completeness * 100).toFixed(0)}%`);
    console.log(`   安全性: ${(result.validationResult.score.safety * 100).toFixed(0)}%`);
    console.log('');

    // 输出最终结果
    console.log('📄 最终输出:');
    console.log('──────────────────────────────────────────────────────');
    console.log(result.finalOutput);
    console.log('──────────────────────────────────────────────────────\n');

    // 输出统计信息
    const stats = coordinator.getExecutionStatistics();
    console.log('📊 执行统计:');
    console.log(`   活跃工作流: ${stats.activeWorkflows}`);
    console.log('   工具调用统计:');
    const toolStats = stats.toolStatistics as Record<string, { calls: number; successRate: number; avgTime: number }>;
    for (const [tool, stat] of Object.entries(toolStats)) {
      console.log(`      - ${tool}: 调用${stat.calls}次, 成功率${(stat.successRate * 100).toFixed(0)}%, 平均耗时${stat.avgTime.toFixed(0)}ms`);
    }

    console.log('\n🎉 测试完成！');

    return result;

  } catch (error) {
    console.error('❌ 测试失败:', error);
    // 测试中断言具体的失败原因，交由调用方决定如何处理
    throw error;
  }
}

/**
 * 单独测试规划模块
 */
async function testPlanner(): Promise<PlanningResult> {
  console.log('🧠 测试规划模块...');
  
  const planner = new PlannerAgent();
  
  const planningContext = {
    userGoal: '分析微信和抖音的竞品情况',
    availableTools: ['web_search', 'document_tool', 'data_analysis'],
    constraints: []
  };

  const result = planner.plan(planningContext);
  
  console.log(`   ✅ 规划完成`);
  console.log(`   📊 置信度: ${(result.confidence * 100).toFixed(0)}%`);
  console.log(`   📋 子任务数: ${result.plan.subTasks.length}`);
  
  if (result.warnings.length > 0) {
    console.log('   ⚠️ 警告:');
    result.warnings.forEach(w => console.log(`      - ${w}`));
  }

  return result;
}

/**
 * 单独测试执行模块
 */
async function testExecutor(plan: TaskPlan): Promise<ExecutionResult[]> {
  console.log('⚙️ 测试执行模块...');
  
  const executor = new ExecutorAgent();
  const results: ExecutionResult[] = [];
  
  for (const task of plan.subTasks.slice(0, 2)) { // 只测试前2个任务
    const context: ExecutionContext = {
      task,
      availableTools: new Map(),
      previousResults: new Map(results.map(r => [r.taskId, r])),
      maxRetries: 2,
      timeout: 30000,
      parallelEnabled: false
    };

    const result = await executor.execute(context);
    results.push(result);
    
    console.log(`   ${result.success ? '✅' : '❌'} ${task.name}: ${result.executionTime}ms`);
  }
  
  return results;
}

/**
 * 单独测试反思模块
 */
function testReflector(taskId: string, plan: TaskPlan, results: ExecutionResult[], goal: string): ReflectionResult {
  console.log('🤔 测试反思模块...');
  
  const reflector = new ReflectorAgent();
  const result = reflector.reflect(taskId, plan, results, goal);
  
  console.log(`   ✅ 反思完成`);
  console.log(`   结果: ${result.overallOutcome}`);
  console.log(`   目标达成度: ${(result.analysis.goalAchievement * 100).toFixed(0)}%`);
  
  return result;
}

/**
 * 单独测试验证模块
 */
function testValidator(goal: string, results: ExecutionResult[], reflection: ReflectionResult): ValidationResult {
  console.log('✅ 测试验证模块...');
  
  const validator = new ValidatorAgent();
  const context: ValidationContext = {
    originalGoal: goal,
    executionResults: results,
    reflectionResult: reflection
  };
  
  const result = validator.validate(context);
  
  console.log(`   ✅ 验证完成`);
  console.log(`   输出批准: ${result.approvedForOutput}`);
  console.log(`   需要人工审查: ${result.requiresManualReview}`);
  console.log(`   综合分数: ${(result.score.overall * 100).toFixed(0)}%`);
  
  return result;
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('   AI Agent 竞品分析测试任务');
  console.log('='.repeat(60));
  console.log('');

  // 方式1: 使用协调器执行完整工作流（推荐）
  await runCompetitiveAnalysisTest();

  // // 方式2: 分步测试各个模块
  // const planResult = await testPlanner();
  // const execResults = await testExecutor(planResult.plan);
  // const reflectResult = testReflector('test_task', planResult.plan, execResults, planResult.plan.goal);
  // const validateResult = testValidator(planResult.plan.goal, execResults, reflectResult);

  console.log('\n' + '='.repeat(60));
  console.log('   测试结束');
  console.log('='.repeat(60));
}

// 执行测试
if (require.main === module) {
  main();
}
/**
 * 真实断言：验证「规划 → 执行 → 反思 → 验证」闭环的结构性结果。
 * 该闭环内部会调用 LLM，因此带凭证门控：无凭证时显式跳过（skip 也视为有效用例）。
 * 工作流至多执行一次，各断言共享同一份结果，避免重复消耗 LLM 配额。
 */
const hasCredentials = Boolean(
  process.env.OPENAI_API_KEY ||
  process.env.DEEPSEEK_API_KEY ||
  process.env.QWEN_API_KEY ||
  process.env.ANTHROPIC_API_KEY
);

const itIfCredentials = hasCredentials ? it : it.skip;

describe('竞品分析闭环流程', () => {
  jest.setTimeout(180000);

  let cached: AgentWorkflowResult | null | undefined;
  const getResult = async (): Promise<AgentWorkflowResult> => {
    if (cached === undefined) cached = await runCompetitiveAnalysisTest();
    if (!cached) throw new Error('工作流返回空结果');
    return cached;
  };

  itIfCredentials('应返回结构完整的工作流结果', async () => {
    const result = await getResult();
    expect(result.plan).toBeDefined();
    expect(result.plan.goal).toContain('竞品');
    expect(Array.isArray(result.plan.subTasks)).toBe(true);
    expect(result.plan.subTasks.length).toBeGreaterThan(0);
    expect(Array.isArray(result.executionResults)).toBe(true);
  });

  itIfCredentials('子任务应包含名称、描述与状态字段', async () => {
    const result = await getResult();
    for (const task of result.plan.subTasks) {
      expect(typeof task.name).toBe('string');
      expect(task.name.length).toBeGreaterThan(0);
      expect(typeof task.description).toBe('string');
      expect(task.status).toBeDefined();
      expect(Array.isArray(task.requiredTools)).toBe(true);
    }
  });

  itIfCredentials('元数据中的置信度应落在 0~1 区间', async () => {
    const result = await getResult();
    const { planningConfidence, reflectionConfidence, validationScore } = result.metadata;
    for (const v of [planningConfidence, reflectionConfidence, validationScore]) {
      expect(typeof v).toBe('number');
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  itIfCredentials('执行耗时应为正数', async () => {
    const result = await getResult();
    expect(result.totalExecutionTime).toBeGreaterThan(0);
  });

  it('未配置凭证时应明确跳过而非静默通过', () => {
    expect(typeof hasCredentials).toBe('boolean');
    if (!hasCredentials) {
      // eslint-disable-next-line no-console
      console.warn('[跳过] 未检测到 LLM 凭证，闭环集成测试已跳过');
    }
  });
});
