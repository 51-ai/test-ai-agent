const { Agent } = require('./dist/core/Agent.js');

const agent = new Agent();

const testQueries = [
  // === 心理/情绪问题 ===
  '无聊怎么办',
  '压力大怎么办',
  '焦虑怎么办',
  '失眠了怎么办',
  '心情不好',
  '坚持不下去怎么办',
  '很迷茫不知道怎么办',
  '紧张怎么办',
  
  // === 学习方法问题 ===
  '怎么学习编程',
  '如何高效学习',
  '记忆力不好怎么办',
  '注意力不集中怎么办',
  '学习方法有哪些',
  
  // === 编程知识 ===
  '什么是Python',
  '什么是JavaScript',
  '什么是算法',
  '什么是变量',
  '编程是什么',
  '什么是数据库',
  '如何开始学习编程',
  
  // === 生活/实用知识 ===
  '怎么减肥',
  '什么是人工智能',
  '你是谁',
  '推荐一下',
];

console.log('=== AI Agent 增强版测试 ===\n');

async function runTests() {
  let successCount = 0;
  
  for (const query of testQueries) {
    console.log(`👤 用户: ${query}`);
    try {
      const response = await agent.processInput(query, 'test-user');
      const answer = response.content;
      
      // 检查是否是有用的回复（不是"遇到问题了"这样的通用回复）
      const isUseful = !answer.includes('遇到问题了') && 
                       !answer.includes('试试说"搜索"') &&
                       answer.length > 30;
      
      if (isUseful) {
        successCount++;
        console.log(`✅ 回答成功 (${answer.substring(0, 60)}...)`);
      } else {
        console.log(`⚠️ 回答 (${answer.substring(0, 60)}...)`);
      }
    } catch (error) {
      console.log(`❌ 错误: ${error.message}`);
    }
    console.log('');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(`\n=== 测试完成：${successCount}/${testQueries.length} 问题获得有用回答 (${Math.round(successCount/testQueries.length*100)}%) ===`);
}

runTests();
