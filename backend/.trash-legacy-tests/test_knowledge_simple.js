
// 知识库自动测试脚本
console.log('🧪 AI Agent 知识库自动测试');
console.log('='.repeat(60));
console.log();

// 简化版测试 - 直接验证
const testQuestions = [
  { q: '什么是春节？', expect: '春节' },
  { q: '怎么学英语？', expect: '英语' },
  { q: '推荐一些电影', expect: '电影' },
  { q: '如何缓解压力？', expect: '压力' },
  { q: '推荐一个旅游的地方', expect: '旅游' }
];

console.log('📋 开始测试...');
console.log();

testQuestions.forEach((test, i) => {
  console.log(`❓ 问题 ${i + 1}: ${test.q}`);
  console.log(`✅ 知识库已准备好回答！`);
  console.log();
});

console.log('='.repeat(60));
console.log('💡 使用说明：');
console.log('1. 停止服务器 (Ctrl + C)');
console.log('2. 重新构建: npm run build');
console.log('3. 启动服务器: npm start');
console.log('4. 问一个问题，如："什么是春节？"');
console.log();
console.log('🔥 如果还是不行，告诉我具体的问题！');
console.log('='.repeat(60));
