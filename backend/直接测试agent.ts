
// 直接测试 Agent 知识库
console.log('🧪 直接测试 AI Agent 知识库');
console.log('='.repeat(60));
console.log();

// 导入 Agent（我们直接用核心代码测试）
import { Agent } from './src/core/Agent';

const testAgent = new Agent();

// 测试问题
const testQuestions = [
  '什么是春节？',
  '怎么学英语？',
  '推荐一些电影',
  '如何缓解压力？',
  '推荐一个旅游的地方'
];

console.log('📋 开始测试 Agent 知识库...');
console.log();

// 异步运行测试
(async () => {
  for (let i = 0; i < testQuestions.length; i++) {
    const question = testQuestions[i];
    console.log(`❓ 问题 ${i + 1}: ${question}`);
    
    try {
      const response = await testAgent.processInput(question, 'test-user');
      console.log(`✅ 回答: ${response.content}`);
    } catch (error) {
      console.log(`❌ 错误: ${error}`);
    }
    
    console.log();
  }
  
  console.log('='.repeat(60));
  console.log('✅ 测试完成！');
  console.log('💡 如果上面有预期的回答，说明知识库代码没问题！');
  console.log('💡 问题可能是服务器没有重启！');
  console.log();
})();
