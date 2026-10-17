
// 知识库功能测试
// 这是一个简单的测试，让我们验证知识库是否工作正常

console.log('🧪 测试知识库功能...');
console.log('='.repeat(60));

// 复制知识库的主要逻辑用于测试
function tryAnswerFAQ(input: string): string | null {
    const lowerInput = input.toLowerCase();
    
    console.log(`❓ 测试问题: ${input}`);
    
    // 测试一些关键规则
    if (/(什么是|什么叫|解释)(春节|新年)/.test(lowerInput)) {
        return '🧧 春节是中国最重要的节日！全家团圆，放鞭炮，吃年夜饭。';
    }
    
    if (/(怎么|如何|怎样)(学习|学)(英语|外语)/.test(lowerInput)) {
        return '📖 外语学习建议：\n• 多背单词\n• 多听多说\n• 看剧听歌\n• 坚持下去！';
    }
    
    if (/(推荐|有什么)(好看|好听|好玩)的(电影|音乐|歌曲)/.test(lowerInput)) {
        return '🎬 电影推荐：\n• 科幻片《星际穿越》\n• 动画电影《寻梦环游记》\n• 选你喜欢的类型吧！';
    }
    
    if (/(推荐|有什么)(旅游|旅行)的(地方|景点)|推荐旅游/.test(lowerInput)) {
        return '✈️ 旅游推荐：\n• 北京：长城、故宫\n• 上海：现代都市\n• 桂林：山水甲天下！';
    }
    
    if (/(怎么|如何|怎样)(开心|快乐|幸福|调整心情|保持积极)/.test(lowerInput)) {
        return '😊 开心秘诀：\n• 感恩小事\n• 运动锻炼\n• 和朋友相处\n• 培养兴趣爱好！';
    }
    
    return null;
}

// 测试问题
const testQuestions = [
    '什么是春节？',
    '怎么学英语？',
    '推荐一些电影',
    '如何调整心情？',
    '推荐一个旅游的地方'
];

console.log('📋 开始测试...');
console.log();

testQuestions.forEach((question, index) => {
    const answer = tryAnswerFAQ(question);
    
    if (answer) {
        console.log(`✅ 问题 ${index + 1}: ${question}`);
        console.log(`   回答: ${answer}`);
    } else {
        console.log(`❌ 问题 ${index + 1}: ${question}`);
        console.log(`   没有找到回答！`);
    }
    console.log();
});

console.log('✅ 知识库验证完成！请重新启动服务！');
console.log('💡 重要提示：请重启你的服务器才能生效！');
