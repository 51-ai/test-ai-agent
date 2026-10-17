const { Agent } = require('./dist/core/Agent.js');

const agent = new Agent();

const testQueries = [
  '什么是人工智能？',
  '如何学习编程？',
  '推荐一本好书',
  '你是谁？',
  '我今天很开心',
  '怎么减肥？',
  '什么是Python？',
  '无聊怎么办',
  '压力大怎么办',
  '推荐什么手机好',
  '多少钱才够花',
  '怎么提高记忆力',
  '焦虑怎么办',
  '我觉得学习编程很难',
  '帮我建议建议',
];

console.log('=== AI Agent 测试 ===\n');

async function runTests() {
  for (const query of testQueries) {
    console.log(`\n👤 用户: ${query}`);
    try {
      const response = await agent.processInput(query, 'test-user');
      console.log(`🤖 Agent: ${response.content.substring(0, 200)}${response.content.length > 200 ? '...' : ''}`);
    } catch (error) {
      console.log(`❌ 错误: ${error.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n=== 测试完成 ===');
}

runTests();
