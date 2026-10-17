/**
 * 极速AI体验 - 超小模型推荐
 * 
 * 这些模型下载非常快（通常几分钟）：
 * 
 * Ollama 小模型：
 * - llama3.2:1b  (~1.3GB)  ⭐ 最佳选择
 * - phi          (~1.5GB)  推荐
 * - tinydolphin  (~0.6GB)  最小
 * - gemma:2b     (~1.8GB)  推荐
 * 
 * 在线模型（无需下载）：
 * - 通义千问     ✅ 国内直达，有免费额度
 * - 智谱 GLM    ✅ 国内直达，有免费额度
 */

console.log("=".repeat(70));
console.log("   极速AI体验指南");
console.log("=".repeat(70));
console.log("");

console.log("🎯 方案对比：\n");

console.log("┌─────────────────────────────────────────────────────────────┐");
console.log("│ 🥇 方案1: 通义千问（强烈推荐）                            │");
console.log("├─────────────────────────────────────────────────────────────┤");
console.log("│ ⏱️ 配置时间: 5分钟                                        │");
console.log("│ 📦 下载: 无需下载！                                       │");
console.log("│ 🌐 访问: 国内秒访问                                       │");
console.log("│ 💰 费用: 免费额度                                         │");
console.log("│ ⭐ 中文: 优化最好                                         │");
console.log("│ 📝 使用: node examples/qwen-demo.mjs                     │");
console.log("└─────────────────────────────────────────────────────────────┘");
console.log("");

console.log("┌─────────────────────────────────────────────────────────────┐");
console.log("│ 🥈 方案2: Ollama 超级小模型                               │");
console.log("├─────────────────────────────────────────────────────────────┤");
console.log("│ ⏱️ 下载时间: 3-10分钟                                     │");
console.log("│ 📦 模型: llama3.2:1b (~1.3GB)                            │");
console.log("│ 🌐 访问: 完全本地                                         │");
console.log("│ 💰 费用: 完全免费                                         │");
console.log("│ 📝 使用: ollama pull llama3.2:1b                         │");
console.log("│         node examples/ollama-demo.mjs                     │");
console.log("└─────────────────────────────────────────────────────────────┘");
console.log("");

console.log("=".repeat(70));
console.log("   快速开始指南");
console.log("=".repeat(70));
console.log("");

console.log("📋 通义千问配置步骤（推荐）：\n");
console.log("   1️⃣ 访问 https://dashscope.console.aliyun.com/");
console.log("   2️⃣ 使用淘宝/支付宝账号登录");
console.log("   3️⃣ 进入「API-KEY管理」创建密钥");
console.log("   4️⃣ 复制密钥并运行：\n");
console.log("      set DASHSCOPE_API_KEY=sk-你的密钥");
console.log("      node examples/qwen-demo.mjs");
console.log("");

console.log("📋 Ollama 极速配置步骤：\n");
console.log("   1️⃣ 下载 https://ollama.com/download");
console.log("   2️⃣ 下载超小模型：\n");
console.log("      ollama pull llama3.2:1b   ⭐ 推荐！1.3GB，最快");
console.log("      ollama pull phi            1.5GB，极快");
console.log("   3️⃣ 运行示例：\n");
console.log("      node examples/ollama-demo.mjs");
console.log("");

console.log("=".repeat(70));
console.log("   模型大小对比");
console.log("=".repeat(70));
console.log("");

const models = [
  { name: "llama3.2:1b", size: "1.3GB", speed: "⭐⭐⭐⭐⭐", desc: "最新、最小、推荐" },
  { name: "phi", size: "1.5GB", speed: "⭐⭐⭐⭐", desc: "微软出品" },
  { name: "tinydolphin", size: "0.6GB", speed: "⭐⭐⭐⭐⭐", desc: "最小但能力有限" },
  { name: "gemma:2b", size: "1.8GB", speed: "⭐⭐⭐⭐", desc: "Google出品" },
  { name: "qwen2.5", size: "4GB", speed: "⭐⭐", desc: "中文好但较大" },
];

console.log(" Ollama 模型:");
models.forEach(m => {
  console.log(`  - ${m.name.padEnd(15)} ${m.size.padEnd(8)} 下载${m.speed}  ${m.desc}`);
});
console.log("");

console.log(" 在线模型（无需下载）:");
console.log("  - 通义千问     无需下载  国内直达  有免费额度 ⭐⭐⭐⭐⭐");
console.log("  - 智谱 GLM    无需下载  国内直达  有免费额度 ⭐⭐⭐⭐");
console.log("");

console.log("=".repeat(70));