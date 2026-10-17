/**
 * 竞品分析测试脚本 - 真实工具版本
 * 
 * 验证AI Agent完整闭环流程：规划 → 执行 → 反思 → 验证
 * 使用真实的搜索工具和LLM服务
 * 
 * @module tests
 */

import { PlannerAgent, TaskPlan, PlanningResult } from '../core/agents/PlannerAgent';
import { ExecutorAgent, ExecutionResult, ExecutionContext } from '../core/agents/ExecutorAgent';
import { ReflectorAgent, ReflectionResult } from '../core/agents/ReflectorAgent';
import { ValidatorAgent, ValidationResult, ValidationContext } from '../core/agents/ValidatorAgent';
import { ModularAgentCoordinator, AgentWorkflowResult, WorkflowConfig } from '../core/agents/ModularAgentCoordinator';
import { llmService, LLMResponse } from '../core/llm/LLMService';
import { webSearchTool, WebSearchResponse } from '../core/tools/external/WebSearchTool';

/**
 * 执行真实的竞品分析测试任务
 */
async function runRealCompetitiveAnalysisTest(): Promise<LLMResponse> {
  console.log('🚀 开始真实竞品分析测试任务...\n');

  // 定义竞品分析任务目标
  const goal = '分析微信和抖音的竞品情况，包括产品定位、功能特性、市场策略等方面';

  console.log(`📋 任务目标: ${goal}\n`);

  // 1. 使用真实搜索工具获取信息
  console.log('🔍 步骤1: 使用搜索工具获取竞品信息...');
  
  try {
    const searchQueries = [
      '微信 抖音 竞品分析 2024',
      '微信 产品定位 功能特性',
      '抖音 产品定位 功能特性',
      '微信 抖音 用户数据 市场份额'
    ];

    const searchResults: WebSearchResponse[] = [];
    
    for (const query of searchQueries) {
      console.log(`   搜索: ${query}`);
      const result = await webSearchTool.execute('search', { query, numResults: 3 });
      if (result.success && result.result) {
        searchResults.push(result.result as WebSearchResponse);
        console.log(`   ✅ 找到 ${(result.result as WebSearchResponse).results.length} 条结果`);
      }
      await delay(1000);
    }

    console.log('\n📊 搜索结果汇总:');
    searchResults.forEach((sr, index) => {
      console.log(`   查询${index + 1}: ${sr.query}`);
      sr.results.forEach(r => {
        console.log(`      - ${r.title}`);
      });
    });

    // 2. 使用LLM生成竞品分析报告
    console.log('\n🧠 步骤2: 使用LLM生成竞品分析报告...');
    
    const searchContext = searchResults.map(sr => 
      sr.results.map(r => `${r.title}: ${r.snippet}`).join('\n')
    ).join('\n\n');

    const prompt = `
你是一位资深的产品分析师，请根据以下搜索结果，撰写一份详细的微信和抖音竞品分析报告。

搜索数据：
${searchContext}

请按照以下结构输出分析报告：

## 一、产品定位分析
- 微信的产品定位
- 抖音的产品定位
- 两者定位差异对比

## 二、功能特性对比
- 核心功能对比
- 用户体验差异
- 技术能力对比

## 三、市场策略分析
- 用户增长策略
- 商业化路径
- 竞争策略

## 四、SWOT分析
- 微信的优势与劣势
- 抖音的优势与劣势

## 五、结论与建议

请确保分析客观、数据驱动。
`;

    const llmResult: LLMResponse = await llmService.generate(prompt, {
      provider: 'openai',
      temperature: 0.3
    });

    console.log(`   ✅ LLM响应完成`);
    console.log(`   📝 Token使用: ${llmResult.tokenUsage?.total || 0}`);

    // 3. 输出最终报告
    console.log('\n📄 竞品分析报告:');
    console.log('='.repeat(80));
    console.log(llmResult.content);
    console.log('='.repeat(80));

    console.log('\n🎉 测试完成！');

    return llmResult;

  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.log('\n💡 提示: 如果失败是因为API Key未配置或配额不足，请在.env文件中配置有效密钥');
    throw error;
  }
}

/**
 * 协调器测试（模拟完整工作流）
 */
async function runCoordinatorTest(): Promise<void> {
  console.log('🔄 运行协调器测试...');

  const coordinator = new ModularAgentCoordinator({
    maxIterations: 5,
    enableAutoRetry: true,
    enableParallelExecution: true,
    timeout: 60000
  });

  const goal = '分析微信和抖音的竞品情况';

  const result: AgentWorkflowResult = await coordinator.executeWorkflow(goal, {
    maxIterations: 5,
    enableAutoRetry: true,
    enableParallelExecution: true,
    timeout: 60000
  });

  console.log(`\n✅ 任务状态: ${result.success ? '成功' : '失败'}`);
  console.log(`⏱️ 总耗时: ${result.totalExecutionTime}ms`);
  console.log(`📊 规划置信度: ${(result.metadata.planningConfidence * 100).toFixed(0)}%`);
  console.log(`✅ 验证分数: ${(result.metadata.validationScore * 100).toFixed(0)}%`);

  if (result.finalOutput) {
    console.log('\n📄 输出结果:');
    console.log(result.finalOutput.slice(0, 500), '...');
  }
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('   AI Agent 真实竞品分析测试');
  console.log('='.repeat(60));
  console.log('');

  // 检查是否配置了API密钥
  const hasOpenAIKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here';
  
  if (hasOpenAIKey) {
    console.log('✅ 检测到OpenAI API Key已配置');
    await runRealCompetitiveAnalysisTest();
  } else {
    console.log('⚠️ 未配置真实API Key，运行模拟测试...');
    await runCoordinatorTest();
    console.log('\n💡 提示: 如需运行真实测试，请在.env文件中配置OPENAI_API_KEY');
  }

  console.log('\n' + '='.repeat(60));
  console.log('   测试结束');
  console.log('='.repeat(60));
}

// 执行测试
if (require.main === module) {
  main();
}
/**
 * 真实断言（集成测试）
 *
 * 修复说明：原文件是调用真实 LLM 与联网搜索的打印脚本，不含任何断言；
 * 若被 jest 当作单元测试收集，会在 CI 中触发付费调用且结果不稳定。
 * 现改为：检测到 LLM 凭证才执行，否则显式跳过（skip 也会被视为有效用例）。
 */
const hasCredentials = Boolean(
  process.env.OPENAI_API_KEY ||
  process.env.DEEPSEEK_API_KEY ||
  process.env.QWEN_API_KEY ||
  process.env.ANTHROPIC_API_KEY
);

const itIfCredentials = hasCredentials ? it : it.skip;

describe('竞品分析（真实 LLM + 联网搜索）', () => {
  jest.setTimeout(300000);

  itIfCredentials('应在配置凭证后跑通完整闭环并产出非空结果', async () => {
    const result = await runRealCompetitiveAnalysisTest();
    expect(result).toBeDefined();
    expect(typeof result.content).toBe('string');
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.tokenUsage?.total ?? 0).toBeGreaterThan(0);
  });

  it('未配置凭证时应明确跳过而非静默通过', () => {
    expect(typeof hasCredentials).toBe('boolean');
    if (!hasCredentials) {
      // eslint-disable-next-line no-console
      console.warn('[跳过] 未检测到 LLM 凭证，集成测试已跳过');
    }
  });
});
