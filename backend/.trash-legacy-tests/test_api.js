const http = require('http');

console.log('🧪 测试 AI Agent API');
console.log('='.repeat(60));
console.log();

// 测试函数
function testAPI(message) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      message: message
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/dev/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-developer-key': 'dev-key-2024-secure-token',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// 测试问题
const questions = [
  '什么是春节？',
  '怎么学英语？',
  '推荐一些电影',
  '如何缓解压力？',
  '推荐一个旅游的地方'
];

// 运行测试
(async () => {
  console.log('📡 正在连接服务器...\n');

  try {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      console.log(`❓ 问题 ${i + 1}: ${q}`);

      try {
        const result = await testAPI(q);
        console.log('✅ 回答:', JSON.stringify(result, null, 2));
      } catch (error) {
        console.log('❌ 错误:', error.message);
      }

      console.log();
    }

    console.log('='.repeat(60));
    console.log('✅ 测试完成！');
    console.log();
    console.log('💡 如果上面显示了正确的回答，说明知识库已工作！');
    console.log('💡 如果显示连接错误，请确保服务器已启动！');

  } catch (error) {
    console.log('❌ 连接失败:', error.message);
    console.log();
    console.log('请先启动服务器：');
    console.log('1. cd backend');
    console.log('2. npm start');
  }
})();
