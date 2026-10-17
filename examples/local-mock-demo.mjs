/**
 * 本地模拟模式 - 无需外部API即可运行
 * 
 * 使用本地逻辑模拟AI响应，用于演示和测试
 */

// 模拟响应数据
const mockResponses = {
  imageAnalysis: {
    "cat_and_otter": "这张图片展示了一只可爱的猫咪和一只水獭在一起玩耍。猫咪有着橘色的毛发，水獭有着棕色的皮毛。它们看起来非常友好，正在草地上互动。背景是绿色的草地和一些植物，整体氛围非常温馨。"
  },
  
  webSearch: {
    "positive_news": "今天有一个好消息：科学家成功研发出一种新型疫苗，可以有效预防多种疾病。这项突破性的研究为全球公共卫生带来了新的希望。"
  },
  
  weather: {
    "Paris": {
      location: "Paris, France",
      temperature: 22,
      unit: "celsius",
      condition: "sunny",
      humidity: 45
    },
    "Beijing": {
      location: "Beijing, China",
      temperature: 28,
      unit: "celsius",
      condition: "cloudy",
      humidity: 60
    }
  },
  
  diceRoll: {
    "2d4+1": {
      rolls: [3, 4],
      modifier: 1,
      total: 8,
      explanation: "Rolled 2d4: [3, 4] + 1 = 8"
    }
  }
};

/**
 * 模拟图像分析
 */
async function analyzeImage(url) {
  console.log("🖼️ 分析图像:", url);
  
  const key = url.includes("cat_and_otter") ? "cat_and_otter" : "default";
  return mockResponses.imageAnalysis[key] || "无法识别此图像";
}

/**
 * 模拟Web搜索
 */
async function webSearch(query) {
  console.log("🔍 搜索:", query);
  
  if (query.includes("positive news") || query.includes("好消息")) {
    return mockResponses.webSearch.positive_news;
  }
  
  return `关于 "${query}" 的搜索结果：这是一个模拟搜索结果。在实际使用中，这里会调用真实的搜索引擎API来获取实时信息。`;
}

/**
 * 模拟天气查询
 */
async function getWeather(location) {
  console.log("🌤️ 查询天气:", location);
  
  const loc = location.toLowerCase();
  if (loc.includes("paris")) return mockResponses.weather.Paris;
  if (loc.includes("beijing") || loc.includes("北京")) return mockResponses.weather.Beijing;
  
  return {
    location: location,
    temperature: Math.floor(Math.random() * 30 + 10),
    unit: "celsius",
    condition: ["sunny", "cloudy", "rainy", "windy"][Math.floor(Math.random() * 4)],
    humidity: Math.floor(Math.random() * 50 + 30)
  };
}

/**
 * 模拟骰子滚动
 */
async function rollDice(notation) {
  console.log("🎲 掷骰子:", notation);
  
  const match = notation.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!match) {
    return { error: "无效的骰子表示法" };
  }
  
  const numDice = parseInt(match[1]);
  const diceSize = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;
  
  const rolls = [];
  for (let i = 0; i < numDice; i++) {
    rolls.push(Math.floor(Math.random() * diceSize) + 1);
  }
  
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;
  
  return {
    notation: notation,
    rolls: rolls,
    modifier: modifier,
    total: total,
    explanation: `Rolled ${numDice}d${diceSize}: [${rolls.join(', ')}]${modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : ''} = ${total}`
  };
}

/**
 * 演示主函数
 */
async function runDemo() {
  console.log("=".repeat(60));
  console.log("   本地模拟模式 - AI Agent 演示");
  console.log("=".repeat(60));
  console.log("\n💡 提示: 此模式无需外部API，使用本地模拟数据\n");
  
  // 1. 图像分析演示
  console.log("📌 演示1: 图像分析");
  const imageResult = await analyzeImage("https://openai-documentation.vercel.app/images/cat_and_otter.png");
  console.log("分析结果:", imageResult);
  console.log("");
  
  // 2. Web搜索演示
  console.log("📌 演示2: Web搜索");
  const searchResult = await webSearch("What was a positive news story from today?");
  console.log("搜索结果:", searchResult);
  console.log("");
  
  // 3. 天气查询演示
  console.log("📌 演示3: 天气查询");
  const weatherResult = await getWeather("Paris");
  console.log("天气信息:", JSON.stringify(weatherResult, null, 2));
  console.log("");
  
  // 4. 骰子滚动演示
  console.log("📌 演示4: 骰子滚动");
  const diceResult = await rollDice("2d4+1");
  console.log("骰子结果:", diceResult.explanation);
  console.log("");
  
  console.log("=".repeat(60));
  console.log("   演示完成！");
  console.log("=".repeat(60));
  console.log("\n🔗 要使用真实API，请配置OPENAI_API_KEY环境变量");
}

// 执行演示
runDemo().catch(console.error);