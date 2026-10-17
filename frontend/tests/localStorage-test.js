/**
 * LocalStorage 持久化测试 - Node.js 版本
 * 测试 localStorage 模拟器的各种场景
 */

// 模拟 localStorage
class MockLocalStorage {
  constructor() {
    this.store = {};
  }

  setItem(key, value) {
    if (value.length > 5 * 1024 * 1024) {
      throw new Error('QuotaExceededError: DOM Exception 22');
    }
    this.store[key] = value;
  }

  getItem(key) {
    return this.store[key] || null;
  }

  removeItem(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }
}

// 模拟的 window 对象
const mockWindow = {
  localStorage: new MockLocalStorage()
};

// 测试工具函数
const STORAGE_KEY_PREFIX = 'dev_dashboard_';
const CURRENT_VERSION = 2;

function saveToStorage(key, data) {
  try {
    mockWindow.localStorage.setItem(
      STORAGE_KEY_PREFIX + key,
      JSON.stringify(data)
    );
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function loadFromStorage(key, defaultValue = null) {
  try {
    const stored = mockWindow.localStorage.getItem(STORAGE_KEY_PREFIX + key);
    if (stored === null) return defaultValue;

    const parsed = JSON.parse(stored);

    // 检查版本兼容性
    if (parsed && parsed._version !== undefined && parsed._version !== CURRENT_VERSION) {
      console.warn(`⚠️ 数据版本不匹配: 存储=${parsed._version}, 当前=${CURRENT_VERSION}`);
      return defaultValue;
    }

    return parsed;
  } catch (e) {
    console.error(`❌ 加载失败: ${e.message}`);
    return defaultValue;
  }
}

// 测试计数器
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 测试: ${name}`);
  console.log('='.repeat(60));

  // 每次测试前清空存储
  mockWindow.localStorage.clear();

  try {
    const result = fn();
    if (result.pass) {
      passedTests++;
      console.log(`\n✅ 通过: ${result.message}`);
    } else {
      failedTests++;
      console.log(`\n❌ 失败: ${result.message}`);
    }
  } catch (e) {
    failedTests++;
    console.log(`\n❌ 异常: ${e.message}`);
  }
}

// ==================== 测试用例 ====================

console.log('\n🎯 LocalStorage 持久化测试套件');
console.log('='.repeat(60));

// 测试 1: 基本保存和读取
test('基本保存和读取', () => {
  const testData = {
    _version: CURRENT_VERSION,
    message: 'Hello World',
    number: 42
  };

  const saveResult = saveToStorage('test', testData);
  if (!saveResult.success) {
    return { pass: false, message: `保存失败: ${saveResult.error}` };
  }

  const loaded = loadFromStorage('test', {});
  const pass = loaded.message === 'Hello World' && loaded.number === 42;

  return {
    pass,
    message: `
保存数据: ${JSON.stringify(testData)}
读取数据: ${JSON.stringify(loaded)}
数据一致: ${pass ? '✅ 是' : '❌ 否'}
`
  };
});

// 测试 2: 数据持久化模拟刷新
test('数据持久化 (模拟页面刷新)', () => {
  const responses = [
    { role: 'user', content: '测试消息', time: Date.now() },
    { role: 'assistant', content: '助手回复', time: Date.now() }
  ];

  saveToStorage('chat_responses', responses);

  // 模拟刷新 - 重新加载
  const freshResponses = loadFromStorage('chat_responses', []);

  const pass = freshResponses.length === 2;
  return {
    pass,
    message: `
刷新前数据: ${responses.length} 条
刷新后数据: ${freshResponses.length} 条
完整性: ${pass ? '✅ 完整' : '❌ 数据丢失'}
`
  };
});

// 测试 3: JSON 解析失败
test('JSON 解析失败 (数据损坏)', () => {
  // 模拟损坏的数据
  mockWindow.localStorage.setItem(
    STORAGE_KEY_PREFIX + 'test',
    '{ "broken: json'
  );

  const loaded = loadFromStorage('test', { fallback: true });
  const pass = loaded.fallback === true;

  return {
    pass,
    message: `
损坏数据: '{ "broken: json'
加载结果: ${JSON.stringify(loaded)}
回退到默认值: ${pass ? '✅ 是' : '❌ 否'}

💡 这正是导致"突然初始化"的罪魁祸首！
   当 localStorage 中的数据损坏时，没有正确处理就会导致数据丢失。
`
  };
});

// 测试 4: 版本不兼容
test('版本不兼容 (版本升级)', () => {
  // 模拟旧版本数据
  const oldData = {
    _version: 1, // 旧版本
    messages: [{ text: '旧格式' }]
  };
  mockWindow.localStorage.setItem(
    STORAGE_KEY_PREFIX + 'test',
    JSON.stringify(oldData)
  );

  const loaded = loadFromStorage('test', []);

  // 如果版本不匹配，应该返回默认值
  const pass = !loaded.messages; // 旧格式不应该存在

  return {
    pass,
    message: `
旧版本数据: ${JSON.stringify(oldData)}
加载结果: ${JSON.stringify(loaded)}
触发版本迁移: ${pass ? '✅ 是' : '❌ 否'}

💡 这也可能导致"突然初始化"！
   当代码升级后，旧版本的数据格式不兼容，
   如果没有正确处理版本迁移，就会重置为默认状态。
`
  };
});

// 测试 5: 空值处理
test('空值处理 (null/undefined)', () => {
  const testCases = [
    { input: null, desc: 'null' },
    { input: undefined, desc: 'undefined' },
    { input: '', desc: '空字符串' }
  ];

  let allPassed = true;
  const results = [];

  for (const tc of testCases) {
    mockWindow.localStorage.removeItem(STORAGE_KEY_PREFIX + 'test');
    mockWindow.localStorage.setItem(
      STORAGE_KEY_PREFIX + 'test',
      JSON.stringify(tc.input)
    );
    const loaded = loadFromStorage('test', 'DEFAULT');
    const passed = JSON.stringify(loaded) !== '"DEFAULT"';
    allPassed = allPassed && passed;
    results.push(`${tc.desc}: ${passed ? '✅' : '❌'}`);
  }

  return {
    pass: allPassed,
    message: `
测试结果: ${results.join(', ')}
全部通过: ${allPassed ? '✅ 是' : '❌ 否'}
`
  };
});

// 测试 6: 存储配额超限
test('存储配额超限', () => {
  let overflow = false;
  let errorType = '';

  try {
    // 尝试存储约 6MB 数据
    const largeData = 'x'.repeat(6 * 1024 * 1024);
    mockWindow.localStorage.setItem(
      STORAGE_KEY_PREFIX + 'large',
      largeData
    );
  } catch (e) {
    overflow = true;
    errorType = e.name;
  }

  const pass = overflow && errorType === 'Error';

  return {
    pass,
    message: `
触发溢出: ${overflow ? '✅ 是' : '❌ 否'}
错误类型: ${errorType}
处理正确: ${pass ? '✅ 是' : '❌ 否'}

💡 如果存储空间不足，可能会导致保存失败，
   但不应该导致整个应用崩溃。
`
  };
});

// 测试 7: 复杂数据结构
test('复杂数据结构 (模拟 DeveloperDashboard)', () => {
  const complexData = {
    _version: CURRENT_VERSION,
    chat_responses: [
      { role: 'user', content: '```python\nprint("hello")\n```', time: Date.now() },
      { role: 'assistant', content: '代码执行结果: hello', time: Date.now() }
    ],
    rl_metrics: Array.from({ length: 100 }, (_, i) => ({
      episode: i,
      reward: Math.random() * 100,
      loss: Math.random()
    })),
    rag_docs: Array.from({ length: 50 }, (_, i) => ({
      id: i,
      title: `文档 ${i}`,
      content: '内容...'.repeat(10)
    }))
  };

  const saveResult = saveToStorage('complex', complexData);
  if (!saveResult.success) {
    return { pass: false, message: `保存失败: ${saveResult.error}` };
  }

  const loaded = loadFromStorage('complex', null);
  const pass =
    loaded &&
    loaded.chat_responses.length === 2 &&
    loaded.rl_metrics.length === 100 &&
    loaded.rag_docs.length === 50;

  return {
    pass,
    message: `
数据包含:
  - 对话: ${loaded?.chat_responses?.length || 0} 条
  - RL指标: ${loaded?.rl_metrics?.length || 0} 条
  - 文档: ${loaded?.rag_docs?.length || 0} 条
全部正确: ${pass ? '✅ 是' : '❌ 否'}
`
  };
});

// 测试 8: 模拟 DeveloperDashboard 的问题场景
test('【关键】模拟 DeveloperDashboard 数据丢失', () => {
  // 场景: 用户编辑了数据，但页面刷新后数据丢失

  console.log('\n  模拟步骤:');
  console.log('  1. 用户在 DeveloperDashboard 中输入了一些对话...');

  const responses = [
    { role: 'user', content: '这是我刚输入的重要测试数据', time: Date.now() - 1000 },
    { role: 'assistant', content: '好的，我记住了', time: Date.now() }
  ];

  console.log('  2. 保存到 localStorage...');
  const saveResult = saveToStorage('chat_responses', responses);
  console.log(`     保存结果: ${saveResult.success ? '✅ 成功' : '❌ 失败'}`);

  console.log('  3. 模拟页面刷新...');

  // 模拟刷新后加载
  const freshResponses = loadFromStorage('chat_responses', []);

  console.log(`  4. 刷新后数据: ${freshResponses.length} 条`);

  // 检查是否有数据损坏的痕迹
  const hasDataLoss = freshResponses.length === 0 && responses.length > 0;
  const dataComplete = freshResponses.length === responses.length;

  return {
    pass: dataComplete,
    message: `
原始数据: ${responses.length} 条
刷新后: ${freshResponses.length} 条
数据完整: ${dataComplete ? '✅ 是' : '❌ 否'}
数据丢失: ${hasDataLoss ? '⚠️ 是!' : '❌ 否'}

${hasDataLoss ? '❌ 发现问题! 数据在刷新后丢失了!' : '✅ 测试通过'}
`
  };
});

// ==================== 测试结果汇总 ====================

console.log('\n');
console.log('='.repeat(60));
console.log('📊 测试结果汇总');
console.log('='.repeat(60));
console.log(`总测试数: ${totalTests}`);
console.log(`通过: ${passedTests} ✅`);
console.log(`失败: ${failedTests} ❌`);
console.log('='.repeat(60));

if (failedTests > 0) {
  console.log('\n⚠️  发现问题! 以下场景可能导致数据丢失:');
  console.log('  1. JSON 数据损坏');
  console.log('  2. 版本不兼容');
  console.log('  3. localStorage 被意外清除');
  console.log('  4. 存储配额超限');
  console.log('\n💡 建议检查 DeveloperDashboard 的 localStorage 处理逻辑');
}

console.log('\n🎯 建议: 在 DeveloperDashboard 中增强错误处理:');
console.log(`
  1. 添加 try-catch 捕获所有 JSON.parse 异常
  2. 添加版本号，支持数据迁移
  3. 添加 localStorage 容量检测
  4. 添加数据完整性校验
`);
