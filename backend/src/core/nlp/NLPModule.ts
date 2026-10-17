import { Intent, Entity, Emotion, AgentResponse } from '../../types';

const LOG_PREFIX = '[NLPModule]';

// === 增强：5级情感强度分类 ===
export type EmotionIntensity = 'strong_positive' | 'weak_positive' | 'neutral' | 'weak_negative' | 'strong_negative';

export interface DetailedEmotion {
  type: Emotion['type'];
  confidence: number;
  intensity: EmotionIntensity;
  intensityScore: number;  // 0-1
  keywords: string[];
  recommendedStrategy: 'celebrate' | 'encourage' | 'neutral' | 'empathize' | 'deescalate';
}

export class NLPModule {
  // 增强的意图识别模式（支持多语言）
  private intentPatterns: Record<string, RegExp[]> = {
    // 领域意图（weather/time 等）必须排在 search 之前，否则 "what is the weather" 会被
    // search 的 "what is" 宽泛正则抢先误判为搜索意图
    weather: [
      /(天气|下雨|晴天|温度|weather|temperature|climate|几度|多少度|下雨吗|冷不冷|热不热)/i,
    ],
    search: [
      /(搜索|查找|查询|find|search|look up|查一下|搜索一下)/i,
      /(什么是|是什么|什么叫|who is|what is|where is|how is)/i,
    ],
    calculate: [
      /(计算|算|计算一下|等于多少|结果是|calculate|compute|math|数学)/i,
      /\d+\s*[\+\-\*\/\×\÷]\s*\d+/i,
    ],
    summarize: [
      /(总结|概括|摘要|summarize|summary|概括一下|总结一下|概述|提炼)/i,
    ],
    translate: [
      /(翻译|translate|译成|翻译成|翻译一下|translate to|转换成)/i,
    ],
    execute_code: [
      /(运行|执行|run|execute).*(代码|code|python|javascript|脚本|script)/i,
    ],
    task_create: [
      /(创建任务|新建任务|create task|task|待办|todo|添加任务|新任务)/i,
    ],
    help: [
      /^(帮助|help|帮助我|怎么用|如何用|how to|功能说明|使用说明)/i,
    ],
    greeting: [
      /^(你好|hi|hello|您好|早上好|下午好|晚上好|嗨|hey|hello there|こんにちは)/i,
    ],
    goodbye: [
      /^(再见|bye|拜拜|下次见|see you|goodbye|回见|88|晚安|goodbye)/i,
    ],
    time: [
      /(几点|时间|现在|什么时候|today|tomorrow|日期|今天|明天|昨天|几号)/i,
    ],
    joke: [
      /(讲个笑话|笑话|joke|funny|幽默|说个笑话|讲个段子)/i,
    ],
    compliment: [
      /(你好棒|厉害|优秀|聪明|真棒|great|excellent|smart|perfect|awesome|太厉害了|真厉害|太棒了|你真行)/i,
    ],
    complain: [
      /(不行|太差|不好|抱怨|complain|bad|terrible|太慢了|不行啊|有问题|不满意|不太行)/i,
    ],
    write: [
      /(写|写作|write|撰写|创作|写文章|写邮件|写封信|写首诗|写个文案|写个稿子)/i,
    ],
    // 澄清请求需排在 explain 之前："Can you explain again? I don't understand" 同时命中
    // 两者，语义上是要求换个说法（clarify）而非首次解释（explain）
    clarify: [
      /(不理解|不明白|没听懂|再讲一遍|再说明一下|解释清楚|clarify|再解释一遍|什么意思|不太懂|听不懂|没明白|没搞懂|再说一遍|don.t understand|do not understand|not understanding|can.t understand|come again|once more)/i,
    ],
    explain: [
      /(解释|说明|explain|解释一下|说明一下|解释一下什么是|讲讲|解析|解读)/i,
    ],
    analyze: [
      /(分析|analyze|研究|分析一下|研究一下|analyze|评估|review)/i,
    ],
    debug: [
      /(调试|debug|修复|fix|错误|bug|出问题了|有问题|排查|solve)/i,
    ],
    question: [
      /(？|\?|为什么|怎么|如何|怎样|how|why|who|where|what|which)/i,
    ],
    emotion_positive: [
      /(开心|高兴|兴奋|愉快|快乐|happy|joyful|excited|好开心|太好了|太棒了|高兴坏了|满足|幸福)/i,
    ],
    emotion_negative: [
      /(难过|伤心|生气|愤怒|焦虑|压力大|很累|sad|angry|anxious|tired|stressed|不开心|郁闷|失望|害怕|恐惧|担心|烦|烦躁)/i,
    ],
    learn: [
      /(学习|learn|教程|tutorial|教我|怎么学|如何学习|学一下|入门|学习方法)/i,
    ],
    optimize: [
      /(优化|optimize|改进|improve|提升|性能优化|优化一下|优化代码)/i,
    ],
    plan: [
      /(计划|规划|plan|制定计划|做计划|安排|planning)/i,
    ],
    introduction: [
      /^(你是谁|你是什么|介绍一下你自己|who are you)/i,
    ],
  };

  private entityPatterns: Record<string, RegExp> = {
    url: /https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/gi,
    email: /[\w.-]+@[\w.-]+\.\w+/gi,
    date: /(\d{4}[-/]年?\d{1,2}[-/]月?\d{1,2}(日|号)?|\d{1,2}[-/]月?\d{1,2}(日|号)?|\d{4}[-/]\d{1,2})/g,
    number: /\b\d+(?:\.\d+)?\b/g,
    location: /(北京|上海|广州|深圳|杭州|成都|重庆|武汉|南京|西安|苏州|天津|Tokyo|London|Paris|New York|Berlin|Seoul|Osaka|Beijing|Shanghai|Shenzhen)/gi,
    phone: /(1[3-9]\d{9}|(\d{3,4}-)?\d{7,8})/g,
    person: /(先生|女士|老师|医生|教授|工程师|设计师|产品经理|CEO|CTO|CFO|COO|总裁|总经理|经理|总监)/g,
    time: /(\d{1,2}[::]\d{2}(?:[::]\d{2})?|上午|下午|早上|晚上|中午|凌晨)/g,
    money: /(\d+(?:\.\d+)?\s*[元块钱美元欧元日元]|[$€£¥]\d+(?:\.\d+)?)/gi,
    programming_language: /(Python|JavaScript|Java|TypeScript|Go|Golang|Rust|C\+\+|C#|PHP|Ruby|Swift|Kotlin|SQL|HTML|CSS|Node\.js|React|Vue|Angular)/gi,
    file: /\b\w+\.(txt|pdf|doc|docx|xls|xlsx|csv|json|xml|html|css|js|py|java|go|rs|ts|tsx|jsx|md|png|jpg|jpeg|gif|zip|rar)/gi,
    tech_topic: /(人工智能|AI|机器学习|深度学习|区块链|云计算|大数据|物联网|5G|VR|AR|元宇宙|神经网络|算法|数据|框架|架构|微服务|API|接口)/gi,
  };

  private positiveWords = ['好', '棒', '优秀', '开心', '高兴', '喜欢', '爱',
    'wonderful', 'great', 'good', 'happy', 'love', 'excellent', 'amazing',
    '愉快', '快乐', '兴奋', '满足', '感激', '感谢', '赞', '真棒',
    'perfect', 'awesome', 'fantastic', 'brilliant', 'superb', 'nice',
    '满意', '幸福', '舒服', '有趣', '精彩', '不错', '可以', '解决', '成功'];
  private negativeWords = ['坏', '差', '糟糕', '难过', '伤心', '讨厌', '恨',
    'bad', 'terrible', 'sad', 'hate', 'awful', 'horrible',
    '失望', '生气', '愤怒', '痛苦', '烦恼', '郁闷', '恶心',
    'horrible', 'disgusting', 'awful', 'terrible', 'disappointed', 'angry',
    '压力', '焦虑', '累', '疲惫', '不行', '失败', '错误', '问题',
    '不开心', '沮丧', '担心', '害怕', '恐惧'];

  private emotionAdjustmentFactors = {
    very: 1.5,  // 非常、很、特别
    slightly: 0.7, // 稍微、有点
    not: -0.8,  // 不
  };

  recognizeIntent(text: string): Intent {
    const lowerText = text.toLowerCase();

    // 先检查精确匹配的意图（优先级较高）
    const highPriorityIntents = ['greeting', 'goodbye', 'help', 'introduction', 'compliment', 'complain'];

    for (const intentName of highPriorityIntents) {
      const patterns = this.intentPatterns[intentName];
      if (patterns && patterns.some(p => p.test(text))) {
        return {
          name: intentName,
          confidence: 0.9,
          entities: this.extractEntities(text)
        };
      }
    }

    // 检查其他意图
    for (const [intentName, patterns] of Object.entries(this.intentPatterns)) {
      if (highPriorityIntents.includes(intentName)) continue;

      if (patterns.some(p => p.test(text))) {
        return {
          name: intentName,
          confidence: 0.85,
          entities: this.extractEntities(text)
        };
      }
    }

    return {
      name: 'unknown',
      confidence: 0.3,
      entities: this.extractEntities(text)
    };
  }

  extractEntities(text: string): Entity[] {
    const entities: Entity[] = [];

    for (const [entityName, pattern] of Object.entries(this.entityPatterns)) {
      const matches = text.match(pattern);
      if (matches) {
        // 避免重复添加相同的实体
        const seen = new Set<string>();
        for (const value of matches) {
          if (!seen.has(value.toLowerCase())) {
            seen.add(value.toLowerCase());
            entities.push({
              name: entityName,
              value: value.trim(),
              confidence: entityName === 'url' || entityName === 'email' ? 0.98 : 0.85
            });
          }
        }
      }
    }

    return entities;
  }

  analyzeEmotion(text: string): Emotion {
    const lowerText = text.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;

    // 检查强化词（非常、很、特别、不、有点等）
    let multiplier = 1.0;
    const amplifiers = ['非常', '特别', '超级', '真的', '真', '很', '太', 'so', 'very', 'really', 'extremely'];
    for (const amp of amplifiers) {
      if (lowerText.includes(amp)) {
        multiplier = 1.5;
      }
    }
    const negators = ['不', '没', '没有', 'not', "don't", 'never'];
    for (const neg of negators) {
      if (lowerText.includes(neg)) {
        multiplier *= -0.8;
      }
    }

    for (const word of this.positiveWords) {
      if (lowerText.includes(word.toLowerCase())) {
        positiveCount++;
      }
    }

    for (const word of this.negativeWords) {
      if (lowerText.includes(word.toLowerCase())) {
        negativeCount++;
      }
    }

    const total = positiveCount + negativeCount;

    if (total === 0) {
      return { type: 'neutral', confidence: 0.65 };
    }

    const adjustedPositive = positiveCount * multiplier;
    const adjustedNegative = negativeCount * multiplier;

    if (adjustedPositive > adjustedNegative) {
      return {
        type: 'positive',
        confidence: Math.min(Math.abs(adjustedPositive / total), 0.95)
      };
    } else if (adjustedNegative > adjustedPositive) {
      return {
        type: 'negative',
        confidence: Math.min(Math.abs(adjustedNegative / total), 0.95)
      };
    }

    return { type: 'neutral', confidence: 0.55 };
  }

  /**
   * 增强版情感分析：5级强度分级
   * strong_positive / weak_positive / neutral / weak_negative / strong_negative
   */
  analyzeEmotionDetailed(text: string): DetailedEmotion {
    const lowerText = text.toLowerCase();
    let positiveScore = 0;
    let negativeScore = 0;
    const matchedKeywords: string[] = [];

    // 强度修饰词
    const strongAmplifiers = ['非常', '特别', '超级', '真的', '真', '太', '极', 'so', 'very', 'really', 'extremely', 'absolutely', 'incredibly'];
    const weakAmplifiers = ['有点', '稍微', '还行', '一般', 'slightly', 'a bit', 'somewhat', 'kind of', 'sort of'];
    const negators = ['不', '没', '没有', 'not', "don't", 'never', '不再'];

    // 计算修饰乘数
    let intensityMultiplier = 1.0;
    for (const amp of strongAmplifiers) {
      if (lowerText.includes(amp)) {
        intensityMultiplier = 2.0;
        break;
      }
    }
    for (const weak of weakAmplifiers) {
      if (lowerText.includes(weak)) {
        intensityMultiplier = 0.5;
        break;
      }
    }
    for (const neg of negators) {
      if (lowerText.includes(neg)) {
        intensityMultiplier *= -0.8; // 反转极性
      }
    }

    // 正向词匹配（带权重）
    const strongPositiveWords = ['太棒了', '非常好', '完美', '极好', 'excellent', 'perfect', 'wonderful', 'fantastic', 'amazing', 'outstanding'];
    const weakPositiveWords = ['不错', '还行', '可以', '还好', 'ok', 'fine', 'good', 'nice', 'alright'];

    for (const word of strongPositiveWords) {
      if (lowerText.includes(word)) {
        positiveScore += 3;
        matchedKeywords.push(word);
      }
    }
    for (const word of weakPositiveWords) {
      if (lowerText.includes(word)) {
        positiveScore += 1;
        matchedKeywords.push(word);
      }
    }
    for (const word of this.positiveWords) {
      if (!matchedKeywords.includes(word) && lowerText.includes(word.toLowerCase())) {
        positiveScore += 2;
        matchedKeywords.push(word);
      }
    }

    // 负向词匹配（带权重）
    const strongNegativeWords = ['太差了', '非常糟糕', '极差', 'terrible', 'horrible', 'awful', 'disastrous', 'dreadful'];
    const weakNegativeWords = ['不太好', '有点差', '不满意', 'not great', 'not good', 'disappointed', 'unfortunately'];

    for (const word of strongNegativeWords) {
      if (lowerText.includes(word)) {
        negativeScore += 3;
        matchedKeywords.push(word);
      }
    }
    for (const word of weakNegativeWords) {
      if (lowerText.includes(word)) {
        negativeScore += 1;
        matchedKeywords.push(word);
      }
    }
    for (const word of this.negativeWords) {
      if (!matchedKeywords.includes(word) && lowerText.includes(word.toLowerCase())) {
        negativeScore += 2;
        matchedKeywords.push(word);
      }
    }

    // 应用修饰乘数
    const adjustedPositive = positiveScore * Math.max(0, intensityMultiplier);
    const adjustedNegative = negativeScore * Math.max(0, -intensityMultiplier) + negativeScore * Math.max(0, intensityMultiplier);
    const netScore = adjustedPositive - adjustedNegative;
    const totalScore = adjustedPositive + adjustedNegative;

    // 确定类型和强度
    let type: Emotion['type'];
    let intensity: EmotionIntensity;
    let intensityScore: number;
    let recommendedStrategy: DetailedEmotion['recommendedStrategy'];

    if (totalScore === 0) {
      type = 'neutral';
      intensity = 'neutral';
      intensityScore = 0;
      recommendedStrategy = 'neutral';
    } else if (netScore > 0) {
      type = 'positive';
      const ratio = netScore / totalScore;
      if (ratio > 0.6) {
        intensity = 'strong_positive';
        intensityScore = 0.8 + ratio * 0.2;
        recommendedStrategy = 'celebrate';
      } else {
        intensity = 'weak_positive';
        intensityScore = 0.4 + ratio * 0.3;
        recommendedStrategy = 'encourage';
      }
    } else {
      type = 'negative';
      const ratio = Math.abs(netScore) / totalScore;
      if (ratio > 0.6) {
        intensity = 'strong_negative';
        intensityScore = 0.8 + ratio * 0.2;
        recommendedStrategy = 'deescalate';
      } else {
        intensity = 'weak_negative';
        intensityScore = 0.4 + ratio * 0.3;
        recommendedStrategy = 'empathize';
      }
    }

    return {
      type,
      confidence: Math.min(totalScore / (totalScore + 2), 0.95),
      intensity,
      intensityScore: Math.min(intensityScore, 1),
      keywords: matchedKeywords.slice(0, 10),
      recommendedStrategy
    };
  }

  /**
   * 基于详细情感分析生成动态响应策略
   */
  generateEmotionAwareResponse(
    content: string,
    detailedEmotion: DetailedEmotion,
    language: string = 'zh'
  ): { content: string; strategy: string } {
    const strategies: Record<string, Record<string, { prefix: string; suffix: string; tone: string }>> = {
      zh: {
        celebrate: { prefix: '🎉 ', suffix: ' 很高兴能帮到您！', tone: '热情' },
        encourage: { prefix: '😊 ', suffix: ' 有什么需要随时问我～', tone: '友善' },
        neutral: { prefix: '', suffix: '', tone: '中性' },
        empathize: { prefix: '🤗 ', suffix: ' 我理解您的感受，让我来帮助您。', tone: '共情' },
        deescalate: { prefix: '🙏 ', suffix: ' 非常抱歉给您带来不便，我会尽力解决。', tone: '安抚' }
      },
      en: {
        celebrate: { prefix: '🎉 ', suffix: ' Glad I could help!', tone: 'enthusiastic' },
        encourage: { prefix: '😊 ', suffix: ' Feel free to ask me anything!', tone: 'friendly' },
        neutral: { prefix: '', suffix: '', tone: 'neutral' },
        empathize: { prefix: '🤗 ', suffix: ' I understand how you feel. Let me help.', tone: 'empathetic' },
        deescalate: { prefix: '🙏 ', suffix: ' I sincerely apologize for the trouble. Let me fix this.', tone: 'calming' }
      },
      ja: {
        celebrate: { prefix: '🎉 ', suffix: ' お役に立てて嬉しいです！', tone: '熱心' },
        encourage: { prefix: '😊 ', suffix: ' いつでもお声がけください～', tone: '親切' },
        neutral: { prefix: '', suffix: '', tone: '中立' },
        empathize: { prefix: '🤗 ', suffix: ' お気持ちわかります。お手伝いします。', tone: '共感' },
        deescalate: { prefix: '🙏 ', suffix: ' ご迷惑をおかけして申し訳ありません。解決します。', tone: 'なだめ' }
      }
    };

    const langStrategies = strategies[language] || strategies.zh;
    const strategy = langStrategies[detailedEmotion.recommendedStrategy];

    return {
      content: `${strategy.prefix}${content}${strategy.suffix}`,
      strategy: strategy.tone
    };
  }

  detectLanguage(text: string): string {
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length || 0;
    const japaneseChars = text.match(/[\u3040-\u30ff]/g)?.length || 0;
    const koreanChars = text.match(/[\uac00-\ud7af\u1100-\u11ff]/g)?.length || 0;
    const englishWords = text.match(/[a-zA-Z]+/g)?.length || 0;

    const scores: Record<string, number> = {
      zh: chineseChars * 1.2,
      ja: japaneseChars,
      ko: koreanChars,
      en: englishWords * 0.8
    };

    let maxLang = 'zh';
    let maxScore = 0;

    for (const [lang, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxLang = lang;
      }
    }

    // 阈值 1.5：两个英文单词（'Hello world' = 2 词 × 0.8 = 1.6）即可判定，单个词仍返回 unknown
    if (maxScore < 1.5) {
      return 'unknown';
    }

    return maxLang;
  }

  // 增强的响应生成器
  generateResponse(content: string, emotion?: Emotion, language: string = 'zh'): AgentResponse {
    const adjustedContent = this.adjustResponseByEmotion(content, emotion, language);

    return {
      content: adjustedContent,
      emotion: emotion || { type: 'neutral', confidence: 0.5 }
    };
  }

  private adjustResponseByEmotion(content: string, emotion?: Emotion, language: string = 'zh'): string {
    if (!emotion) return content;

    const prefixes: Record<string, Record<string, string>> = {
      zh: {
        positive: '😊 ',
        negative: '💙 ',
        neutral: ''
      },
      en: {
        positive: '😊 ',
        negative: '💙 ',
        neutral: ''
      },
      ja: {
        positive: '😊 ',
        negative: '💙 ',
        neutral: ''
      }
    };

    const suffixes: Record<string, Record<string, string>> = {
      zh: {
        positive: ' 祝你有个美好的一天！',
        negative: ' 有我在，不用担心～',
        neutral: ''
      },
      en: {
        positive: ' Have a great day!',
        negative: " I'm here to help!",
        neutral: ''
      },
      ja: {
        positive: ' よい一日を！',
        negative: ' お手伝いします！',
        neutral: ''
      }
    };

    const langPrefix = prefixes[language] || prefixes.zh;
    const langSuffix = suffixes[language] || suffixes.zh;

    return `${langPrefix[emotion.type]}${content}${langSuffix[emotion.type]}`;
  }

  // === 新增：文本预处理和清洗 ===
  preprocessText(text: string): string {
    let processed = text.trim();

    // 标准化标点
    processed = processed
      .replace(/[，]/g, '，')
      .replace(/[。]/g, '。')
      .replace(/[！!]/g, '！')
      .replace(/[？?]/g, '？')
      .replace(/[：:]/g, '：')
      .replace(/[；;]/g, '；');

    // 移除多余空格
    processed = processed.replace(/\s+/g, ' ');

    // 去除首尾标点
    processed = processed.replace(/^[，。！？]+|[，。！？]+$/g, '');

    return processed.trim();
  }

  // === 新增：关键词提取和主题检测 ===
  extractKeywords(text: string, maxCount: number = 5): string[] {
    const stopWords = new Set([
      '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上',
      '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这',
      '那', '这个', '那个', '吗', '呢', '啊', '吧', '怎么', '什么', '为什么', '如何', '请问', '请',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through'
    ]);

    const words = text.split(/[\s，。！？、.,!?]+/)
      .filter(w => w.length >= 2 && !stopWords.has(w.toLowerCase()));

    // 统计词频
    const freq: Record<string, number> = {};
    for (const word of words) {
      const lowerWord = word.toLowerCase();
      freq[lowerWord] = (freq[lowerWord] || 0) + 1;
    }

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxCount)
      .map(([word]) => word);
  }

  // === 新增：文本相似度检测（简单实现）===
  calculateTextSimilarity(text1: string, text2: string): number {
    const tokens1 = new Set(this.preprocessText(text1).toLowerCase().split(/[\s，。！？、]+/));
    const tokens2 = new Set(this.preprocessText(text2).toLowerCase().split(/[\s，。！？、]+/));

    if (tokens1.size === 0 || tokens2.size === 0) return 0;

    let intersection = 0;
    for (const token of tokens1) {
      if (tokens2.has(token)) {
        intersection++;
      }
    }

    const union = tokens1.size + tokens2.size - intersection;
    return intersection / union;
  }

  // === 新增：上下文管理（用于对话历史）===
  private conversationContext: string[] = [];
  private maxContextSize = 5;

  addToContext(text: string): void {
    this.conversationContext.push(text);
    if (this.conversationContext.length > this.maxContextSize) {
      this.conversationContext.shift();
    }
  }

  getContext(): string[] {
    return [...this.conversationContext];
  }

  clearContext(): void {
    this.conversationContext = [];
  }

  // === 新增：基于上下文的智能响应 ===
  generateContextualResponse(userInput: string, context: string[] = []): AgentResponse {
    const emotion = this.analyzeEmotion(userInput);
    const language = this.detectLanguage(userInput);
    const intent = this.recognizeIntent(userInput);

    // 检测是否重复
    if (context.length >= 2) {
      const similarity = this.calculateTextSimilarity(userInput, context[context.length - 1]);
      if (similarity > 0.7) {
        return this.generateResponse(
          '我注意到您在重复相同的内容。有什么我可以更好地帮您的吗？',
          { type: 'neutral', confidence: 0.7 },
          language
        );
      }
    }

    // 基于意图的响应模板
    const responseTemplates: Record<string, (lang: string) => string> = {
      greeting: (lang) => lang === 'zh' ? '你好！很高兴见到你！我能帮你做什么？' : 'Hello! How can I help you?',
      goodbye: (lang) => lang === 'zh' ? '再见！期待下次为你服务！' : 'Goodbye! See you next time!',
      thanks: (lang) => lang === 'zh' ? '不客气！随时为您服务！' : 'You\'re welcome!',
      compliment: (lang) => lang === 'zh' ? '谢谢您的鼓励！我会继续努力！' : 'Thank you! I\'ll keep improving!',
      complain: (lang) => lang === 'zh' ? '非常抱歉让您不满意！请告诉我具体的问题，我会尽力改进。' : 'I apologize for the inconvenience. Please tell me the issue and I\'ll help resolve it.',
      question: (lang) => lang === 'zh' ? '这是个好问题。让我来帮你分析一下。' : 'Good question. Let me help you analyze it.',
      help: (lang) => lang === 'zh' ? '我可以帮你搜索信息、计算数学、翻译语言、分析数据等。直接告诉我你需要什么！' : 'I can help with search, calculation, translation, analysis and more. Tell me what you need!',
    };

    const template = responseTemplates[intent.name];
    const content = template ? template(language) :
      (language === 'zh' ? '我理解您的需求。让我来帮您处理一下。' : 'I understand your request. Let me help you process it.');

    this.addToContext(userInput);

    return this.generateResponse(content, emotion, language);
  }

  // === 新增：响应质量评分 ===
  scoreResponseQuality(response: string, context: string[] = []): {
    relevance: number;
    clarity: number;
    helpfulness: number;
    overall: number;
  } {
    const lowerResponse = response.toLowerCase();

    // 相关性评分（是否有实质内容）
    let relevance = 0.5;
    if (lowerResponse.length > 50) relevance += 0.2;
    if (lowerResponse.includes('分析') || lowerResponse.includes('建议') || lowerResponse.includes('解决')) relevance += 0.15;
    if (context.length > 0) {
      const avgSimilarity = context.reduce((sum, c) => sum + this.calculateTextSimilarity(response, c), 0) / context.length;
      relevance += avgSimilarity * 0.15;
    }

    // 清晰度评分
    let clarity = 0.6;
    if (response.includes('\n') || response.includes('•')) clarity += 0.2; // 结构化
    if (!response.includes('?') || !response.includes('？')) clarity += 0.1; // 不是问题
    if (response.length < 500) clarity += 0.1; // 不过长

    // 有用性评分
    let helpfulness = 0.5;
    if (lowerResponse.includes('建议') || lowerResponse.includes('方法') || lowerResponse.includes('步骤')) helpfulness += 0.2;
    if (lowerResponse.includes('可以') || lowerResponse.includes('帮助') || lowerResponse.includes('can')) helpfulness += 0.1;
    if (response.length > 20) helpfulness += 0.1;

    const overall = (relevance + clarity + helpfulness) / 3;

    return {
      relevance: Math.min(relevance, 1.0),
      clarity: Math.min(clarity, 1.0),
      helpfulness: Math.min(helpfulness, 1.0),
      overall: Math.min(overall, 1.0)
    };
  }

  // === 新增：文本风格生成器 ===
  private styleTemplates: Record<string, {
    prefix: string;
    suffix: string;
    format: (content: string) => string;
  }> = {
    formal: {
      prefix: '',
      suffix: '',
      format: (content) => content
    },
    friendly: {
      prefix: '',
      suffix: '',
      format: (content) => content.replace(/您/g, '你').replace(/。/g, '！')
    },
    technical: {
      prefix: '【技术分析】\n',
      suffix: '\n---\n如需更详细的技术实现方案，请告诉我具体的需求。',
      format: (content) => content
    },
    educational: {
      prefix: '📚 学习指南\n',
      suffix: '\n\n💡 小提示：实践是最好的老师！',
      format: (content) => content
    },
    concise: {
      prefix: '',
      suffix: '',
      format: (content) => {
        const sentences = content.split(/[。！？\n]/).filter(s => s.trim().length > 0);
        return sentences.slice(0, 2).join('。') + '。';
      }
    },
    detailed: {
      prefix: '【详细解答】\n\n',
      suffix: '\n\n如果还有不明白的地方，随时问我！',
      format: (content) => content
    },
    humorous: {
      prefix: '😄 ',
      suffix: ' (开个玩笑啦～)',
      format: (content) => content
    }
  };

  // 按风格生成响应
  generateStyledResponse(content: string, style: string = 'formal', emotion?: Emotion, language: string = 'zh'): AgentResponse {
    const template = this.styleTemplates[style] || this.styleTemplates.formal;
    const styledContent = template.prefix + template.format(content) + template.suffix;
    return this.generateResponse(styledContent, emotion, language);
  }

  // === 新增：智能回复模板引擎 ===
  private responseTemplates: Record<string, Record<string, (args?: Record<string, unknown>) => string>> = {
    zh: {
      greeting: () => '你好！很高兴见到你！有什么可以帮你的吗？',
      greeting_morning: () => '早上好！新的一天，有什么需要帮忙的吗？',
      greeting_afternoon: () => '下午好！精神还好吗？需要什么帮助？',
      greeting_evening: () => '晚上好！辛苦一天了，有什么想聊的吗？',
      farewell: () => '再见！期待下次为你服务！',
      thanks: () => '不客气！很高兴能帮到你！',
      apology: () => '非常抱歉给您带来不便，我会尽力改进！',
      confirm: () => '好的，明白了！',
      agree: () => '说得对！我完全同意。',
      clarify: () => '您能具体说明一下吗？我想更好地理解您的需求。',
      question_generic: () => '这是个很好的问题！让我来帮你分析一下。',
      help_intro: () => '我可以帮您做很多事情！搜索信息、分析数据、解答问题、代码编程...直接告诉我您需要什么吧！',
      error: () => '抱歉，我遇到了一些问题。您能换一种说法吗？',
      processing: () => '让我想想...正在为您分析...',
      success: () => '✅ 完成！有什么问题随时问我！',
      incomplete: () => '我大概理解您的意思了，能再详细说说吗？',
      too_long: () => '内容有点长，让我为您总结一下关键点...',
      unsure: () => '这个问题我需要再想一想。您能提供更多上下文吗？',
      compliment_response: () => '谢谢您的鼓励！我会继续努力为您提供更好的服务！',
      repeat: () => '好的，我再重复一遍...'
    },
    en: {
      greeting: () => 'Hello! Nice to meet you! How can I help you today?',
      farewell: () => 'Goodbye! Looking forward to helping you again!',
      thanks: () => "You're welcome! Glad I could help!",
      apology: () => "I'm very sorry for the inconvenience. I'll do my best to improve!",
      question_generic: () => "That's a great question! Let me help you analyze it.",
      processing: () => 'Let me think... analyzing for you...',
      success: () => '✅ Done! Feel free to ask if you have more questions!',
      help_intro: () => 'I can help you with many things! Search for information, analyze data, answer questions, code programming... Just tell me what you need!',
      compliment_response: () => "Thank you for your encouragement! I'll keep improving!",
      clarify: () => 'Could you be more specific? I want to understand your needs better.'
    }
  };

  // 使用模板生成回复
  generateTemplateResponse(templateName: string, language: string = 'zh', args?: Record<string, unknown>): AgentResponse {
    const langTemplates = this.responseTemplates[language] || this.responseTemplates.zh;
    const template = langTemplates[templateName] || langTemplates.question_generic;
    const content = template(args);
    return this.generateResponse(content, { type: 'neutral', confidence: 0.8 }, language);
  }

  // === 新增：智能对话策略选择 ===
  selectConversationStrategy(userInput: string, context: string[] = []): {
    strategy: string;
    reasoning: string;
    emotion: string;
  } {
    const lowerInput = userInput.toLowerCase();
    const emotion = this.analyzeEmotion(userInput);
    const intent = this.recognizeIntent(userInput);

    // 策略选择规则
    if (emotion.type === 'negative') {
      return { strategy: 'supportive', reasoning: '用户表达负面情绪，需要支持性回应', emotion: emotion.type };
    }

    if (emotion.type === 'positive' || intent.name === 'compliment') {
      return { strategy: 'friendly', reasoning: '用户表达正面情绪或赞美，使用友好回应', emotion: emotion.type };
    }

    if (intent.name === 'question' || lowerInput.includes('?') || lowerInput.includes('？')) {
      return { strategy: 'analytical', reasoning: '用户提出问题，需要分析性回答', emotion: emotion.type };
    }

    if (intent.name === 'search' || lowerInput.includes('搜索') || lowerInput.includes('查找')) {
      return { strategy: 'research', reasoning: '用户在搜索信息，提供研究式回答', emotion: emotion.type };
    }

    if (context.length > 3) {
      return { strategy: 'contextual', reasoning: '有较长的对话历史，使用上下文相关回复', emotion: emotion.type };
    }

    if (userInput.length < 10) {
      return { strategy: 'concise', reasoning: '简短输入，提供简洁回应', emotion: emotion.type };
    }

    return { strategy: 'balanced', reasoning: '默认平衡策略', emotion: emotion.type };
  }

  // === 新增：多语言翻译功能 ===
  private translateDictionary: Record<string, Record<string, string>> = {
    '你好': { en: 'Hello', ja: 'こんにちは', ko: '안녕하세요' },
    '谢谢': { en: 'Thank you', ja: 'ありがとう', ko: '감사합니다' },
    '再见': { en: 'Goodbye', ja: 'さようなら', ko: '안녕히 가세요' },
    '好的': { en: 'Okay', ja: 'はい', ko: '네' },
    '是的': { en: 'Yes', ja: 'はい', ko: '네' },
    '不': { en: 'No', ja: 'いいえ', ko: '아니요' },
    '帮助': { en: 'Help', ja: '助け', ko: '도움' },
    '问题': { en: 'Question', ja: '質問', ko: '질문' },
    '信息': { en: 'Information', ja: '情報', ko: '정보' },
    '代码': { en: 'Code', ja: 'コード', ko: '코드' },
    '数据': { en: 'Data', ja: 'データ', ko: '데이터' },
    '分析': { en: 'Analysis', ja: '分析', ko: '분석' },
    '搜索': { en: 'Search', ja: '検索', ko: '검색' },
    '学习': { en: 'Learn', ja: '学ぶ', ko: '배우다' },
    '教程': { en: 'Tutorial', ja: 'チュートリアル', ko: '튜토리얼' },
    '编程': { en: 'Programming', ja: 'プログラミング', ko: '프로그래밍' }
  };

  // 简单的翻译功能
  translate(text: string, targetLanguage: string = 'en'): {
    original: string;
    translated: string;
    confidence: number;
    isPartial: boolean;
  } {
    const lowerText = text.toLowerCase().trim();
    
    // 尝试在字典中找到完整匹配
    if (this.translateDictionary[lowerText]) {
      return {
        original: text,
        translated: this.translateDictionary[lowerText][targetLanguage] || lowerText,
        confidence: 0.95,
        isPartial: false
      };
    }

    // 尝试逐词翻译（简单实现）
    const words = text.split(/[，。！？、\s]+/).filter(w => w.length > 0);
    const translatedWords: string[] = [];
    let translatedCount = 0;

    for (const word of words) {
      if (this.translateDictionary[word]) {
        translatedWords.push(this.translateDictionary[word][targetLanguage] || word);
        translatedCount++;
      } else {
        translatedWords.push(word);
      }
    }

    const translated = translatedWords.join(' ');
    const confidence = words.length > 0 ? translatedCount / words.length : 0;

    return {
      original: text,
      translated: confidence > 0 ? translated : text,
      confidence: Math.max(confidence, 0.1),
      isPartial: confidence < 1 && confidence > 0
    };
  }

  // === 新增：文本摘要功能 ===
  summarizeText(text: string, maxLength: number = 200): {
    summary: string;
    originalLength: number;
    summaryLength: number;
    compressionRatio: number;
    keyPoints: string[];
  } {
    const sentences = text.split(/[。！？\n]/).filter(s => s.trim().length > 5);
    const originalLength = text.length;

    // 提取关键句：包含关键词的句子
    const keywords = this.extractKeywords(text, 10);
    const scoredSentences = sentences.map(sentence => {
      let score = 0;
      for (const kw of keywords) {
        if (sentence.toLowerCase().includes(kw.toLowerCase())) {
          score++;
        }
      }
      return { sentence: sentence.trim(), score };
    });

    // 按分数排序并选择前几句
    const topSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.sentence);

    // 组装摘要
    let summary = topSentences.join('。') + '。';
    
    // 如果摘要太长，进一步截断
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength - 3) + '...';
    }

    // 提取关键点
    const keyPoints = keywords.slice(0, 5);

    return {
      summary,
      originalLength,
      summaryLength: summary.length,
      compressionRatio: originalLength > 0 ? (1 - summary.length / originalLength) : 0,
      keyPoints
    };
  }

  // === 新增：文本格式化和结构化输出 ===
  formatResponse(data: {
    title?: string;
    sections?: Array<{ heading: string; content: string }>;
    bulletPoints?: string[];
    keyHighlights?: string[];
    summary?: string;
    footer?: string;
  }, language: string = 'zh'): AgentResponse {
    let formatted = '';

    if (data.title) {
      formatted += `📋 ${data.title}\n${'='.repeat(data.title.length * 2)}\n\n`;
    }

    if (data.keyHighlights && data.keyHighlights.length > 0) {
      formatted += language === 'zh' ? '✨ 要点：\n' : '✨ Key Points:\n';
      for (const highlight of data.keyHighlights) {
        formatted += `  • ${highlight}\n`;
      }
      formatted += '\n';
    }

    if (data.sections && data.sections.length > 0) {
      for (const section of data.sections) {
        formatted += `\n### ${section.heading}\n`;
        formatted += `${section.content}\n`;
      }
    }

    if (data.bulletPoints && data.bulletPoints.length > 0) {
      formatted += language === 'zh' ? '\n📌 详细说明：\n' : '\n📌 Details:\n';
      for (const point of data.bulletPoints) {
        formatted += `  ▶ ${point}\n`;
      }
    }

    if (data.summary) {
      formatted += `\n${language === 'zh' ? '💡 总结' : '💡 Summary'}：${data.summary}\n`;
    }

    if (data.footer) {
      formatted += `\n${data.footer}\n`;
    }

    return this.generateResponse(formatted.trim(), { type: 'neutral', confidence: 0.7 }, language);
  }

  // === 新增：智能追问功能 ===
  shouldAskFollowUp(userInput: string, context: string[] = []): {
    shouldAsk: boolean;
    questions: string[];
    reason: string;
  } {
    const lowerInput = userInput.toLowerCase();
    
    // 判断是否需要追问
    if (userInput.length < 5) {
      return {
        shouldAsk: true,
        questions: ['您能具体说一下您的需求吗？', '您想了解什么方面的内容？', '有什么我可以帮您的？'],
        reason: '输入太短，需要更多信息'
      };
    }

    if (lowerInput.includes('？') || lowerInput.includes('?')) {
      if (lowerInput.length < 15) {
        return {
          shouldAsk: true,
          questions: ['您能详细描述一下您的问题吗？', '是关于什么方面的问题？', '有具体的例子吗？'],
          reason: '问题过于简短，需要更多上下文'
        };
      }
    }

    const vagueWords = ['那个', '这个', '它', '那个东西', '一些', '什么', '随便'];
    if (vagueWords.some(w => lowerInput.includes(w)) && userInput.length < 20) {
      return {
        shouldAsk: true,
        questions: ['您指的是哪方面？', '能举个例子吗？', '是关于什么的呢？'],
        reason: '输入含糊不清，需要澄清'
      };
    }

    // 如果有上下文但与当前输入不相关
    if (context.length > 0) {
      const lastContext = context[context.length - 1];
      const similarity = this.calculateTextSimilarity(userInput, lastContext);
      if (similarity < 0.2 && lowerInput.length < 15) {
        return {
          shouldAsk: true,
          questions: ['这是一个新话题吗？', '和之前的内容有关吗？', '您想从哪个角度探讨这个问题？'],
          reason: '话题突然变化，需要确认意图'
        };
      }
    }

    return { shouldAsk: false, questions: [], reason: '输入清晰，无需追问' };
  }

  // === 新增：对话记忆管理 ===
  private dialogMemory: Array<{
    role: string;
    content: string;
    timestamp: Date;
    emotion: string;
    intent: string;
  }> = [];
  private maxDialogMemory = 20;

  // 记录对话
  recordDialog(role: string, content: string, emotion: Emotion, intent: string): void {
    this.dialogMemory.push({
      role,
      content,
      timestamp: new Date(),
      emotion: emotion.type,
      intent
    });

    if (this.dialogMemory.length > this.maxDialogMemory) {
      this.dialogMemory.shift();
    }
  }

  // 获取对话摘要
  getDialogSummary(): {
    turnCount: number;
    topics: string[];
    emotions: string[];
    recentMessages: string[];
  } {
    const topics = new Set<string>();
    const emotions = new Set<string>();

    for (const dialog of this.dialogMemory) {
      const keywords = this.extractKeywords(dialog.content, 3);
      keywords.forEach(kw => topics.add(kw));
      emotions.add(dialog.emotion);
    }

    return {
      turnCount: this.dialogMemory.length,
      topics: [...topics].slice(0, 5),
      emotions: [...emotions],
      recentMessages: this.dialogMemory.slice(-3).map(d => `${d.role}: ${d.content.slice(0, 30)}...`)
    };
  }

  // === 新增：完整的NLP处理管道 ===
  processComprehensive(userInput: string, context: string[] = []): {
    originalInput: string;
    preprocessed: string;
    language: string;
    intent: Intent;
    entities: Entity[];
    emotion: Emotion;
    keywords: string[];
    strategy: { strategy: string; reasoning: string; emotion: string };
    shouldFollowUp: { shouldAsk: boolean; questions: string[]; reason: string };
    recommendedTemplate: string;
    followUpSuggestions: string[];
  } {
    const startTime = Date.now();
    
    // 1. 预处理
    const preprocessed = this.preprocessText(userInput);
    
    // 2. 语言检测
    const language = this.detectLanguage(preprocessed);
    
    // 3. 意图识别
    const intent = this.recognizeIntent(preprocessed);
    
    // 4. 实体提取
    const entities = this.extractEntities(preprocessed);
    
    // 5. 情感分析
    const emotion = this.analyzeEmotion(preprocessed);
    
    // 6. 关键词提取
    const keywords = this.extractKeywords(preprocessed, 5);
    
    // 7. 策略选择
    const strategy = this.selectConversationStrategy(preprocessed, context);
    
    // 8. 是否需要追问
    const shouldFollowUp = this.shouldAskFollowUp(preprocessed, context);
    
    // 9. 推荐回复模板
    let recommendedTemplate = 'question_generic';
    if (intent.name === 'greeting') recommendedTemplate = 'greeting';
    else if (intent.name === 'thanks') recommendedTemplate = 'thanks';
    else if (intent.name === 'compliment') recommendedTemplate = 'compliment_response';
    else if (intent.name === 'goodbye') recommendedTemplate = 'farewell';
    else if (intent.name === 'help') recommendedTemplate = 'help_intro';
    else if (emotion.type === 'negative') recommendedTemplate = 'apology';
    else if (emotion.type === 'positive') recommendedTemplate = 'compliment_response';

    // 10. 建议的后续问题
    const followUpSuggestions = [
      `您想了解关于 ${keywords[0] || '这个问题'} 的什么信息？`,
      `需要我详细分析 ${keywords[0] || '这个主题'} 吗？`,
      `您想从哪个角度探讨这个问题？`
    ];

    // 记录对话
    this.recordDialog('user', userInput, emotion, intent.name);

    console.log(`${LOG_PREFIX} [COMPREHENSIVE_PROCESS] inputLength=${preprocessed.length}, intent=${intent.name}, emotion=${emotion.type}, elapsed=${Date.now() - startTime}ms`);

    return {
      originalInput: userInput,
      preprocessed,
      language,
      intent,
      entities,
      emotion,
      keywords,
      strategy,
      shouldFollowUp,
      recommendedTemplate,
      followUpSuggestions
    };
  }

  // === 新增：结构化输出（将自然语言转换为JSON/XML等结构化格式） ===
  convertToStructuredFormat(text: string, format: 'json' | 'xml' | 'yaml' = 'json'): {
    success: boolean;
    output: string;
    confidence: number;
    parsedData?: Record<string, unknown>;
  } {
    try {
      // 尝试从文本中提取结构化信息
      const entities = this.extractEntities(text);
      const intent = this.recognizeIntent(text);
      const emotion = this.analyzeEmotion(text);
      const keywords = this.extractKeywords(text, 5);

      // 构建基础数据结构
      const structuredData: Record<string, unknown> = {
        content: text,
        intent: intent.name,
        intentConfidence: intent.confidence,
        emotion: emotion.type,
        emotionConfidence: emotion.confidence,
        entities: entities.reduce((acc, e) => {
          if (!acc[e.name]) acc[e.name] = [];
          (acc[e.name] as string[]).push(e.value);
          return acc;
        }, {} as Record<string, string[]>),
        keywords,
        language: this.detectLanguage(text),
        timestamp: new Date().toISOString()
      };

      // 根据格式输出
      let output: string;
      if (format === 'json') {
        output = JSON.stringify(structuredData, null, 2);
      } else if (format === 'xml') {
        output = this.objectToXml(structuredData, 'nlp_result');
      } else {
        output = this.objectToYaml(structuredData);
      }

      return {
        success: true,
        output,
        confidence: intent.confidence,
        parsedData: structuredData
      };
    } catch {
      return {
        success: false,
        output: '',
        confidence: 0
      };
    }
  }

  // 对象转XML格式
  private objectToXml(obj: Record<string, unknown>, rootTag: string, indent: string = ''): string {
    let xml = `${indent}<${rootTag}>\n`;
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        xml += `${indent}  <${key}/>\n`;
      } else if (Array.isArray(value)) {
        xml += `${indent}  <${key}>\n`;
        for (const item of value) {
          xml += `${indent}    <item>${this.escapeXml(String(item))}</item>\n`;
        }
        xml += `${indent}  </${key}>\n`;
      } else if (typeof value === 'object') {
        xml += this.objectToXml(value as Record<string, unknown>, key, indent + '  ');
      } else {
        xml += `${indent}  <${key}>${this.escapeXml(String(value))}</${key}>\n`;
      }
    }
    xml += `${indent}</${rootTag}>`;
    return xml;
  }

  // 对象转YAML格式
  private objectToYaml(obj: Record<string, unknown>, indent: number = 0): string {
    let yaml = '';
    const spaces = '  '.repeat(indent);
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        yaml += `${spaces}${key}: null\n`;
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          yaml += `${spaces}  - ${this.escapeYaml(String(item))}\n`;
        }
      } else if (typeof value === 'object') {
        yaml += `${spaces}${key}:\n`;
        yaml += this.objectToYaml(value as Record<string, unknown>, indent + 1);
      } else {
        yaml += `${spaces}${key}: ${this.escapeYaml(String(value))}\n`;
      }
    }
    return yaml;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private escapeYaml(str: string): string {
    if (str.includes(':') || str.includes('#') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '\\"')}"`;
    }
    return str;
  }

  // === 新增：模板变量提取和动态填充 ===
  fillTemplateVariables(template: string, variables: Record<string, string | number>): string {
    let filled = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      filled = filled.replace(regex, String(value));
    }
    // 处理条件变量 {{#if var}}...{{/if}}
    filled = this.processConditionalVariables(filled, variables);
    return filled;
  }

  // 处理条件变量
  private processConditionalVariables(template: string, variables: Record<string, string | number>): string {
    const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    return template.replace(conditionalRegex, (match, varName, content) => {
      if (variables[varName] && String(variables[varName]).length > 0) {
        return content;
      }
      return '';
    });
  }

  // 从用户输入中提取模板变量
  extractTemplateVariables(text: string, variablePatterns: Array<{ name: string; pattern: RegExp }>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const { name, pattern } of variablePatterns) {
      const match = text.match(pattern);
      if (match) {
        result[name] = match[1] || match[0];
      }
    }
    return result;
  }

  // === 新增：增强的多语言翻译词典 ===
  private extendedTranslateDictionary: Record<string, Record<string, string>> = {
    // 常用词汇扩展
    '我': { en: 'I', ja: '私は', ko: '나는' },
    '你': { en: 'you', ja: 'あなたは', ko: '당신' },
    '他': { en: 'he', ja: '彼', ko: '그' },
    '她': { en: 'she', ja: '彼女', ko: '그녀' },
    '我们': { en: 'we', ja: '私たちは', ko: '우리는' },
    '他们': { en: 'they', ja: '彼ら', ko: '그들' },
    '是': { en: 'is', ja: 'です', ko: '입니다' },
    '有': { en: 'have', ja: 'あります', ko: '있습니다' },
    '做': { en: 'do', ja: 'します', ko: '합니다' },
    '工作': { en: 'work', ja: '仕事', ko: '일' },
    '生活': { en: 'life', ja: '生活', ko: '생활' },
    '时间': { en: 'time', ja: '時間', ko: '시간' },
    '人': { en: 'person', ja: '人', ko: '사람' },
    '事': { en: 'thing', ja: 'こと', ko: '것' },
    '问题': { en: 'question', ja: '質問', ko: '질문' },
    '答案': { en: 'answer', ja: '答え', ko: '답변' },
    '方法': { en: 'method', ja: '方法', ko: '방법' },
    '结果': { en: 'result', ja: '結果', ko: '결과' },
    '原因': { en: 'reason', ja: '原因', ko: '이유' },
    '例子': { en: 'example', ja: '例', ko: '예시' },
    '使用': { en: 'use', ja: '使用', ko: '사용' },
    '知道': { en: 'know', ja: '知る', ko: '알다' },
    '想要': { en: 'want', ja: '欲しい', ko: '원하다' },
    '需要': { en: 'need', ja: '必要', ko: '필요' },
    '应该': { en: 'should', ja: 'べき', ko: '해야한다' },
    '可以': { en: 'can', ja: 'できる', ko: '할 수 있다' },
    '会': { en: 'will', ja: 'でしょう', ko: '할 것이다' },
    '能够': { en: 'able to', ja: ' 가능', ko: '할 수 있다' },
    // 技术词汇
    '电脑': { en: 'computer', ja: 'コンピュータ', ko: '컴퓨터' },
    '手机': { en: 'phone', ja: '電話', ko: '전화' },
    '软件': { en: 'software', ja: 'ソフトウェア', ko: '소프트웨어' },
    '硬件': { en: 'hardware', ja: 'ハードウェア', ko: '하드웨어' },
    '网络': { en: 'network', ja: 'ネットワーク', ko: '네트워크' },
    '互联网': { en: 'Internet', ja: 'インターネット', ko: '인터넷' },
    '网站': { en: 'website', ja: 'ウェブサイト', ko: '웹사이트' },
    '应用': { en: 'application', ja: 'アプリ', ko: '앱' },
    '系统': { en: 'system', ja: 'システム', ko: '시스템' },
    '服务': { en: 'service', ja: 'サービス', ko: '서비스' },
    '数据库': { en: 'database', ja: 'データベース', ko: '데이터베이스' },
    '服务器': { en: 'server', ja: 'サーバー', ko: '서버' },
    '客户端': { en: 'client', ja: 'クライアント', ko: '클라이언트' },
    '接口': { en: 'interface', ja: 'インターフェース', ko: '인터페이스' },
    '协议': { en: 'protocol', ja: 'プロトコル', ko: '프로토콜' },
    '安全': { en: 'security', ja: 'セキュリティ', ko: '보안' },
    '性能': { en: 'performance', ja: 'パフォーマンス', ko: '성능' },
    '优化': { en: 'optimization', ja: '最適化', ko: '최적화' },
    '测试': { en: 'test', ja: 'テスト', ko: '테스트' },
    '开发': { en: 'development', ja: '開発', ko: '개발' },
    '设计': { en: 'design', ja: '設計', ko: '디자인' },
    '实现': { en: 'implementation', ja: '実装', ko: '구현' },
    '文档': { en: 'documentation', ja: 'ドキュメント', ko: '문서' },
    // 常用动词和形容词
    '重要': { en: 'important', ja: '重要', ko: '중요' },
    '困难': { en: 'difficult', ja: '難しい', ko: '어려운' },
    '简单': { en: 'simple', ja: 'シンプル', ko: '간단한' },
    '快速': { en: 'fast', ja: '速い', ko: '빠른' },
    '慢': { en: 'slow', ja: '遅い', ko: '느린' },
    '新': { en: 'new', ja: '新しい', ko: '새로운' },
    '旧': { en: 'old', ja: '古い', ko: '오래된' },
    '好': { en: 'good', ja: '良い', ko: '좋은' },
    '坏': { en: 'bad', ja: '悪い', ko: '나쁜' },
    '大': { en: 'big', ja: '大きい', ko: '큰' },
    '小': { en: 'small', ja: '小さい', ko: '작은' },
    '多': { en: 'many', ja: '多い', ko: '많은' },
    '少': { en: 'few', ja: '少ない', ko: '적은' },
    '长': { en: 'long', ja: '長い', ko: '긴' },
    '短': { en: 'short', ja: '短い', ko: '짧은' },
    '高': { en: 'high', ja: '高い', ko: '높은' },
    '低': { en: 'low', ja: '低い', ko: '낮은' },
    '热': { en: 'hot', ja: '暑い', ko: '더운' },
    '冷': { en: 'cold', ja: '寒い', ko: '추운' },
    '容易': { en: 'easy', ja: '易しい', ko: '쉬운' }
  };

  // 增强翻译功能，支持更多语言和短语
  enhancedTranslate(text: string, targetLanguage: string, sourceLanguage?: string): {
    original: string;
    translated: string;
    confidence: number;
    isPartial: boolean;
    detectedSourceLang: string;
  } {
    const detectedLang = sourceLanguage || this.detectLanguage(text);
    const lowerText = text.toLowerCase().trim();

    // 合并字典
    const mergedDictionary = { ...this.extendedTranslateDictionary, ...this.translateDictionary };

    // 尝试在字典中找到完整匹配
    if (mergedDictionary[lowerText] && mergedDictionary[lowerText][targetLanguage]) {
      return {
        original: text,
        translated: mergedDictionary[lowerText][targetLanguage],
        confidence: 0.95,
        isPartial: false,
        detectedSourceLang: detectedLang
      };
    }

    // 尝试逐词翻译
    const words = text.split(/[，。！？、\s\n]+/).filter(w => w.length > 0);
    const translatedWords: string[] = [];
    let translatedCount = 0;

    for (const word of words) {
      const lowerWord = word.toLowerCase();
      if (mergedDictionary[lowerWord] && mergedDictionary[lowerWord][targetLanguage]) {
        translatedWords.push(mergedDictionary[lowerWord][targetLanguage]);
        translatedCount++;
      } else {
        translatedWords.push(word);
      }
    }

    // 组装翻译结果
    let translated: string;
    if (targetLanguage === 'ja') {
      translated = translatedWords.join('、');
    } else if (targetLanguage === 'ko') {
      translated = translatedWords.join(' ');
    } else {
      translated = translatedWords.join(' ');
    }

    const confidence = words.length > 0 ? translatedCount / words.length : 0;

    return {
      original: text,
      translated: confidence > 0.3 ? translated : text,
      confidence: Math.max(confidence, 0.1),
      isPartial: confidence < 1 && confidence > 0,
      detectedSourceLang: detectedLang
    };
  }

  // === 新增：响应改进建议 ===
  getResponseImprovementSuggestions(response: string, context: string[] = []): {
    currentScore: { relevance: number; clarity: number; helpfulness: number; overall: number };
    suggestions: Array<{ category: string; suggestion: string; priority: 'high' | 'medium' | 'low' }>;
    improvedVersion?: string;
  } {
    const currentScore = this.scoreResponseQuality(response, context);
    const suggestions: Array<{ category: string; suggestion: string; priority: 'high' | 'medium' | 'low' }> = [];

    // 根据评分提供改进建议
    if (currentScore.relevance < 0.6) {
      suggestions.push({
        category: 'relevance',
        suggestion: '内容相关性较低，建议更紧密地结合用户的问题或上下文',
        priority: 'high'
      });
    }

    if (currentScore.clarity < 0.6) {
      suggestions.push({
        category: 'clarity',
        suggestion: '清晰度不足，建议使用更简洁的语言和清晰的结构',
        priority: 'high'
      });
    }

    if (currentScore.helpfulness < 0.6) {
      suggestions.push({
        category: 'helpfulness',
        suggestion: '建议添加具体的步骤、方法或建议，使回复更有帮助',
        priority: 'high'
      });
    }

    // 基于内容的具体建议
    if (response.length < 20) {
      suggestions.push({
        category: 'length',
        suggestion: '回复内容过短，可能无法充分回答用户问题',
        priority: 'medium'
      });
    }

    if (response.length > 1000) {
      suggestions.push({
        category: 'length',
        suggestion: '回复内容过长，建议精简关键信息，突出重点',
        priority: 'medium'
      });
    }

    if (!response.includes('\n') && response.length > 200) {
      suggestions.push({
        category: 'format',
        suggestion: '建议使用段落或列表格式，提高可读性',
        priority: 'medium'
      });
    }

    if (!suggestions.length) {
      suggestions.push({
        category: 'general',
        suggestion: '回复质量良好，继续保持！',
        priority: 'low'
      });
    }

    // 生成改进版本
    let improvedVersion: string | undefined;
    if (suggestions.some(s => s.priority === 'high')) {
      improvedVersion = this.generateImprovedResponse(response, context, suggestions);
    }

    return {
      currentScore,
      suggestions,
      improvedVersion
    };
  }

  // 生成改进后的响应
  private generateImprovedResponse(
    original: string,
    context: string[],
    suggestions: Array<{ category: string; suggestion: string; priority: string }>
  ): string {
    let improved = original;

    // 如果回复过短，添加更多细节
    if (original.length < 20 && suggestions.some(s => s.category === 'length')) {
      const contextSummary = context.length > 0 ? `根据您的问题：${context[context.length - 1]}` : '';
      improved = `感谢您的提问！${contextSummary}让我为您提供更详细的解答：\n\n${original}`;
    }

    // 如果没有换行且内容较长，添加格式
    if (!original.includes('\n') && original.length > 200 && suggestions.some(s => s.category === 'format')) {
      const sentences = original.split(/(?<=[。！？])/);
      improved = sentences.filter(s => s.trim()).join('\n\n');
    }

    // 如果缺乏有用信息，添加建议
    if (suggestions.some(s => s.category === 'helpfulness')) {
      improved += '\n\n💡 希望这些信息对您有帮助！如果需要更详细的解释，请随时告诉我。';
    }

    return improved;
  }

  // === 新增：生成式文本摘要（增强版） ===
  generateAbstractiveSummary(text: string, maxLength: number = 100): {
    summary: string;
    method: 'extractive' | 'generative';
    originalLength: number;
    summaryLength: number;
    keyPoints: string[];
  } {
    const extractiveResult = this.summarizeText(text, maxLength);
    
    // 判断是否需要生成式摘要（文本较长时）
    if (text.length > 500) {
      // 简单的生成式摘要：整合关键点和压缩内容
      const sentences = text.split(/[。！？\n]/).filter(s => s.trim().length > 10);
      const keyPoints = this.extractKeywords(text, 5);
      
      // 选择包含关键点的句子
      const relevantSentences = sentences.filter(s => 
        keyPoints.some(kw => s.toLowerCase().includes(kw.toLowerCase()))
      ).slice(0, 3);

      let generativeSummary = relevantSentences.join(' ');
      
      // 压缩到最大长度
      if (generativeSummary.length > maxLength) {
        // 找到最后一个完整句子
        const lastSentenceEnd = generativeSummary.lastIndexOf('。', maxLength);
        if (lastSentenceEnd > maxLength * 0.6) {
          generativeSummary = generativeSummary.substring(0, lastSentenceEnd + 1);
        } else {
          generativeSummary = generativeSummary.substring(0, maxLength - 3) + '...';
        }
      }

      return {
        summary: generativeSummary || extractiveResult.summary,
        method: 'generative',
        originalLength: text.length,
        summaryLength: generativeSummary.length,
        keyPoints
      };
    }

    return {
      summary: extractiveResult.summary,
      method: 'extractive',
      originalLength: extractiveResult.originalLength,
      summaryLength: extractiveResult.summaryLength,
      keyPoints: extractiveResult.keyPoints
    };
  }

  // === 新增：智能格式化检测 ===
  detectTextFormat(text: string): {
    format: 'plain' | 'list' | 'code' | 'quote' | 'heading' | 'mixed';
    structure: {
      hasList: boolean;
      hasCode: boolean;
      hasQuote: boolean;
      hasHeading: boolean;
      lineCount: number;
    };
    formattedSegments: Array<{
      type: 'text' | 'list_item' | 'code_block' | 'quote' | 'heading';
      content: string;
    }>;
  } {
    const lines = text.split('\n');
    const structure = {
      hasList: false,
      hasCode: false,
      hasQuote: false,
      hasHeading: false,
      lineCount: lines.length
    };

    const formattedSegments: Array<{
      type: 'text' | 'list_item' | 'code_block' | 'quote' | 'heading';
      content: string;
    }> = [];

    let inCodeBlock = false;
    let codeBlockContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // 代码块检测
      if (trimmedLine.startsWith('```') || trimmedLine.match(/^(python|javascript|java|go|rust|sql|html|css|ts|tsx|js|jsx|sh|bash):?$/i)) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockContent = [];
        } else {
          formattedSegments.push({
            type: 'code_block',
            content: codeBlockContent.join('\n')
          });
          structure.hasCode = true;
          inCodeBlock = false;
          codeBlockContent = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      // 标题检测
      if (trimmedLine.match(/^#{1,6}\s+/) || trimmedLine.match(/^[\u4e00-\u9fa5]{1,10}$/) && i === 0) {
        formattedSegments.push({ type: 'heading', content: trimmedLine });
        structure.hasHeading = true;
        continue;
      }

      // 引用检测
      if (trimmedLine.startsWith('>') || trimmedLine.startsWith('"')) {
        formattedSegments.push({ type: 'quote', content: trimmedLine.replace(/^[>"]+\s*/, '') });
        structure.hasQuote = true;
        continue;
      }

      // 列表检测
      if (trimmedLine.match(/^[\-\*\+]\s+/) || trimmedLine.match(/^\d+[.)]\s+/) || trimmedLine.match(/^[a-zA-Z][.)]\s+/i)) {
        formattedSegments.push({ type: 'list_item', content: trimmedLine.replace(/^[\-\*\+]\s+|^\d+[.)]\s+/, '') });
        structure.hasList = true;
        continue;
      }

      // 普通文本
      if (trimmedLine.length > 0) {
        formattedSegments.push({ type: 'text', content: trimmedLine });
      }
    }

    // 确定整体格式
    let format: 'plain' | 'list' | 'code' | 'quote' | 'heading' | 'mixed' = 'plain';
    const formatTypes = new Set(formattedSegments.map(s => s.type));
    const formatTypeArr = Array.from(formatTypes);
    
    if (formatTypes.size > 1) {
      format = 'mixed';
    } else if (formatTypeArr.includes('code_block')) {
      format = 'code';
    } else if (formatTypeArr.includes('list_item')) {
      format = 'list';
    } else if (formatTypeArr.includes('quote')) {
      format = 'quote';
    } else if (formatTypeArr.includes('heading')) {
      format = 'heading';
    }

    return { format, structure, formattedSegments };
  }

  // === 新增：格式化输出（应用检测到的格式） ===
  applyTextFormat(text: string, targetFormat: 'markdown' | 'plain' | 'structured'): string {
    const detected = this.detectTextFormat(text);

    if (targetFormat === 'plain') {
      // 转换为纯文本
      return detected.formattedSegments
        .map(seg => seg.content)
        .join('\n');
    }

    if (targetFormat === 'structured') {
      // 转换为结构化格式
      const sections: string[] = [];
      
      for (const seg of detected.formattedSegments) {
        switch (seg.type) {
          case 'heading':
            sections.push(`\n## ${seg.content}\n`);
            break;
          case 'list_item':
            sections.push(`- ${seg.content}`);
            break;
          case 'code_block':
            sections.push(`\n\`\`\`\n${seg.content}\n\`\`\`\n`);
            break;
          case 'quote':
            sections.push(`> ${seg.content}`);
            break;
          default:
            sections.push(seg.content);
        }
      }
      
      return sections.join('\n');
    }

    // markdown格式 - 保持原有格式并优化
    return text;
  }
}
