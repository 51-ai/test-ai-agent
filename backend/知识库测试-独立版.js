
// ============================================
// AI Agent 知识库独立测试版
// ============================================

console.log('🧪 知识库测试（独立版）');
console.log('='.repeat(60));
console.log();

// 这是 Agent.ts 中的知识库核心逻辑
function tryAnswerFAQ(input) {
    const lowerInput = input.toLowerCase();
    
    // 🧧 节日/传统
    if (/(什么是|什么叫|解释)(春节|新年)/.test(lowerInput)) {
        return '🧧 春节是中国最重要的节日！全家团圆，放鞭炮，吃年夜饭。';
    }
    
    // 📖 学习/语言
    if (/(怎么|如何|怎样)(学习|学)(英语|外语)/.test(lowerInput)) {
        return '📖 外语学习建议：多背单词、多听多说、看剧听歌、坚持下去！';
    }
    
    // 🎮 娱乐/推荐
    if (/(推荐|有什么|介绍一下|有什么|).*(好看|好听|好玩|电影|音乐|歌曲|游戏|书|书籍)/.test(lowerInput) || /推荐.*电影|推荐一些电影|推荐电影/.test(lowerInput)) {
        if (/电影/.test(lowerInput)) return '🎬 电影推荐：科幻片《星际穿越》、动画电影《寻梦环游记》！';
        if (/音乐|歌曲/.test(lowerInput)) return '🎵 音乐推荐：不同心情听不同类型！';
        if (/游戏/.test(lowerInput)) return '🎮 游戏推荐：注意时间管理！';
        return '🎬 推荐方向：电影、音乐都可以！';
    }
    
    // ✈️ 旅游
    if (/(推荐|有什么|介绍一下)(旅游|旅行|玩|)(的|地方|景点|好玩|)|(哪里|什么地方)(好玩|旅游|旅行)/.test(lowerInput)) {
        return '✈️ 旅游推荐：北京长城故宫、上海现代都市、桂林山水甲天下！';
    }
    
    // 😊 情绪/心理
    if (/(怎么|如何|怎样)(开心|快乐|幸福|调整心情|保持积极|缓解压力|放松)/.test(lowerInput)) {
        return '😊 开心秘诀：感恩小事、运动锻炼、和朋友相处！';
    }
    
    return null;
}

// 测试问题
const questions = [
    '什么是春节？',
    '怎么学英语？',
    '推荐一些电影',
    '如何缓解压力？',
    '推荐一个旅游的地方'
];

// 执行测试
console.log('📋 测试开始...');
console.log();

for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const a = tryAnswerFAQ(q);
    
    console.log(`❓ 问题 ${i + 1}: ${q}`);
    if (a) {
        console.log(`✅ 回答: ${a}`);
    } else {
        console.log(`❌ 没有找到答案`);
    }
    console.log();
}

console.log('='.repeat(60));
console.log('✅ 测试完成！');
console.log('💡 上面有预期回答，说明知识库逻辑没问题！');
console.log('💡 如果服务器上不行，请100%确定重启了服务器！');
console.log();
console.log('🔥 重启步骤：');
console.log('   1. Ctrl + C 停止');
console.log('   2. 删除 dist 文件夹');
console.log('   3. npm run build');
console.log('   4. npm start');
console.log();
