import { Intent, Entity, Emotion } from '../../types';

const LOG_PREFIX = '[PerceptionModule]';

export class PerceptionModule {
  private supportedLanguages = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'it', 'ru', 'pt', 'ar', 'hi'];
  private docFrequency: Record<string, number> = {};
  private totalDocs = 0;
  private idfCache: Record<string, number> = {};

  // === 意图识别权重模式 ===
  private intentPatterns: Record<string, { regex: RegExp; confidence: number; priority: number }[]> = {
    search: [
      { regex: /(搜索|查找|查询|search|find|look up|查找资料|查一下|查|搜).*/i, confidence: 0.95, priority: 1 },
      { regex: /.*(最新消息|新闻|资讯|news).*/i, confidence: 0.87, priority: 1 },
    ],
    calculate: [
      { regex: /(计算|算|计算一下|等于多少|结果是|calculate|compute|math|数学).*/i, confidence: 0.92, priority: 1 },
      { regex: /\d+\s*[\+\-\*\/\×\÷]\s*\d+/i, confidence: 0.95, priority: 2 },
    ],
    summarize: [
      { regex: /(总结|概括|摘要|summarize|summary|概括一下|总结一下|概述).*/i, confidence: 0.9, priority: 1 },
    ],
    translate: [
      { regex: /(翻译|translate|转换成|译成|翻译成|翻译一下).*/i, confidence: 0.93, priority: 1 },
    ],
    execute_code: [
      { regex: /(运行|执行|run|execute).*(代码|code|脚本|script|python|javascript)/i, confidence: 0.92, priority: 1 },
    ],
    task_create: [
      { regex: /(创建任务|新建任务|create task|task|待办|todo|添加任务|新建待办).*/i, confidence: 0.89, priority: 1 },
    ],
    help: [
      { regex: /^(帮助|help|帮助我|怎么用|如何用|how to|功能|能做什么|能干嘛).*/i, confidence: 0.92, priority: 1 },
    ],
    greeting: [
      { regex: /^(你好|hi|hello|您好|早上好|下午好|晚上好|嗨|hey|hello there|こんにちは|こんばんは|おはよう)/i, confidence: 0.95, priority: 1 },
    ],
    goodbye: [
      { regex: /^(再见|bye|拜拜|下次见|see you|goodbye|回见|88|晚安)/i, confidence: 0.94, priority: 1 },
    ],
    introduction: [
      { regex: /^(你是谁|你是什么|介绍一下你自己|你能做什么|你有什么功能|what can you do|who are you|介绍一下自己)/i, confidence: 0.93, priority: 1 },
    ],
    thanks: [
      { regex: /(谢谢|感谢|thanks|thank you|thx|多谢|thanks a lot|非常感谢).*/i, confidence: 0.93, priority: 1 },
    ],
    time: [
      { regex: /(几点|时间|现在|什么时候|time|date|日期|今天|明天|昨天).*/i, confidence: 0.88, priority: 1 },
    ],
    weather: [
      { regex: /(天气|下雨|晴天|温度|weather|temperature|气候|几度|多少度).*/i, confidence: 0.89, priority: 1 },
    ],
    joke: [
      { regex: /(讲个笑话|笑话|joke|funny|幽默|讲个段子|说个笑话).*/i, confidence: 0.9, priority: 1 },
    ],
    write: [
      { regex: /(写|写作|write|撰写|创作|写文章|写邮件|写封信|写首诗).*/i, confidence: 0.87, priority: 1 },
    ],
    explain: [
      { regex: /(解释|说明|explain|解释一下|解释一下什么是|说明一下).*/i, confidence: 0.88, priority: 1 },
    ],
    analyze: [
      { regex: /(分析|analyze|研究|研究一下|分析一下).*/i, confidence: 0.86, priority: 1 },
    ],
    debug: [
      { regex: /(调试|debug|修复|fix|错误|bug|出问题了|有问题).*/i, confidence: 0.89, priority: 1 },
    ],
    optimize: [
      { regex: /(优化|optimize|改进|improve|提升|性能优化).*/i, confidence: 0.85, priority: 1 },
    ],
    learn: [
      { regex: /(学习|learn|教程|tutorial|教我|怎么学|如何学|学一下).*/i, confidence: 0.86, priority: 1 },
    ],
    remind: [
      { regex: /(提醒|remind|闹钟|alarm|记下来|备忘录).*/i, confidence: 0.88, priority: 1 },
    ],
    book: [
      { regex: /(预订|book|预约|reserve|酒店|机票|餐厅|订票).*/i, confidence: 0.87, priority: 1 },
    ],
    shop: [
      { regex: /(购物|shop|买|buy|购买|商品|下单).*/i, confidence: 0.86, priority: 1 },
    ],
    news: [
      { regex: /(新闻|news|最新消息|头条|今日新闻).*/i, confidence: 0.87, priority: 1 },
    ],
    // === 新增：更细粒度意图 ===
    question: [
      { regex: /(？|\?|为什么|怎么|如何|怎样|是什么|什么是|谁|哪里|哪个|多少|how|why|what|where|who|which).*/i, confidence: 0.75, priority: 0 },
    ],
    compliment: [
      { regex: /(你好棒|厉害|优秀|聪明|真棒|great|excellent|smart|perfect|awesome|太厉害了|真厉害|太棒了).*/i, confidence: 0.9, priority: 1 },
    ],
    complain: [
      { regex: /(不行|太差|不好|抱怨|complain|bad|terrible|有问题|太慢了|不行啊).*/i, confidence: 0.88, priority: 1 },
    ],
    clarify: [
      { regex: /(不理解|不明白|没听懂|再讲一遍|再说明一下|解释清楚|clarify).*/i, confidence: 0.87, priority: 1 },
    ],
    emotion_positive: [
      { regex: /(开心|高兴|兴奋|愉快|快乐|happy|joyful|excited|好开心|太好了|太棒了|高兴坏了).*/i, confidence: 0.85, priority: 2 },
    ],
    emotion_negative: [
      { regex: /(难过|伤心|生气|愤怒|焦虑|压力大|很累|sad|angry|anxious|tired|stressed|不开心|郁闷|失望).*/i, confidence: 0.85, priority: 2 },
    ],
    code_question: [
      { regex: /(python|javascript|java|c\+\+|go|rust|typescript|代码|编程|程序).*/i, confidence: 0.78, priority: 0 },
    ],
    travel: [
      { regex: /(旅行|旅游|出行|航班|机票|火车|高铁|出差|travel|flight|ticket|trip|journey|tour|voyage|vacation).*/i, confidence: 0.88, priority: 1 },
    ],
    food: [
      { regex: /(吃饭|美食|餐厅|订餐|外卖|food|restaurant|eat|dining|meal|menu|delicious|美食推荐|推荐餐厅).*/i, confidence: 0.87, priority: 1 },
    ],
    music: [
      { regex: /(音乐|歌曲|听歌|music|song|playlist|唱歌|歌手|专辑|播放音乐).*/i, confidence: 0.88, priority: 1 },
    ],
    movie: [
      { regex: /(电影|影片|电影院|movie|film|cinema|看电影|影评|电视剧|剧集).*/i, confidence: 0.88, priority: 1 },
    ],
    sport: [
      { regex: /(运动|体育|健身|跑步|比赛|sport|fitness|exercise|gym|篮球|足球|羽毛球|游泳|瑜伽).*/i, confidence: 0.86, priority: 1 },
    ],
    finance: [
      { regex: /(股票|基金|理财|投资|股价|行情|finance|stock|investment|money|理财推荐|投资建议|行情分析).*/i, confidence: 0.89, priority: 1 },
    ],
    confirm: [
      { regex: /^(是的|对|没错|确定|yes|ok|okay|right|correct|sure|好的|可以|行|就这个|就它|没问题)/i, confidence: 0.92, priority: 1 },
    ],
    deny: [
      { regex: /^(不是|不对|不行|不要|no|nope|not|拒绝|否定|不是这个|不对不对)/i, confidence: 0.9, priority: 1 },
    ],
    stop: [
      { regex: /(停止|停一下|停下|stop|cancel|halt|结束|取消|别再说了|不需要了|到此为止).*/i, confidence: 0.9, priority: 1 },
    ],
    repeat: [
      { regex: /(再说一遍|重复|repeat|again|再讲一遍|重新说|再发一遍|再告诉我).*/i, confidence: 0.9, priority: 1 },
    ],
  };

  // === 多语言问候语词典 ===
  private multiLangGreetings: Record<string, string[]> = {
    zh: ['你好', '您好', '早上好', '下午好', '晚上好', '嗨', '哈喽'],
    en: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'greetings'],
    ja: ['こんにちは', 'こんばんは', 'おはよう', 'やあ', 'どうも'],
    ko: ['안녕하세요', '안녕', '여보세요'],
    fr: ['bonjour', 'salut', 'bonsoir', 'coucou'],
    de: ['hallo', 'guten tag', 'guten morgen', 'guten abend', 'servus'],
    es: ['hola', 'buenos días', 'buenas tardes', 'buenas noches'],
    it: ['ciao', 'buongiorno', 'buonasera', 'salve'],
    ru: ['привет', 'здравствуйте', 'добрый день', 'доброе утро'],
    pt: ['olá', 'oi', 'bom dia', 'boa tarde', 'boa noite'],
    ar: ['مرحبا', 'أهلا', 'السلام عليكم'],
    hi: ['नमस्ते', 'हेलो', 'सुप्रभात']
  };

  // === 多语言告别语词典 ===
  private multiLangGoodbyes: Record<string, string[]> = {
    zh: ['再见', '拜拜', '下次见', '回见', '晚安', '再会'],
    en: ['bye', 'goodbye', 'see you', 'farewell', 'later', 'bye bye', 'take care'],
    ja: ['さようなら', 'また', 'じゃあね', 'おやすみ'],
    ko: ['안녕히 가세요', '안녕', '잘가'],
    fr: ['au revoir', 'à bientôt', 'ciao', 'adieu'],
    de: ['auf wiedersehen', 'tschüss', 'bis bald', 'mach\'s gut'],
    es: ['adiós', 'hasta luego', 'hasta la vista', 'nos vemos'],
    it: ['arrivederci', 'ciao', 'a presto'],
    ru: ['до свидания', 'пока', 'до встречи'],
    pt: ['adeus', 'tchau', 'até logo', 'até breve'],
    ar: ['مع السلامة', 'وداعا', 'إلى اللقاء'],
    hi: ['अलविदा', 'नमस्ते', 'फिर मिलेंगे']
  };

  // === 多语言情感词词典 ===
  private multiLangPositiveWords: Record<string, string[]> = {
    zh: ['好', '棒', '优秀', '开心', '高兴', '喜欢', '爱', '愉快', '快乐', '兴奋', '满足', '感激', '赞', '真棒', '满意', '幸福', '舒服', '有趣', '精彩', '不错', '太好了', '太棒了', '厉害', '成功'],
    en: ['great', 'good', 'happy', 'love', 'excellent', 'amazing', 'wonderful', 'perfect', 'awesome', 'fantastic', 'brilliant', 'superb', 'nice', 'best', 'beautiful'],
    ja: ['すごい', 'いい', '素晴らしい', '素敵', '最高', '嬉しい', '楽しい', '良い', '大好き'],
    ko: ['좋아', '멋지다', '최고', '행복', '사랑', '기쁘다'],
    fr: ['super', 'génial', 'superbe', 'excellent', 'parfait', 'bon', 'heureux', 'adorable'],
    de: ['toll', 'super', 'großartig', 'wunderbar', 'perfekt', 'gut', 'hervorragend'],
    es: ['genial', 'excelente', 'bueno', 'feliz', 'perfecto', 'magnífico', 'increíble'],
    it: ['ottimo', 'eccellente', 'perfetto', 'buono', 'felice', 'stupendo', 'fantastico'],
    ru: ['отлично', 'хорошо', 'супер', 'прекрасно', 'великолепно', 'радость', 'счастлив'],
    pt: ['ótimo', 'bom', 'excelente', 'perfeito', 'feliz', 'maravilhoso', 'incrível'],
    ar: ['ممتاز', 'رائع', 'جيد', 'سعيد', 'مذهل'],
    hi: ['अच्छा', 'बहुत अच्छा', 'खुश', 'उत्तम', 'प्यारा']
  };

  private multiLangNegativeWords: Record<string, string[]> = {
    zh: ['坏', '差', '糟糕', '难过', '伤心', '讨厌', '恨', '失望', '生气', '愤怒', '痛苦', '烦恼', '郁闷', '压力', '焦虑', '累', '疲惫', '不行', '失败', '错误', '不开心', '沮丧', '担心', '害怕'],
    en: ['bad', 'terrible', 'sad', 'hate', 'awful', 'horrible', 'disgusting', 'disappointed', 'angry', 'worse', 'worst', 'upset', 'frustrated', 'annoyed'],
    ja: ['悪い', '嫌い', '悲しい', 'つらい', '最悪', 'ひどい', 'がっかり', '怒る'],
    ko: ['나쁘다', '싫다', '슬프다', '화나다', '실망'],
    fr: ['mauvais', 'terrible', 'triste', 'déteste', 'affreux', 'horrible'],
    de: ['schlecht', 'schrecklich', 'traurig', 'hässlich', 'furchtbar', 'fürchterlich'],
    es: ['malo', 'terrible', 'triste', 'odio', 'horrible', 'pésimo'],
    it: ['cattivo', 'terribile', 'triste', 'orribile', 'pessimo'],
    ru: ['плохо', 'ужасно', 'грустно', 'ненавижу', 'ужасный'],
    pt: ['ruim', 'terrível', 'triste', 'ódio', 'horrível'],
    ar: ['سيء', 'مثير للاشمئزاز', 'حزين', 'رهيب'],
    hi: ['बुरा', 'भयानक', 'उदास', 'नफरत']
  };

  // === 情感强度词典（强/中/弱） ===
  private strongEmotionWords = ['超级', '极端', '非常非常', '完全', '彻底', '极其', '绝对', 'so', 'extremely', 'absolutely', 'totally', 'utterly', 'highly', 'incredibly', '真的真的', '真是太', '简直', '要死', '爆炸', '崩了'];
  private mediumEmotionWords = ['很', '非常', '特别', '真的', '挺', '比较', 'quite', 'very', 'really', 'rather', 'fairly', 'pretty', 'somewhat'];
  private weakEmotionWords = ['有点', '稍微', '略微', '一点', '一丝', 'slightly', 'a bit', 'a little', 'kind of', 'sort of'];

  processText(input: string): {
    intent: Intent;
    entities: Entity[];
    emotion: Emotion;
    language: string;
  } {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [PROCESS_START] inputLength=${input.length}`);

    const language = this.detectLanguage(input);
    const intent = this.recognizeIntent(input);
    const entities = this.extractEntities(input);
    const emotion = this.analyzeEmotion(input);

    const elapsed = Date.now() - startTime;
    console.log(`${LOG_PREFIX} [PROCESS_END] intent=${intent.name}, language=${language}, emotion=${emotion.type}, entitiesCount=${entities.length}, elapsed=${elapsed}ms`);

    return { intent, entities, emotion, language };
  }

  detectLanguage(text: string): string {
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length || 0;
    const japaneseChars = text.match(/[\u3040-\u30ff]/g)?.length || 0;
    const koreanChars = text.match(/[\uac00-\ud7af\u1100-\u11ff]/g)?.length || 0;
    const cyrillicChars = text.match(/[\u0400-\u04ff]/g)?.length || 0;
    const arabicChars = text.match(/[\u0600-\u06ff]/g)?.length || 0;
    const devanagariChars = text.match(/[\u0900-\u097f]/g)?.length || 0;

    const langScores: Record<string, number> = {
      zh: chineseChars * 1.2,
      ja: japaneseChars,
      ko: koreanChars,
      ru: cyrillicChars,
      ar: arabicChars,
      hi: devanagariChars,
      en: 0,
      fr: 0,
      de: 0,
      es: 0,
      it: 0,
      pt: 0
    };

    const commonWords: Record<string, string[]> = {
      en: ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'is', 'it', 'you', 'we', 'he', 'she', 'they', 'this', 'that', 'for', 'with', 'but', 'not', 'are', 'as', 'or', 'an', 'but', 'at', 'by', 'from', 'your', 'my', 'me'],
      fr: ['le', 'la', 'les', 'de', 'un', 'une', 'des', 'et', 'du', 'en', 'je', 'tu', 'il', 'elle', 'est', 'que', 'pour', 'dans', 'par', 'avec', 'mais', 'son', 'au', 'ce'],
      de: ['der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'ist', 'sie', 'ich', 'wir', 'du', 'er', 'nicht', 'mit', 'sich', 'auf', 'für', 'ein', 'eine', 'auch', 'dass', 'wird', 'werden'],
      es: ['el', 'la', 'los', 'las', 'de', 'y', 'en', 'un', 'una', 'que', 'es', 'son', 'yo', 'tu', 'por', 'con', 'no', 'se', 'lo', 'para', 'como', 'pero', 'más', 'pero', 'del'],
      it: ['il', 'la', 'lo', 'i', 'gli', 'le', 'di', 'e', 'in', 'un', 'è', 'sono', 'io', 'tu', 'che', 'per', 'con', 'non', 'si', 'del', 'come', 'ma', 'dalla', 'dal', 'della'],
      pt: ['o', 'a', 'os', 'as', 'de', 'e', 'em', 'um', 'uma', 'que', 'é', 'são', 'eu', 'tu', 'para', 'com', 'não', 'do', 'da', 'dos', 'das', 'no', 'na', 'mas', 'como'],
      ru: ['и', 'в', 'на', 'не', 'что', 'он', 'она', 'они', 'я', 'ты', 'вы', 'с', 'как', 'а', 'но', 'это', 'по', 'у', 'за', 'от', 'из', 'к', 'есть', 'быть', 'был']
    };

    const lowerText = text.toLowerCase();
    for (const [lang, words] of Object.entries(commonWords)) {
      for (const word of words) {
        if (lowerText.includes(` ${word} `) || lowerText.startsWith(word + ' ') || lowerText.endsWith(' ' + word)) {
          langScores[lang] += 2;
        }
      }
    }

    let maxScore = 0;
    let detectedLang = 'zh';

    for (const [lang, score] of Object.entries(langScores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedLang = lang;
      }
    }

    // 如果没有中文字符，也没有足够的欧洲语言词，就判断为英文
    if (maxScore < 1 && !/[\u4e00-\u9fa5]/.test(text)) {
      detectedLang = 'en';
    }

    return detectedLang;
  }

  recognizeIntent(text: string): Intent {
    // 使用混合模型：正则 + TF-IDF 加权融合
    return this.recognizeIntentHybrid(text);
  }

  extractEntities(text: string): Entity[] {
    const entities: Entity[] = [];

    // URL
    const urlPattern = /https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/gi;
    const urls = text.match(urlPattern);
    if (urls) {
      entities.push(...urls.map(url => ({
        name: 'url',
        value: url,
        confidence: 0.99
      })));
    }

    // Email
    const emailPattern = /[\w.-]+@[\w.-]+\.\w+/gi;
    const emails = text.match(emailPattern);
    if (emails) {
      entities.push(...emails.map(email => ({
        name: 'email',
        value: email,
        confidence: 0.99
      })));
    }

    // 日期 - 支持更多格式
    const datePattern = /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?|\d{1,2}[-/月]\d{1,2}(?:日|号)?|\d{4}[-/]\d{1,2})/g;
    const dates = text.match(datePattern);
    if (dates) {
      entities.push(...dates.map(date => ({
        name: 'date',
        value: date,
        confidence: 0.95
      })));
    }

    // 电话
    const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phones = text.match(phonePattern);
    if (phones) {
      entities.push(...phones.map(phone => ({
        name: 'phone',
        value: phone,
        confidence: 0.9
      })));
    }

    // 时间
    const timePattern = /(\d{1,2}[:：]\d{2}(?:[:：]\d{2})?\s*(?:am|pm|AM|PM|上午|下午|早上|晚上|中午)?)/g;
    const times = text.match(timePattern);
    if (times) {
      entities.push(...times.map(time => ({
        name: 'time',
        value: time,
        confidence: 0.92
      })));
    }

    // 数字
    const numberPattern = /\b\d+(?:\.\d+)?\b/g;
    const numbers = text.match(numberPattern);
    if (numbers) {
      entities.push(...numbers.map(num => ({
        name: 'number',
        value: num,
        confidence: 0.95
      })));
    }

    // 货币金额 - 更全面
    const currencyPattern = /(?:\$|€|£|¥|￥|元|RMB|人民币)\s?\d+(?:\.\d+)?|\d+(?:\.\d+)?\s?(?:\$|€|£|¥|￥|元|块钱|美元|欧元|日元|英镑|dollars?|euros?|pounds?)/gi;
    const currencies = text.match(currencyPattern);
    if (currencies) {
      entities.push(...currencies.map(cur => ({
        name: 'currency',
        value: cur,
        confidence: 0.93
      })));
    }

    // 位置
    const locationPatterns = [
      { name: 'country', pattern: /(中国|美国|日本|英国|法国|德国|韩国|意大利|西班牙|加拿大|加拿大|Russia|Russia|India|Brazil|Australia|Canada|USA|UK|Japan|France|Germany|Russia|India)/gi, confidence: 0.9 },
      { name: 'city', pattern: /(北京|上海|广州|深圳|杭州|成都|重庆|武汉|南京|西安|苏州|天津|长沙|青岛|郑州|东莞|厦门|Tokyo|London|Paris|New York|Berlin|Seoul|Osaka|Beijing|Shanghai|Shenzhen)/gi, confidence: 0.87 },
    ];

    for (const loc of locationPatterns) {
      const matches = text.match(loc.pattern);
      if (matches) {
        entities.push(...matches.map(match => ({
          name: loc.name,
          value: match,
          confidence: loc.confidence
        })));
      }
    }

    // 编程语言
    const programmingLangPattern = /(Python|JavaScript|Java|TypeScript|Go|Golang|Rust|C\+\+|C#|PHP|Ruby|Swift|Kotlin|Scala|Dart|Lua|Shell|Bash|SQL|Node\.js|React|Vue|Angular|HTML|CSS|jQuery)/gi;
    const progLangs = text.match(programmingLangPattern);
    if (progLangs) {
      entities.push(...progLangs.map(lang => ({
        name: 'programming_language',
        value: lang,
        confidence: 0.94
      })));
    }

    // 文件
    const fileExtensionPattern = /\b\w+\.(txt|pdf|doc|docx|xls|xlsx|csv|json|xml|html|css|js|py|java|go|rs|ts|tsx|jsx|md|png|jpg|jpeg|gif|zip|rar|7z|exe|app|mp3|mp4|avi|mov|wav|flac|docx?|xlsx?|pptx?)/gi;
    const files = text.match(fileExtensionPattern);
    if (files) {
      entities.push(...files.map(file => ({
        name: 'file',
        value: file,
        confidence: 0.91
      })));
    }

    // 人/角色
    const personPattern = /(先生|女士|老师|医生|教授|工程师|设计师|产品经理|CEO|CTO|CFO|COO|总裁|总经理|经理|总监|同事|朋友|同学|学生|用户|客户)/g;
    const persons = text.match(personPattern);
    if (persons) {
      entities.push(...persons.map(person => ({
        name: 'person',
        value: person,
        confidence: 0.85
      })));
    }

    // 主题关键词
    const topicPatterns = [
      { name: 'topic_tech', pattern: /(人工智能|AI|机器学习|深度学习|区块链|云计算|大数据|物联网|5G|VR|AR|元宇宙|科技|技术|互联网|软件|硬件|芯片|半导体|神经网络|算法|数据)/gi, confidence: 0.88 },
      { name: 'topic_health', pattern: /(健康|减肥|健身|运动|锻炼|饮食|营养|睡眠|养生|医疗|疾病|医院|医生|药品|中医|瑜伽|跑步)/gi, confidence: 0.87 },
      { name: 'topic_study', pattern: /(学习|教育|学校|大学|考试|课程|作业|老师|学生|知识|读书|培训|研究|论文|考研|留学|高考|中考)/gi, confidence: 0.88 },
      { name: 'topic_work', pattern: /(工作|职场|职业|面试|简历|薪水|工资|晋升|创业|公司|企业|团队|管理|项目|业务|产品|招聘)/gi, confidence: 0.85 },
      { name: 'topic_life', pattern: /(生活|生活方式|美食|旅游|旅行|电影|音乐|游戏|书籍|阅读|兴趣|爱好|娱乐|休闲|购物|购物)/gi, confidence: 0.84 },
    ];

    for (const topic of topicPatterns) {
      const matches = text.match(topic.pattern);
      if (matches) {
        entities.push(...matches.slice(0, 3).map(match => ({
          name: topic.name,
          value: match,
          confidence: topic.confidence
        })));
      }
    }

    // 去重 - 相同name和value的实体只保留一个
    const seen = new Set<string>();
    const uniqueEntities: Entity[] = [];
    for (const entity of entities) {
      const key = `${entity.name}|${entity.value}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueEntities.push(entity);
      }
    }

    return uniqueEntities;
  }

  analyzeEmotion(text: string): Emotion {
    const positiveWords = [
      '好', '棒', '优秀', '开心', '高兴', '喜欢', '爱',
      'wonderful', 'great', 'good', 'happy', 'love', 'excellent', 'amazing',
      '愉快', '快乐', '兴奋', '满足', '感激', '感谢', '赞', '真棒',
      'perfect', 'awesome', 'fantastic', 'brilliant', 'superb', 'nice',
      '满意', '幸福', '舒服', '有趣', '精彩', '优秀', '不错', '可以',
      '喜欢', '满意', '真好', '太好了', '太棒了', '厉害', '成功', '解决'
    ];
    const negativeWords = [
      '坏', '差', '糟糕', '难过', '伤心', '讨厌', '恨',
      'bad', 'terrible', 'sad', 'hate', 'awful', 'horrible',
      '失望', '生气', '愤怒', '痛苦', '烦恼', '郁闷', '恶心',
      'horrible', 'disgusting', 'awful', 'terrible', 'disappointed', 'angry',
      '压力', '焦虑', '累', '疲惫', '不行', '失败', '错误', '问题',
      '不开心', '难过', '伤心', '沮丧', '失望', '担心', '害怕', '恐惧'
    ];

    const lowerText = text.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of positiveWords) {
      if (lowerText.includes(word.toLowerCase())) {
        positiveCount++;
      }
    }

    for (const word of negativeWords) {
      if (lowerText.includes(word.toLowerCase())) {
        negativeCount++;
      }
    }

    // 检测情感强化词
    const amplifiers = ['非常', '特别', '超级', '真的', '真', '很', '太', 'so', 'very', 'really', 'extremely'];
    let amplification = 1.0;
    for (const amp of amplifiers) {
      if (lowerText.includes(amp)) {
        amplification += 0.2;
      }
    }

    const total = positiveCount + negativeCount;

    if (total === 0) {
      return { type: 'neutral', confidence: 0.7 };
    }

    const adjustedPositive = positiveCount * amplification;
    const adjustedNegative = negativeCount * amplification;

    if (adjustedPositive > adjustedNegative) {
      return {
        type: 'positive',
        confidence: Math.min(adjustedPositive / (adjustedPositive + adjustedNegative), 0.95)
      };
    } else if (adjustedNegative > adjustedPositive) {
      return {
        type: 'negative',
        confidence: Math.min(adjustedNegative / (adjustedPositive + adjustedNegative), 0.95)
      };
    }

    return { type: 'neutral', confidence: 0.65 };
  }

  validateInput(input: unknown): { valid: boolean; error?: string } {
    if (input === null || input === undefined) {
      return { valid: false, error: 'Input cannot be null' };
    }

    if (typeof input !== 'string') {
      return { valid: false, error: 'Input must be a string' };
    }

    if (input.trim().length === 0) {
      return { valid: false, error: 'Input cannot be empty' };
    }

    if (input.length > 10000) {
      return { valid: false, error: 'Input exceeds maximum length' };
    }

    // 检测潜在的安全问题
    const dangerousPatterns = [
      /<script[^>]*>.*<\/script>/gi, // XSS
      /javascript:/gi, // javascript协议
      /eval\s*\(/gi, // eval调用
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(input)) {
        console.warn(`${LOG_PREFIX} [SECURITY_WARNING] Potentially dangerous input detected`);
        // 不拒绝，但记录警告 - 在实际系统中可以更严格
      }
    }

    return { valid: true };
  }

  // === 增强：上下文感知的意图识别 ===
  recognizeIntentWithContext(text: string, context: string[] = []): {
    intent: string;
    confidence: number;
    adjustments: string[];
    baseIntent: string;
    weightedScore: number;
  } {
    const baseIntent = this.recognizeIntent(text);
    const adjustments: string[] = [];
    let finalConfidence = baseIntent.confidence;
    let finalName = baseIntent.name;

    if (context.length > 0) {
      const contextStr = context.join(' ').toLowerCase();

      if (contextStr.includes('代码') || contextStr.includes('编程') || /code|programming|python|javascript/i.test(contextStr)) {
        if (baseIntent.name === 'question' || baseIntent.name === 'unknown') {
          finalName = 'code_question';
          finalConfidence = Math.max(finalConfidence, 0.82);
          adjustments.push('context_programming_boost');
        }
      }

      if (/旅行|旅游|出行|机票|航班|酒店|travel|flight|hotel|trip/i.test(contextStr)) {
        if (baseIntent.name === 'question' || baseIntent.name === 'unknown' || baseIntent.name === 'search') {
          finalName = 'travel';
          finalConfidence = Math.max(finalConfidence, 0.78);
          adjustments.push('context_travel_boost');
        }
      }

      if (/天气|下雨|温度|weather|temperature|climate/i.test(contextStr)) {
        if (baseIntent.name === 'question') {
          finalName = 'weather';
          finalConfidence = Math.max(finalConfidence, 0.8);
          adjustments.push('context_weather_boost');
        }
      }

      if (/股票|基金|理财|投资|股价|stock|finance|investment/i.test(contextStr)) {
        if (baseIntent.name === 'question' || baseIntent.name === 'search') {
          finalName = 'finance';
          finalConfidence = Math.max(finalConfidence, 0.78);
          adjustments.push('context_finance_boost');
        }
      }

      if (/写|写作|邮件|文章|write|email|article|essay/i.test(contextStr)) {
        if (baseIntent.name === 'question' || baseIntent.name === 'search') {
          finalName = 'write';
          finalConfidence = Math.max(finalConfidence, 0.75);
          adjustments.push('context_write_boost');
        }
      }

      if (/分析|analyze|research|研究|数据/i.test(contextStr)) {
        if (baseIntent.name === 'question' || baseIntent.name === 'search') {
          finalName = 'analyze';
          finalConfidence = Math.max(finalConfidence, 0.78);
          adjustments.push('context_analyze_boost');
        }
      }

      if (/调试|debug|修复|错误|bug|error|问题|出问题/i.test(contextStr)) {
        if (baseIntent.name === 'question' || baseIntent.name === 'code_question') {
          finalName = 'debug';
          finalConfidence = Math.max(finalConfidence, 0.8);
          adjustments.push('context_debug_boost');
        }
      }

      if (/解释|说明|explain|interpret|含义|什么意思/i.test(contextStr)) {
        if (baseIntent.name === 'question' || baseIntent.name === 'unknown') {
          finalName = 'explain';
          finalConfidence = Math.max(finalConfidence, 0.78);
          adjustments.push('context_explain_boost');
        }
      }

      if (/总结|概括|summary|summarize|概述/i.test(contextStr)) {
        if (baseIntent.name === 'question' || baseIntent.name === 'search') {
          finalName = 'summarize';
          finalConfidence = Math.max(finalConfidence, 0.8);
          adjustments.push('context_summarize_boost');
        }
      }

      const lastContext = context[context.length - 1];
      if (lastContext) {
        const emotionInContext = this.analyzeEmotion(lastContext);
        if (emotionInContext.type === 'positive' && baseIntent.confidence < 0.7) {
          adjustments.push('context_positive_emotion_weight');
          finalConfidence = Math.max(finalConfidence, 0.7);
        }
        if (emotionInContext.type === 'negative' && baseIntent.confidence < 0.7) {
          adjustments.push('context_negative_emotion_weight');
        }
      }
    }

    const currentState = this.getCurrentDialogState();
    if (currentState) {
      if (currentState.state === 'awaiting_confirmation' && baseIntent.name === 'unknown') {
        finalName = 'confirm';
        finalConfidence = 0.75;
        adjustments.push('dialog_waiting_confirmation');
      }
      if (currentState.state === 'awaiting_slot_fill' && baseIntent.name === 'unknown') {
        finalName = currentState.intent;
        finalConfidence = 0.65;
        adjustments.push(`dialog_slot_fill_${currentState.intent}`);
      }
    }

    const hasQuestionMark = /[?？]/.test(text);
    const startsWithQuestion = /^(为什么|怎么|如何|怎样|是什么|什么|谁|哪里|哪个|多少|how|why|what|where|who|which|when)/i.test(text.trim());
    if (hasQuestionMark && finalName === 'unknown') {
      finalName = 'question';
      finalConfidence = 0.6;
      adjustments.push('question_mark_fallback');
    } else if (startsWithQuestion && finalName === 'unknown') {
      finalName = 'question';
      finalConfidence = 0.65;
      adjustments.push('question_prefix_fallback');
    }

    return {
      intent: finalName,
      confidence: finalConfidence,
      adjustments,
      baseIntent: baseIntent.name,
      weightedScore: finalConfidence
    };
  }

  // === 新增功能：输入规范化 ===
  normalizeInput(text: string): string {
    let normalized = text.trim();

    normalized = normalized.replace(/[，]/g, '，')
      .replace(/[。]/g, '。')
      .replace(/[！!]/g, '！')
      .replace(/[？?]/g, '？');

    normalized = normalized.replace(/\s+/g, ' ');
    normalized = normalized.replace(/^[，。！？]+|[，。！？]+$/g, '');

    return normalized.trim();
  }

  // === 增强：TF-IDF 风格关键词提取 - 私有文档频率记录 ===
  private termFrequency: Record<string, number> = {};
  private documentFrequencyMap: Record<string, number> = {};
  private documentCount = 0;

  feedDocument(text: string): void {
    this.documentCount++;
    const tokens = this.tokenizeForTfIdf(text);
    const seen = new Set<string>();
    for (const token of tokens) {
      this.termFrequency[token] = (this.termFrequency[token] || 0) + 1;
      if (!seen.has(token)) {
        seen.add(token);
        this.documentFrequencyMap[token] = (this.documentFrequencyMap[token] || 0) + 1;
      }
    }
  }

  private tokenizeForTfIdf(text: string): string[] {
    const stopWords = new Set([
      '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上',
      '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这',
      '那', '这个', '那个', '吗', '呢', '啊', '吧', '怎么', '什么', '为什么', '如何', '请问',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on',
      'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
      'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
      'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if',
      'this', 'that', 'these', 'those', 'it', 'its', 'or', 'than', 'because', 'while', 'which',
      'who', 'whom', 'he', 'she', 'they', 'we', 'you', 'i', 'me', 'my', 'your', 'our', 'their'
    ]);

    const tokens: string[] = [];

    const englishMatches = text.match(/[A-Za-z][A-Za-z0-9\-]{1,}/gi) || [];
    for (const match of englishMatches) {
      const lower = match.toLowerCase();
      if (!stopWords.has(lower) && lower.length >= 2) {
        tokens.push(lower);
      }
    }

    const chineseSegments = text.match(/[\u4e00-\u9fa5]+/g) || [];
    for (const segment of chineseSegments) {
      for (let size = 2; size <= 4; size++) {
        for (let i = 0; i + size <= segment.length; i++) {
          const gram = segment.substring(i, i + size);
          if (!stopWords.has(gram)) {
            tokens.push(gram);
          }
        }
      }
      if (segment.length === 1 && !stopWords.has(segment)) {
        tokens.push(segment);
      }
    }

    const numMatches = text.match(/\d+(?:\.\d+)?/g) || [];
    for (const m of numMatches) tokens.push(m);

    return tokens;
  }

  extractKeywordsTfIdf(text: string, maxCount: number = 10): Array<{
    word: string;
    tf: number;
    idf: number;
    score: number;
  }> {
    const tokens = this.tokenizeForTfIdf(text);
    const tfMap: Record<string, number> = {};
    const totalTokens = tokens.length || 1;
    for (const token of tokens) {
      tfMap[token] = (tfMap[token] || 0) + 1;
    }
    for (const key of Object.keys(tfMap)) {
      tfMap[key] = tfMap[key] / totalTokens;
    }

    const useHeuristic = this.documentCount === 0;
    const results: Array<{ word: string; tf: number; idf: number; score: number }> = [];

    for (const [word, tf] of Object.entries(tfMap)) {
      let idf: number;
      if (useHeuristic) {
        const baseIdf = 1.0;
        const lengthBonus = Math.min(word.length / 6, 1.5);
        const hasCapital = /[A-Z]/.test(word);
        const capitalBonus = hasCapital ? 0.5 : 0;
        const isNumber = /^\d/.test(word);
        const numberBonus = isNumber ? 0.6 : 0;
        idf = baseIdf + lengthBonus + capitalBonus + numberBonus;
      } else {
        const df = this.documentFrequencyMap[word] || 1;
        idf = Math.log((this.documentCount + 1) / (df + 1)) + 1;
      }

      let lengthBias = 1.0;
      const isChinese = /[\u4e00-\u9fa5]/.test(word);
      if (isChinese) {
        if (word.length === 2) lengthBias = 1.2;
        else if (word.length === 3) lengthBias = 1.3;
        else if (word.length === 4) lengthBias = 1.25;
        else if (word.length >= 5) lengthBias = 1.15;
      } else {
        if (word.length >= 6) lengthBias = 1.2;
        if (word.length >= 8) lengthBias = 1.3;
      }

      const score = tf * idf * lengthBias;
      results.push({ word, tf, idf, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, maxCount);
  }

  // === 增强：关键词提取（默认使用 TF-IDF 风格）===
  extractKeywords(text: string, maxCount: number = 5): string[] {
    const results = this.extractKeywordsTfIdf(text, maxCount);
    return results.map(r => r.word);
  }

  // === 新增：对话上下文追踪系统 ===
  private conversationContext: Array<{
    turn: number;
    intent: string;
    entities: Entity[];
    content: string;
    timestamp: Date;
  }> = [];
  private maxContextTurns = 10;

  // === 新增：对话状态管理 ===
  private conversationState = {
    currentTopic: '',
    topicHistory: [] as string[],
    turnCount: 0,
    userGoal: '',
    isClarifying: false,
    pendingAction: '',
    awaitingConfirmation: false,
    awaitingUserInput: false,
    lastIntent: '',
    userPreferences: {} as Record<string, string>,
    unresolvedSlots: [] as string[],
    emotionTrend: [] as string[],
    averageEmotionConfidence: 0,
    totalPositiveTurns: 0,
    totalNegativeTurns: 0,
    totalNeutralTurns: 0,
    intentHistory: [] as string[],
    consecutiveUnknownIntent: 0
  };

  // === 对话状态机：等待状态 ===
  private dialogStateStack: Array<{
    state: 'awaiting_confirmation' | 'awaiting_clarification' | 'awaiting_details' | 'awaiting_slot_fill' | 'idle';
    intent: string;
    requiredInfo: string[];
    timestamp: Date;
    originalInput: string;
  }> = [];

  // 更新对话上下文
  updateConversationContext(intent: Intent, content: string): void {
    this.conversationState.turnCount++;
    
    this.conversationContext.push({
      turn: this.conversationState.turnCount,
      intent: intent.name,
      entities: intent.entities || [],
      content,
      timestamp: new Date()
    });

    // 保持上下文大小限制
    if (this.conversationContext.length > this.maxContextTurns) {
      this.conversationContext.shift();
    }

    // 检测主题变化
    const keywords = this.extractKeywords(content, 3);
    if (keywords.length > 0) {
      const newTopic = keywords[0];
      if (this.conversationState.currentTopic !== newTopic) {
        this.conversationState.topicHistory.push(this.conversationState.currentTopic);
        this.conversationState.currentTopic = newTopic;
      }
    }

    // 更新意图历史与统计
    this.conversationState.lastIntent = intent.name;
    this.conversationState.intentHistory.push(intent.name);
    if (this.conversationState.intentHistory.length > 20) {
      this.conversationState.intentHistory.shift();
    }

    if (intent.name === 'unknown') {
      this.conversationState.consecutiveUnknownIntent++;
    } else {
      this.conversationState.consecutiveUnknownIntent = 0;
    }

    // 更新情感趋势统计
    const emotion = this.analyzeEmotion(content);
    this.conversationState.emotionTrend.push(emotion.type);
    if (this.conversationState.emotionTrend.length > 10) {
      this.conversationState.emotionTrend.shift();
    }
    const recent = this.conversationState.emotionTrend;
    this.conversationState.averageEmotionConfidence =
      (this.conversationState.averageEmotionConfidence * (recent.length - 1) + emotion.confidence) / recent.length;
    if (emotion.type === 'positive') this.conversationState.totalPositiveTurns++;
    else if (emotion.type === 'negative') this.conversationState.totalNegativeTurns++;
    else this.conversationState.totalNeutralTurns++;

    // 检测是否需要用户确认/澄清
    if (this.conversationState.consecutiveUnknownIntent >= 2) {
      this.conversationState.isClarifying = true;
    }

    // 状态机更新
    if (intent.name === 'question' && keywords.length === 0) {
      this.conversationState.awaitingUserInput = true;
    }

    console.log(`${LOG_PREFIX} [CONTEXT_UPDATED] turn=${this.conversationState.turnCount}, topic=${this.conversationState.currentTopic}, intent=${intent.name}`);
  }

  // === 对话状态推送/弹出 ===
  pushDialogState(state: 'awaiting_confirmation' | 'awaiting_clarification' | 'awaiting_details' | 'awaiting_slot_fill' | 'idle', intent: string, requiredInfo: string[] = [], originalInput: string = ''): void {
    this.dialogStateStack.push({
      state,
      intent,
      requiredInfo,
      timestamp: new Date(),
      originalInput
    });
    this.conversationState.awaitingConfirmation = state === 'awaiting_confirmation';
    this.conversationState.isClarifying = state === 'awaiting_clarification';
    console.log(`${LOG_PREFIX} [DIALOG_STATE_PUSHED] state=${state}, intent=${intent}`);
  }

  popDialogState(): { state: string; intent: string; requiredInfo: string[] } | null {
    const popped = this.dialogStateStack.pop();
    if (popped) {
      this.conversationState.awaitingConfirmation = false;
      this.conversationState.isClarifying = false;
      return { state: popped.state, intent: popped.intent, requiredInfo: popped.requiredInfo };
    }
    return null;
  }

  getCurrentDialogState(): { state: string; intent: string; requiredInfo: string[] } | null {
    const top = this.dialogStateStack[this.dialogStateStack.length - 1];
    if (top) {
      return { state: top.state, intent: top.intent, requiredInfo: top.requiredInfo };
    }
    return null;
  }

  getDialogSummary(): {
    totalTurns: number;
    currentTopic: string;
    topicHistory: string[];
    lastIntent: string;
    awaitingConfirmation: boolean;
    isClarifying: boolean;
    emotionTrend: string[];
    positiveRate: number;
    negativeRate: number;
    consecutiveUnknown: number;
  } {
    const total = this.conversationState.totalPositiveTurns + this.conversationState.totalNegativeTurns + this.conversationState.totalNeutralTurns;
    return {
      totalTurns: this.conversationState.turnCount,
      currentTopic: this.conversationState.currentTopic,
      topicHistory: this.conversationState.topicHistory.slice(-5),
      lastIntent: this.conversationState.lastIntent,
      awaitingConfirmation: this.conversationState.awaitingConfirmation,
      isClarifying: this.conversationState.isClarifying,
      emotionTrend: this.conversationState.emotionTrend.slice(-5),
      positiveRate: total > 0 ? this.conversationState.totalPositiveTurns / total : 0,
      negativeRate: total > 0 ? this.conversationState.totalNegativeTurns / total : 0,
      consecutiveUnknown: this.conversationState.consecutiveUnknownIntent
    };
  }

  // 获取对话摘要
  getConversationSummary(): {
    topic: string;
    turnCount: number;
    recentIntents: string[];
    keyEntities: Entity[];
  } {
    const recentIntents = this.conversationContext
      .slice(-5)
      .map(c => c.intent);
    
    const keyEntities: Entity[] = [];
    const entitySet = new Set<string>();
    
    for (const ctx of this.conversationContext.slice(-5)) {
      for (const entity of ctx.entities) {
        const key = `${entity.name}|${entity.value}`;
        if (!entitySet.has(key)) {
          entitySet.add(key);
          keyEntities.push(entity);
        }
      }
    }

    return {
      topic: this.conversationState.currentTopic,
      turnCount: this.conversationState.turnCount,
      recentIntents,
      keyEntities: keyEntities.slice(0, 5)
    };
  }

  // 检测是否需要澄清
  needsClarification(input: string): boolean {
    const vaguePatterns = [
      /^(那个|这个|它|那个|那个东西)$/,
      /^(.{0,3})$/,
      /(不明白|不确定|不知道|不太清楚)/,
    ];
    
    return vaguePatterns.some(p => p.test(input.trim()));
  }

  // 生成澄清问题
  generateClarificationQuestion(): string {
    const questions = [
      '您能具体说明一下您想了解什么吗？',
      '请问您指的是哪个方面呢？',
      '您能提供更多细节吗？',
      '请问您的具体问题是什么？',
      '您想了解哪方面的信息？'
    ];
    return questions[Math.floor(Math.random() * questions.length)];
  }

  // === 新增：高级实体提取 - 复合实体识别 ===
  extractAdvancedEntities(text: string): {
    basicEntities: Entity[];
    compoundEntities: Array<{
      type: string;
      components: Entity[];
      confidence: number;
      rawText?: string;
    }>;
  } {
    const basicEntities = this.extractEntities(text);
    const compoundEntities: Array<{
      type: string;
      components: Entity[];
      confidence: number;
      rawText?: string;
    }> = [];

    // 检测"日期+时间"复合实体
    const dates = basicEntities.filter(e => e.name === 'date');
    const times = basicEntities.filter(e => e.name === 'time');
    if (dates.length > 0 && times.length > 0) {
      compoundEntities.push({
        type: 'datetime',
        components: [dates[0], times[0]],
        confidence: 0.9
      });
    }

    // 检测"位置+时间"复合实体
    const cities = basicEntities.filter(e => e.name === 'city');
    const countries = basicEntities.filter(e => e.name === 'country');
    if ((cities.length > 0 || countries.length > 0) && times.length > 0) {
      compoundEntities.push({
        type: 'location_time',
        components: [...cities.slice(0, 1), ...countries.slice(0, 1), times[0]],
        confidence: 0.85
      });
    }

    // 检测"人名+职位"复合实体
    const persons = basicEntities.filter(e => e.name === 'person');
    if (persons.length >= 2) {
      compoundEntities.push({
        type: 'person_with_role',
        components: persons.slice(0, 2),
        confidence: 0.8
      });
    }

    // 检测"金额+货币"
    const currencies = basicEntities.filter(e => e.name === 'currency');
    const numbers = basicEntities.filter(e => e.name === 'number');
    if (currencies.length > 0 && numbers.length > 0) {
      compoundEntities.push({
        type: 'monetary_amount',
        components: [currencies[0], numbers[0]],
        confidence: 0.88
      });
    }

    // === 新增：源城市+目标城市+交通方式（航班/行程）===
    const travelRegex = /(从|在|from)\s*([\u4e00-\u9fa5A-Za-z]+)\s*(到|去|至|前往|to|towards)\s*([\u4e00-\u9fa5A-Za-z]+)/i;
    const travelMatch = text.match(travelRegex);
    if (travelMatch && travelMatch.length >= 5) {
      const sourceCity: Entity = { name: 'source_city', value: travelMatch[2], confidence: 0.85 };
      const targetCity: Entity = { name: 'target_city', value: travelMatch[4], confidence: 0.85 };
      const transportMode = this.detectTransportMode(text);
      const components: Entity[] = transportMode
        ? [sourceCity, targetCity, { name: 'transport', value: transportMode, confidence: 0.85 }]
        : [sourceCity, targetCity];
      compoundEntities.push({
        type: 'travel_route',
        components,
        confidence: 0.87,
        rawText: travelMatch[0]
      });
    }

    // === 新增：A到B的航班 ===
    const flightRegex = /([\u4e00-\u9fa5A-Za-z]{2,})\s*(到|飞|至|去|to)\s*([\u4e00-\u9fa5A-Za-z]{2,})\s*(的)?\s*(航班|机票|飞机|flight|ticket)/i;
    const flightMatch = text.match(flightRegex);
    if (flightMatch && flightMatch.length >= 4) {
      const sourceCity: Entity = { name: 'source_city', value: flightMatch[1], confidence: 0.88 };
      const targetCity: Entity = { name: 'target_city', value: flightMatch[3], confidence: 0.88 };
      const transportEntity: Entity = { name: 'transport', value: 'flight', confidence: 0.9 };
      compoundEntities.push({
        type: 'flight_itinerary',
        components: [sourceCity, targetCity, transportEntity],
        confidence: 0.9,
        rawText: flightMatch[0]
      });
    }

    // === 新增：人名+时间（会议邀请等）===
    if (persons.length > 0 && times.length > 0) {
      compoundEntities.push({
        type: 'person_schedule',
        components: [persons[0], times[0]],
        confidence: 0.82
      });
    }

    // === 新增：商品+数量（购物请求）===
    const productRegex = /(买|购买|下单|订购|订|buy|order|purchase)\s*(\d+|几|一|两|三|四|五|六|七|八|九|十)?\s*(个|件|份|本|瓶|盒)?\s*([\u4e00-\u9fa5A-Za-z0-9]+)/i;
    const productMatch = text.match(productRegex);
    if (productMatch) {
      const quantity = productMatch[2];
      const productName = productMatch[4];
      const components: Entity[] = [];
      if (quantity) {
        components.push({ name: 'quantity', value: quantity, confidence: 0.85 });
      }
      if (productName) {
        components.push({ name: 'product', value: productName, confidence: 0.8 });
      }
      if (components.length > 1) {
        compoundEntities.push({
          type: 'product_request',
          components,
          confidence: 0.83,
          rawText: productMatch[0]
        });
      }
    }

    // === 新增：代码+语言 ===
    const progLangs = basicEntities.filter(e => e.name === 'programming_language');
    if (progLangs.length > 0) {
      compoundEntities.push({
        type: 'code_language',
        components: progLangs.slice(0, 2),
        confidence: 0.86
      });
    }

    // === 新增：URL+上下文 ===
    const urls = basicEntities.filter(e => e.name === 'url');
    if (urls.length > 0) {
      const emails = basicEntities.filter(e => e.name === 'email');
      compoundEntities.push({
        type: 'web_resource',
        components: [urls[0], ...emails.slice(0, 1)],
        confidence: 0.9
      });
    }

    return { basicEntities, compoundEntities };
  }

  private detectTransportMode(text: string): string | null {
    const lower = text.toLowerCase();
    if (/航班|飞机|机票|flight|airplane|plane|aviation/.test(lower)) return 'flight';
    if (/高铁|动车|火车|铁路|train|railway|rail/.test(lower)) return 'train';
    if (/巴士|公交|大巴|bus|coach/.test(lower)) return 'bus';
    if (/地铁|subway|metro|underground/.test(lower)) return 'subway';
    if (/汽车|自驾|开车|car|drive|auto/.test(lower)) return 'car';
    if (/出租|打车|taxi|cab|uber|滴滴/.test(lower)) return 'taxi';
    if (/步行|走路|walk|on foot/.test(lower)) return 'walk';
    if (/自行车|单车|bicycle|bike/.test(lower)) return 'bicycle';
    if (/船|游轮|游轮|ferry|ship|boat|cruise/.test(lower)) return 'ship';
    return null;
  }

  // === 新增：实体槽位填充检测 ===
  detectMissingSlots(intent: string, entities: Entity[]): string[] {
    const slotRules: Record<string, string[]> = {
      'travel_route': ['source_city', 'target_city'],
      'flight_itinerary': ['source_city', 'target_city'],
      'book': ['target_city', 'date'],
      'weather': ['city', 'date'],
      'finance': ['topic', 'date'],
      'product_request': ['product', 'quantity'],
      'code_question': ['programming_language'],
      'calculate': ['number'],
      'search': ['topic'],
      'translate': ['target_language']
    };

    const required = slotRules[intent] || [];
    const entityNames = new Set(entities.map(e => e.name));
    const missing: string[] = [];
    for (const slot of required) {
      if (!entityNames.has(slot)) {
        missing.push(slot);
      }
    }
    return missing;
  }

  // === 增强：意图预测 - 基于历史和上下文预测下一个意图 ===
  predictNextIntent(): {
    predictedIntent: string;
    confidence: number;
    alternatives: string[];
    reasoning: string[];
  } {
    const recentIntents = this.conversationContext
      .slice(-5)
      .map(c => c.intent);

    const reasoning: string[] = [];

    if (recentIntents.length === 0) {
      reasoning.push('no_history');
      return {
        predictedIntent: 'unknown',
        confidence: 0.3,
        alternatives: ['question', 'greeting'],
        reasoning
      };
    }

    // === 对话状态机：等待确认 ===
    const currentState = this.getCurrentDialogState();
    if (currentState) {
      reasoning.push(`state_${currentState.state}`);
      if (currentState.state === 'awaiting_confirmation') {
        return {
          predictedIntent: 'confirm',
          confidence: 0.85,
          alternatives: ['deny', 'question'],
          reasoning
        };
      }
      if (currentState.state === 'awaiting_clarification') {
        return {
          predictedIntent: 'question',
          confidence: 0.7,
          alternatives: ['explain', 'search'],
          reasoning
        };
      }
      if (currentState.state === 'awaiting_slot_fill') {
        return {
          predictedIntent: currentState.intent,
          confidence: 0.75,
          alternatives: ['question'],
          reasoning
        };
      }
    }

    // === 序列模式匹配（更丰富）===
    const patterns: Record<string, { next: string; confidence: number }[]> = {
      'greeting': [{ next: 'question', confidence: 0.7 }, { next: 'help', confidence: 0.2 }, { next: 'search', confidence: 0.15 }],
      'question': [{ next: 'analyze', confidence: 0.4 }, { next: 'explain', confidence: 0.3 }, { next: 'search', confidence: 0.25 }, { next: 'summarize', confidence: 0.2 }],
      'search': [{ next: 'summarize', confidence: 0.5 }, { next: 'analyze', confidence: 0.3 }, { next: 'question', confidence: 0.2 }],
      'analyze': [{ next: 'explain', confidence: 0.4 }, { next: 'question', confidence: 0.3 }, { next: 'summarize', confidence: 0.25 }],
      'explain': [{ next: 'question', confidence: 0.4 }, { next: 'thanks', confidence: 0.3 }, { next: 'search', confidence: 0.2 }],
      'complain': [{ next: 'clarify', confidence: 0.5 }, { next: 'question', confidence: 0.3 }, { next: 'stop', confidence: 0.2 }],
      'code_question': [{ next: 'debug', confidence: 0.4 }, { next: 'optimize', confidence: 0.3 }, { next: 'explain', confidence: 0.25 }],
      'clarify': [{ next: 'question', confidence: 0.5 }, { next: 'explain', confidence: 0.3 }],
      'confirm': [{ next: 'search', confidence: 0.4 }, { next: 'analyze', confidence: 0.3 }, { next: 'thanks', confidence: 0.2 }],
      'deny': [{ next: 'question', confidence: 0.5 }, { next: 'clarify', confidence: 0.3 }, { next: 'stop', confidence: 0.2 }],
      'help': [{ next: 'question', confidence: 0.6 }, { next: 'search', confidence: 0.3 }],
      'thanks': [{ next: 'goodbye', confidence: 0.6 }, { next: 'question', confidence: 0.3 }],
      'travel': [{ next: 'book', confidence: 0.5 }, { next: 'search', confidence: 0.3 }, { next: 'weather', confidence: 0.25 }],
      'book': [{ next: 'confirm', confidence: 0.6 }, { next: 'question', confidence: 0.3 }],
      'weather': [{ next: 'travel', confidence: 0.35 }, { next: 'question', confidence: 0.3 }],
      'write': [{ next: 'summarize', confidence: 0.35 }, { next: 'optimize', confidence: 0.3 }, { next: 'question', confidence: 0.25 }],
      'summarize': [{ next: 'question', confidence: 0.4 }, { next: 'thanks', confidence: 0.3 }],
      'calculate': [{ next: 'question', confidence: 0.4 }, { next: 'analyze', confidence: 0.3 }],
      'debug': [{ next: 'optimize', confidence: 0.4 }, { next: 'explain', confidence: 0.3 }, { next: 'question', confidence: 0.25 }],
      'optimize': [{ next: 'question', confidence: 0.35 }, { next: 'thanks', confidence: 0.3 }],
      'food': [{ next: 'book', confidence: 0.4 }, { next: 'question', confidence: 0.3 }],
      'music': [{ next: 'search', confidence: 0.4 }, { next: 'question', confidence: 0.3 }],
      'movie': [{ next: 'search', confidence: 0.4 }, { next: 'question', confidence: 0.3 }],
      'sport': [{ next: 'search', confidence: 0.4 }, { next: 'question', confidence: 0.3 }],
      'finance': [{ next: 'analyze', confidence: 0.45 }, { next: 'search', confidence: 0.3 }],
      'emotion_positive': [{ next: 'thanks', confidence: 0.4 }, { next: 'question', confidence: 0.3 }],
      'emotion_negative': [{ next: 'clarify', confidence: 0.5 }, { next: 'complain', confidence: 0.3 }],
      'stop': [{ next: 'goodbye', confidence: 0.55 }, { next: 'question', confidence: 0.3 }],
      'repeat': [{ next: 'question', confidence: 0.45 }, { next: 'explain', confidence: 0.3 }],
      'goodbye': [{ next: 'greeting', confidence: 0.5 }, { next: 'question', confidence: 0.3 }],
      'unknown': [{ next: 'question', confidence: 0.35 }, { next: 'clarify', confidence: 0.3 }, { next: 'search', confidence: 0.25 }]
    };

    // === 双意图序列提升准确度 ===
    const lastIntent = recentIntents[recentIntents.length - 1];
    const secondLastIntent = recentIntents.length >= 2 ? recentIntents[recentIntents.length - 2] : '';
    reasoning.push(`last_intent_${lastIntent}`);
    if (secondLastIntent) reasoning.push(`previous_intent_${secondLastIntent}`);

    // === 主题连续性检测：如果最近主题一致，提升相关意图概率 ===
    if (this.conversationState.currentTopic && this.conversationState.topicHistory.length > 0) {
      const lastTopic = this.conversationState.topicHistory[this.conversationState.topicHistory.length - 1];
      if (lastTopic && lastTopic === this.conversationState.currentTopic) {
        reasoning.push('topic_continuity');
      }
    }

    // === 情感趋势：消极情感上升则可能是 complain/stop ===
    if (this.conversationState.totalNegativeTurns >= 2 &&
        this.conversationState.totalNegativeTurns > this.conversationState.totalPositiveTurns) {
      reasoning.push('negative_emotion_trend');
      return {
        predictedIntent: 'complain',
        confidence: 0.55,
        alternatives: ['clarify', 'stop'],
        reasoning
      };
    }

    const pattern = patterns[lastIntent];

    if (pattern) {
      return {
        predictedIntent: pattern[0].next,
        confidence: pattern[0].confidence,
        alternatives: pattern.slice(1).map(p => p.next),
        reasoning
      };
    }

    reasoning.push('fallback_generic');
    return {
      predictedIntent: 'question',
      confidence: 0.4,
      alternatives: ['search', 'explain'],
      reasoning
    };
  }

  // === 增强：情感强度分析 ===
  analyzeEmotionIntensity(text: string): {
    type: string;
    confidence: number;
    intensity: number;
    intensityLevel: 'weak' | 'moderate' | 'strong';
    emotions: Record<string, number>;
    detectedKeywords: string[];
    amplifiers: string[];
  } {
    const emotionKeywords: Record<string, string[]> = {
      joy: ['开心', '高兴', '快乐', '愉快', '兴奋', '满足', 'happy', 'joyful', 'excited', 'great', 'wonderful', 'awesome', '喜欢', '爱', 'fantastic', 'perfect'],
      anger: ['生气', '愤怒', '恼火', 'angry', 'furious', 'mad', '讨厌', '烦', '糟糕', 'terrible', 'horrible', '气人', '气死', '发怒'],
      sadness: ['难过', '伤心', '失望', 'sad', 'disappointed', 'depressed', '沮丧', '郁闷', '悲伤', '失落', '哭', 'sorrow'],
      fear: ['害怕', '恐惧', '担心', '焦虑', 'fear', 'afraid', 'worried', 'anxious', 'scared', '紧张', 'nervous', 'panic'],
      surprise: ['惊讶', '惊喜', 'surprised', 'amazing', 'shocked', 'unexpected', '哇', '哦', '天哪'],
      trust: ['相信', '信任', 'trust', 'believe', 'confident', '可靠', '放心', '靠谱'],
      disgust: ['恶心', '讨厌', 'disgusting', 'gross', '反感', '厌恶', 'disgust'],
      anticipation: ['期待', '希望', 'anticipate', 'looking forward', '期望', '盼望', '期待着', '希望能']
    };

    const lowerText = text.toLowerCase();
    const emotions: Record<string, number> = {};
    const detectedKeywords: string[] = [];
    let totalMatches = 0;

    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      let count = 0;
      for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          count++;
          totalMatches++;
          detectedKeywords.push(keyword);
        }
      }
      emotions[emotion] = count;
    }

    // === 多语言情感词补充 ===
    let multiLangPositive = 0;
    let multiLangNegative = 0;
    for (const words of Object.values(this.multiLangPositiveWords)) {
      for (const w of words) {
        if (lowerText.includes(w.toLowerCase())) {
          multiLangPositive++;
          detectedKeywords.push(w);
        }
      }
    }
    for (const words of Object.values(this.multiLangNegativeWords)) {
      for (const w of words) {
        if (lowerText.includes(w.toLowerCase())) {
          multiLangNegative++;
          detectedKeywords.push(w);
        }
      }
    }

    // === 检测强度增强词 / 减弱词 ===
    const amplifiers: string[] = [];
    let amplifierFactor = 1.0;

    for (const amp of this.strongEmotionWords) {
      if (lowerText.includes(amp.toLowerCase())) {
        amplifierFactor += 0.5;
        amplifiers.push(amp);
      }
    }
    for (const amp of this.mediumEmotionWords) {
      if (lowerText.includes(amp.toLowerCase())) {
        amplifierFactor += 0.25;
        amplifiers.push(amp);
      }
    }
    for (const reducer of this.weakEmotionWords) {
      if (lowerText.includes(reducer.toLowerCase())) {
        amplifierFactor -= 0.15;
        amplifiers.push(`~${reducer}`);
      }
    }
    amplifierFactor = Math.max(0.3, Math.min(amplifierFactor, 2.5));

    // === 标点符号强度：感叹号的数量 ===
    const exclamationCount = (text.match(/[!！]/g) || []).length;
    const questionCount = (text.match(/[?？]/g) || []).length;
    amplifierFactor += exclamationCount * 0.1;
    amplifierFactor += questionCount * 0.05;

    // === 大写字母 / 全角字符（表示强烈）===
    const uppercaseMatches = text.match(/[A-Z]{3,}/g) || [];
    amplifierFactor += uppercaseMatches.length * 0.15;

    // === 最终强度计算 ===
    const rawIntensity = (totalMatches + multiLangPositive * 0.5 + multiLangNegative * 0.5) / 6;
    const intensity = Math.min(rawIntensity * amplifierFactor, 1.0);

    let intensityLevel: 'weak' | 'moderate' | 'strong' = 'moderate';
    if (intensity < 0.33) intensityLevel = 'weak';
    else if (intensity < 0.66) intensityLevel = 'moderate';
    else intensityLevel = 'strong';

    // 找到主要情感
    let dominantEmotion = 'neutral';
    let maxScore = 0;
    for (const [emotion, score] of Object.entries(emotions)) {
      if (score > maxScore) {
        maxScore = score;
        dominantEmotion = emotion;
      }
    }

    // 如果正负数相等但都是 positive/negative，择其匹配度更高者
    const baseEmotion = this.analyzeEmotion(text);
    if (dominantEmotion === 'neutral' && baseEmotion.type !== 'neutral') {
      dominantEmotion = baseEmotion.type === 'positive' ? 'joy' : 'sadness';
    }

    return {
      type: dominantEmotion,
      confidence: baseEmotion.confidence,
      intensity,
      intensityLevel,
      emotions,
      detectedKeywords: detectedKeywords.slice(0, 10),
      amplifiers
    };
  }

  // === 增强：语义角色标注 ===
  extractSemanticRoles(text: string): {
    action: string;
    agent: string;
    patient: string;
    modifiers: string[];
    locations: string[];
    temporal: string[];
    instrument: string[];
    goals: string[];
    rawRoles: Record<string, string>;
  } {
    const actionVerbs = ['搜索', '查找', '计算', '解释', '分析', '写', '创建', '优化', '调试', '学习', '翻译', '总结', '帮助', '预订', '购买', '查', '分析一下', '解释一下', 'search', 'find', 'calculate', 'explain', 'analyze', 'write', 'create', 'optimize', 'debug', 'learn', 'translate', 'summarize', 'book', 'buy', 'help', 'tell', 'show'];

    let action = '';
    let actionIdx = -1;
    const lowerText = text.toLowerCase();
    for (const verb of actionVerbs) {
      const idx = lowerText.indexOf(verb.toLowerCase());
      if (idx >= 0) {
        action = verb;
        actionIdx = idx;
        break;
      }
    }

    const agentWords = ['我', '你', '他', '她', '我们', '你们', '他们', '用户', '系统', 'I', 'you', 'he', 'she', 'we', 'they'];
    let agent = '';
    for (const word of agentWords) {
      const idx = lowerText.indexOf(word.toLowerCase());
      if (idx >= 0 && (actionIdx < 0 || idx < actionIdx)) {
        agent = word;
        break;
      }
    }

    let patient = '';
    if (action && actionIdx >= 0) {
      patient = text.substring(actionIdx + action.length).trim();
      patient = patient.replace(/[，。！？!?,.]+$/, '').trim();
    } else {
      patient = text;
    }

    const locations: string[] = [];
    const locationMatches = text.match(/北京|上海|广州|深圳|杭州|成都|重庆|武汉|西安|南京|Tokyo|London|Paris|New York|Berlin|Seoul|Beijing|Shanghai|Shenzhen/g);
    if (locationMatches) {
      locations.push(...Array.from(new Set(locationMatches)));
    }

    const temporal: string[] = [];
    const timePatterns = [
      /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}(?:日|号)?/g,
      /\d{1,2}[:：]\d{2}(?:[:：]\d{2})?/g,
      /今天|明天|后天|昨天|上午|下午|晚上|中午|早上|傍晚|今晚|明早|本周|下周|本月|下月|今年|明年/g,
      /today|tomorrow|yesterday|tonight|morning|afternoon|evening|this week|next week|this month|next month/gi
    ];
    for (const pattern of timePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        temporal.push(...matches);
      }
    }

    const instrument: string[] = [];
    const toolMatches = text.match(/Python|JavaScript|TypeScript|Java|Go|Rust|C\+\+|Node\.js|React|Vue|Angular|SQL|MySQL|Git|Docker/gi);
    if (toolMatches) {
      instrument.push(...Array.from(new Set(toolMatches)));
    }

    const goals: string[] = [];
    const goalMatches = text.match(/(?:为了|以便|用于|目的是|to |in order to |for )[\u4e00-\u9fa5A-Za-z\s]+/gi);
    if (goalMatches) {
      goals.push(...goalMatches.slice(0, 3));
    }

    const modifiers: string[] = [];
    const modifierMatches = text.match(/快速|快速地|slowly|quickly|详细|详细地|detail|carefully|简单|简单地|simple|easily|briefly|完整|完整地/g);
    if (modifierMatches) {
      modifiers.push(...Array.from(new Set(modifierMatches)).slice(0, 5));
    }

    const numberMatches = text.match(/\d+(?:\.\d+)?\s*(?:个|件|份|本|kg|公里|千米|小时|天|周|月|年)?/gi);
    if (numberMatches) {
      modifiers.push(...numberMatches.slice(0, 3));
    }

    const rawRoles: Record<string, string> = {
      action: action || 'query',
      agent: agent || 'user',
      patient: patient || text,
      location: locations.join(', '),
      temporal: temporal.join(', '),
      instrument: instrument.join(', ')
    };

    return {
      action: action || 'query',
      agent: agent || 'user',
      patient: patient || text,
      modifiers,
      locations,
      temporal: Array.from(new Set(temporal)),
      instrument,
      goals,
      rawRoles
    };
  }

  // === 增强：多意图识别 ===
  recognizeMultipleIntents(text: string): Array<{
    intent: string;
    confidence: number;
    keywords: string[];
    score: number;
    subSpan: string;
  }> {
    const results: Array<{
      intent: string;
      confidence: number;
      keywords: string[];
      score: number;
      subSpan: string;
    }> = [];

    const sentences = text.split(/[，。！？,.\!?;；]+/).filter(s => s.trim().length > 2);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      const intent = this.recognizeIntent(trimmed);
      if (intent.name !== 'unknown' && intent.confidence > 0.35) {
        results.push({
          intent: intent.name,
          confidence: intent.confidence,
          keywords: this.extractKeywords(trimmed, 3),
          score: intent.confidence,
          subSpan: trimmed.slice(0, 60)
        });
      }
    }

    const connectors = /(?:然后|接着|同时|还有|另外|另一方面|其次|然后再|and |also |plus |in addition |besides )/gi;
    const connectorParts = text.split(connectors).filter(s => s.trim().length > 2);
    if (connectorParts.length > 1) {
      for (const part of connectorParts) {
        const trimmed = part.trim();
        const intent = this.recognizeIntent(trimmed);
        if (intent.name !== 'unknown' && intent.confidence > 0.35) {
          const exists = results.find(r => r.intent === intent.name);
          if (!exists) {
            results.push({
              intent: intent.name,
              confidence: intent.confidence * 0.9,
              keywords: this.extractKeywords(trimmed, 3),
              score: intent.confidence * 0.9,
              subSpan: trimmed.slice(0, 60)
            });
          }
        }
      }
    }

    if ((results.length === 0 || text.length > 40) && text.length > 20) {
      const keywordList = this.extractKeywords(text, 8);
      const secondaryIntents: Map<string, number> = new Map();
      for (const keyword of keywordList) {
        const miniIntent = this.recognizeIntent(keyword);
        if (miniIntent.name !== 'unknown' && miniIntent.confidence > 0.3) {
          const current = secondaryIntents.get(miniIntent.name) || 0;
          secondaryIntents.set(miniIntent.name, current + miniIntent.confidence);
        }
      }
      const sortedSecondary = Array.from(secondaryIntents.entries()).sort((a, b) => b[1] - a[1]);
      for (const [intentName, totalScore] of sortedSecondary) {
        const existing = results.find(r => r.intent === intentName);
        if (!existing) {
          results.push({
            intent: intentName,
            confidence: Math.min(totalScore / 2, 0.75),
            keywords: keywordList.slice(0, 3),
            score: Math.min(totalScore / 2, 0.75),
            subSpan: text.slice(0, 60)
          });
        }
      }
    }

    const globalIntent = this.recognizeIntentHybrid(text);
    if (globalIntent.name !== 'unknown') {
      const existing = results.find(r => r.intent === globalIntent.name);
      if (!existing) {
        results.push({
          intent: globalIntent.name,
          confidence: globalIntent.confidence,
          keywords: this.extractKeywords(text, 3),
          score: globalIntent.confidence,
          subSpan: text.slice(0, 60)
        });
      } else if (globalIntent.confidence > existing.confidence) {
        existing.confidence = globalIntent.confidence;
        existing.score = globalIntent.confidence;
      }
    }

    results.sort((a, b) => b.score - a.score);
    const seenIntents = new Set<string>();
    const dedupResults = results.filter(r => {
      if (seenIntents.has(r.intent)) return false;
      seenIntents.add(r.intent);
      return true;
    });

    return dedupResults.slice(0, 5);
  }

  // ═══════════════════════════════════════════════════════════
  // === TF-IDF 混合意图识别（增强模块）===
  // ═══════════════════════════════════════════════════════════

  // TF-IDF 训练语料（每意图包含中/英/日代表性样本）
  private intentTrainingData: Map<string, string[]> = new Map();
  private tfidfReady = false;

  /**
   * 初始化 TF-IDF 训练数据
   */
  private initTFIDFTrainingData(): void {
    if (this.tfidfReady) return;

    this.intentTrainingData.set('search', [
      '帮我搜索一下最新的AI新闻',
      '查找关于机器学习的资料',
      '查询今天的天气怎么样',
      '搜一下Python教程',
      '找一找附近的餐厅',
      'search for the latest AI news',
      'find information about machine learning',
      'look up Python tutorial',
      '最新のAIニュースを検索して',
      '機械学習について調べて',
    ]);
    this.intentTrainingData.set('calculate', [
      '帮我计算一下100乘以35',
      '算一下这个公式的结果',
      '2加3乘4等于多少',
      'calculate the result of 100 times 35',
      'compute this math problem',
      'what is 2 plus 3 times 4',
      '計算して100かける35',
    ]);
    this.intentTrainingData.set('summarize', [
      '帮我总结一下这篇文章',
      '概括一下主要内容',
      '把这个文档做个摘要',
      'summarize this article for me',
      'give me a summary of the main points',
      '要点をまとめてください',
    ]);
    this.intentTrainingData.set('translate', [
      '帮我把这段话翻译成英文',
      '翻译一下这个日语句子',
      '把Hello翻译成中文',
      'translate this to English please',
      '翻訳して日本語に',
    ]);
    this.intentTrainingData.set('execute_code', [
      '帮我运行这段Python代码',
      '执行一下这个JavaScript脚本',
      '运行这个程序看看结果',
      'run this Python code for me',
      'execute the following JavaScript',
      'このPythonコードを実行して',
    ]);
    this.intentTrainingData.set('help', [
      '你能帮我做什么',
      '我不太会用这个功能',
      '帮助我理解一下怎么操作',
      'help me understand how to use this',
      'what can you do for me',
      '使い方を教えて',
    ]);
    this.intentTrainingData.set('greeting', [
      '你好，很高兴见到你',
      '嗨，早上好',
      'hello how are you',
      'good morning',
      'こんにちは、お元気ですか',
    ]);
    this.intentTrainingData.set('goodbye', [
      '再见，下次聊',
      '拜拜，我先走了',
      'bye see you later',
      'goodbye have a nice day',
      'さようなら、またね',
    ]);
    this.intentTrainingData.set('analyze', [
      '帮我分析一下这组数据',
      '分析这个问题的原因',
      '能不能帮我看看这个趋势',
      'analyze this data for me',
      'help me analyze the root cause',
      'このデータを分析して',
    ]);
    this.intentTrainingData.set('write', [
      '帮我写一封邮件给客户',
      '写一篇关于环保的文章',
      '撰写一份项目计划书',
      'write an email to the client',
      'compose a report about sustainability',
      'メールを書いてください',
    ]);
    this.intentTrainingData.set('explain', [
      '解释一下什么是机器学习',
      '说明一下这个原理',
      '讲讲这段代码是什么意思',
      'explain what machine learning is',
      '説明してこの原理を',
    ]);
    this.intentTrainingData.set('debug', [
      '帮我调试这个错误',
      '这段代码有bug帮我修一下',
      '排查一下为什么程序崩溃了',
      'debug this error for me',
      'fix this bug in my code',
      'このエラーをデバッグして',
    ]);
    this.intentTrainingData.set('weather', [
      '今天天气怎么样',
      '明天会下雨吗',
      '北京的温度是多少',
      'what is the weather like today',
      '今日の天気はどうですか',
    ]);
    this.intentTrainingData.set('time', [
      '现在几点了',
      '今天是几号',
      '下周三是几号',
      'what time is it now',
      'what is the date today',
      '今何時ですか',
    ]);

    // 构建 TF-IDF 词汇表
    this.buildTFIDFVocabulary();
    this.tfidfReady = true;
    console.log(`${LOG_PREFIX} [TFIDF_INIT] Ready with ${this.intentTrainingData.size} intents`);
  }

  // TF-IDF 词汇表
  private tfidfVocabulary: Map<string, Map<string, number>> = new Map(); // intent -> {term -> tfidf}
  private globalIDF: Map<string, number> = new Map();

  /**
   * 构建 TF-IDF 词汇表
   */
  private buildTFIDFVocabulary(): void {
    // 收集所有文档
    const allDocs: string[] = [];
    const intentDocs: Map<string, string[]> = new Map();

    for (const [intent, samples] of this.intentTrainingData.entries()) {
      const docs = samples.map(s => this.tokenize(s));
      intentDocs.set(intent, docs);
      allDocs.push(...docs);
    }

    // 计算 IDF
    const totalDocs = allDocs.length;
    const termDocCount: Map<string, number> = new Map();
    for (const doc of allDocs) {
      const seenInDoc = new Set<string>();
      const terms = doc.split(/\s+/).filter(t => t.length > 0);
      for (const term of terms) {
        if (!seenInDoc.has(term)) {
          seenInDoc.add(term);
          termDocCount.set(term, (termDocCount.get(term) || 0) + 1);
        }
      }
    }

    for (const [term, count] of termDocCount.entries()) {
      this.globalIDF.set(term, Math.log((totalDocs + 1) / (count + 1)) + 1);
    }

    // 计算每个意图的 TF-IDF
    for (const [intent, docs] of intentDocs.entries()) {
      const intentTFIDF = new Map<string, number>();
      for (const doc of docs) {
        const terms = doc.split(/\s+/).filter(t => t.length > 0);
        const termCount = new Map<string, number>();
        for (const term of terms) {
          termCount.set(term, (termCount.get(term) || 0) + 1);
        }
        const docLength = terms.length || 1;
        for (const [term, count] of termCount.entries()) {
          const tf = count / docLength;
          const idf = this.globalIDF.get(term) || 1;
          const tfidf = tf * idf;
          intentTFIDF.set(term, (intentTFIDF.get(term) || 0) + tfidf);
        }
      }
      // 按文档数平均
      for (const [term, score] of intentTFIDF.entries()) {
        intentTFIDF.set(term, score / docs.length);
      }
      this.tfidfVocabulary.set(intent, intentTFIDF);
    }
  }

  /**
   * 分词（支持中/英/日）
   */
  private tokenize(text: string): string {
    // 中文按字+词切分，英文按空格分词，日文按字切分
    const tokens: string[] = [];

    // 提取英文单词
    const engWords = text.match(/[a-zA-Z]+/g) || [];
    tokens.push(...engWords.map(w => w.toLowerCase()));

    // 中文单字和双字组合
    const cleaned = text.replace(/[a-zA-Z\s]+/g, '');
    for (let i = 0; i < cleaned.length; i++) {
      tokens.push(cleaned[i]);
      if (i < cleaned.length - 1) {
        tokens.push(cleaned.substring(i, i + 2));
      }
    }

    return tokens.join(' ');
  }

  /**
   * TF-IDF 意图识别
   */
  recognizeIntentTFIDF(text: string): { name: string; confidence: number } {
    this.initTFIDFTrainingData();

    const inputTokens = this.tokenize(text).split(/\s+/).filter(t => t.length > 0);
    if (inputTokens.length === 0) {
      return { name: 'unknown', confidence: 0 };
    }

    // 计算输入文本的 TF 向量
    const inputTF = new Map<string, number>();
    for (const token of inputTokens) {
      inputTF.set(token, (inputTF.get(token) || 0) + 1);
    }
    const inputLength = inputTokens.length;
    for (const [token, count] of inputTF.entries()) {
      inputTF.set(token, count / inputLength);
    }

    // 计算与每个意图的余弦相似度
    let bestIntent = 'unknown';
    let bestScore = 0;
    const allScores: Array<{ intent: string; score: number }> = [];

    for (const [intent, intentTFIDF] of this.tfidfVocabulary.entries()) {
      let dotProduct = 0;
      let inputNorm = 0;
      let intentNorm = 0;

      // 遍历输入 token
      for (const [token, tf] of inputTF.entries()) {
        const intentTfidf = intentTFIDF.get(token) || 0;
        const idf = this.globalIDF.get(token) || 1;
        const inputTfidf = tf * idf;
        dotProduct += inputTfidf * intentTfidf;
        inputNorm += inputTfidf * inputTfidf;
      }

      // 计算意图向量模长
      for (const tfidf of intentTFIDF.values()) {
        intentNorm += tfidf * tfidf;
      }

      inputNorm = Math.sqrt(inputNorm);
      intentNorm = Math.sqrt(intentNorm);

      const similarity = (inputNorm > 0 && intentNorm > 0)
        ? dotProduct / (inputNorm * intentNorm)
        : 0;

      allScores.push({ intent, score: similarity });

      if (similarity > bestScore) {
        bestScore = similarity;
        bestIntent = intent;
      }
    }

    // 归一化置信度
    const maxPossible = 0.9;
    const confidence = Math.min(bestScore * 1.5, maxPossible);

    return { name: bestIntent, confidence: Math.round(confidence * 100) / 100 };
  }

  /**
   * 混合意图识别：正则 + TF-IDF 加权融合
   * 目标准确率 ≥90%
   */
  recognizeIntentHybrid(text: string): Intent {
    // 正则识别
    const regexResult = this.recognizeIntentRegex(text);

    // TF-IDF 识别
    const tfidfResult = this.recognizeIntentTFIDF(text);

    // 加权融合策略
    const regexWeight = 0.55;  // 正则权重高（精确匹配）
    const tfidfWeight = 0.45;  // TF-IDF 权重（语义补充）

    // 如果正则匹配有高置信度结果，直接采用
    if (regexResult.name !== 'unknown' && regexResult.confidence >= 0.85) {
      return {
        name: regexResult.name,
        confidence: regexResult.confidence,
        entities: this.extractEntities(text)
      };
    }

    // 如果 TF-IDF 结果远超正则，采用 TF-IDF
    if (tfidfResult.confidence > regexResult.confidence + 0.25) {
      return {
        name: tfidfResult.name,
        confidence: tfidfResult.confidence * 0.9, // 略微降低纯TF-IDF的置信度
        entities: this.extractEntities(text)
      };
    }

    // 意图一致时融合置信度
    if (regexResult.name === tfidfResult.name) {
      const fusedConfidence = regexResult.confidence * regexWeight + tfidfResult.confidence * tfidfWeight;
      return {
        name: regexResult.name,
        confidence: Math.min(Math.round(fusedConfidence * 100) / 100, 0.98),
        entities: this.extractEntities(text)
      };
    }

    // 意图不一致时，选择置信度更高的
    if (regexResult.confidence >= tfidfResult.confidence) {
      return {
        name: regexResult.name !== 'unknown' ? regexResult.name : tfidfResult.name,
        confidence: Math.max(regexResult.confidence, tfidfResult.confidence * 0.85),
        entities: this.extractEntities(text)
      };
    }

    return {
      name: tfidfResult.name !== 'unknown' ? tfidfResult.name : regexResult.name,
      confidence: Math.max(tfidfResult.confidence * 0.85, regexResult.confidence),
      entities: this.extractEntities(text)
    };
  }

  /**
   * 纯正则意图识别（原 recognizeIntent 改名保留）
   */
  private recognizeIntentRegex(text: string): { name: string; confidence: number } {
    let bestMatch: { name: string; confidence: number; priority: number } = {
      name: 'unknown',
      confidence: 0.1,
      priority: 0
    };

    for (const [intentName, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.regex.test(text)) {
          if (pattern.priority > bestMatch.priority ||
              (pattern.priority === bestMatch.priority && pattern.confidence > bestMatch.confidence)) {
            bestMatch = {
              name: intentName,
              confidence: pattern.confidence,
              priority: pattern.priority
            };
          }
        }
      }
    }

    if (bestMatch.name === 'unknown' && (text.includes('?') || text.includes('？'))) {
      bestMatch = { name: 'question', confidence: 0.5, priority: 0 };
    }

    return { name: bestMatch.name, confidence: bestMatch.confidence };
  }

  // 获取完整的感知分析
  analyzeInputComprehensive(input: string): {
    language: string;
    intent: Intent;
    multipleIntents: Array<{ intent: string; confidence: number; keywords: string[] }>;
    entities: Entity[];
    compoundEntities: Array<{ type: string; components: Entity[]; confidence: number }>;
    emotion: { type: string; confidence: number; intensity: number; emotions: Record<string, number> };
    semanticRoles: { action: string; agent: string; patient: string; modifiers: string[] };
    keywords: string[];
    needsClarification: boolean;
    conversationSummary: { topic: string; turnCount: number; recentIntents: string[]; keyEntities: Entity[] };
    predictedNextIntent: { predictedIntent: string; confidence: number; alternatives: string[] };
  } {
    const language = this.detectLanguage(input);
    const intent = this.recognizeIntentHybrid(input);
    const multipleIntents = this.recognizeMultipleIntents(input);
    const { basicEntities, compoundEntities } = this.extractAdvancedEntities(input);
    const emotion = this.analyzeEmotionIntensity(input);
    const semanticRoles = this.extractSemanticRoles(input);
    const keywords = this.extractKeywords(input, 5);
    const needsClarification = this.needsClarification(input);
    const conversationSummary = this.getConversationSummary();
    const predictedNextIntent = this.predictNextIntent();

    // 更新上下文
    this.updateConversationContext(intent, input);

    return {
      language,
      intent,
      multipleIntents,
      entities: basicEntities,
      compoundEntities,
      emotion,
      semanticRoles,
      keywords,
      needsClarification,
      conversationSummary,
      predictedNextIntent
    };
  }
}
