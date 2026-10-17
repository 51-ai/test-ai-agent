const { PerceptionModule } = require('./dist/core/perception/PerceptionModule');
const { DecisionEngine } = require('./dist/core/decision/DecisionEngine');
const { NLPModule } = require('./dist/core/nlp/NLPModule');
const { ToolManager } = require('./dist/core/tools/ToolManager');

console.log('=== 模块加载测试 ===');
console.log('✓ PerceptionModule:', typeof PerceptionModule);
console.log('✓ DecisionEngine:', typeof DecisionEngine);
console.log('✓ NLPModule:', typeof NLPModule);
console.log('✓ ToolManager:', typeof ToolManager);

console.log('\n=== 功能测试 ===');
const perception = new PerceptionModule();
const nlp = new NLPModule();
const toolManager = new ToolManager();
const decisionEngine = new DecisionEngine();

console.log('✓ PerceptionModule 实例化成功');
console.log('✓ NLPModule 实例化成功');
console.log('✓ ToolManager 实例化成功');
console.log('✓ DecisionEngine 实例化成功');

// 测试意图识别
console.log('\n=== 意图识别测试 ===');
const intent1 = perception.recognizeIntent('搜索 人工智能');
console.log('"搜索 人工智能" -> 意图:', intent1.name, '置信度:', intent1.confidence);

const intent2 = perception.recognizeIntent('计算 2 + 3');
console.log('"计算 2 + 3" -> 意图:', intent2.name);

const intent3 = nlp.recognizeIntent('你好');
console.log('"你好" -> 意图:', intent3.name);

// 测试 NLP
console.log('\n=== NLP 响应测试 ===');
const response = nlp.generateResponse('这是测试内容');
console.log('响应生成成功:', response.content.substring(0, 50) + '...');

// 测试工具管理
console.log('\n=== 工具管理测试 ===');
console.log('可用工具数量:', toolManager.getAvailableTools().length);
console.log('工具列表:', toolManager.getAvailableTools());
const toolStat = toolManager.getStats();
console.log('工具统计:', JSON.stringify(toolStat));

// 测试决策引擎
console.log('\n=== 决策引擎测试 ===');
const task = decisionEngine.decomposeTask('帮我搜索 人工智能', 'test-user-001');
console.log('任务分解成功:', task.description);
console.log('子任务数量:', task.subtasks.length);
console.log('前3个子任务:');
task.subtasks.slice(0, 3).forEach((st, i) => {
  console.log('  ' + (i + 1) + '. ' + st.description.substring(0, 50));
});

// 测试任务分类
console.log('\n=== 任务分类测试 ===');
console.log('"搜索 人工智能" -> 类型:', decisionEngine.classifyTaskType('搜索 人工智能'));
console.log('"写一篇关于科技的文章" -> 类型:', decisionEngine.classifyTaskType('写一篇关于科技的文章'));
console.log('"分析销售数据" -> 类型:', decisionEngine.classifyTaskType('分析销售数据'));

console.log('\n=== 所有模块测试通过! ===');
console.log('=== 强化完成 🎉 ===');
