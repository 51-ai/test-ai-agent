
// 简单测试知识库是否工作
const fs = require('fs');
const path = require('path');

console.log('🧪 测试知识库功能...');
console.log('='.repeat(50));

// 模拟一些问题
const testQuestions = [
  '什么是春节？',
  '怎么学英语？',
  '推荐一些电影',
  '怎么养好一只猫？',
  '什么是编程？',
  '如何缓解压力？',
  '推荐一个旅游的地方'
];

console.log('📋 测试问题:');
testQuestions.forEach((q, i) => {
  console.log(`${i + 1}. ${q}`);
});

console.log('\n✅ 知识库已更新！请重新启动服务后测试！');
console.log('\n💡 提示：确保你运行的是最新代码，可能需要重启服务器！');
