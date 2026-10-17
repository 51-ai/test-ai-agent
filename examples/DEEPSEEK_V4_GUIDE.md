# DeepSeek V4 完整指南

> 📅 发布日期：2026年4月24日

## 🎉 DeepSeek V4 已发布！

2026年4月24日，DeepSeek 正式发布了 V4 系列模型，这是继 V3 之后的重大升级！

---

## 📊 模型版本对比

### DeepSeek V4 系列

| 模型 | 参数 | 上下文 | 输入价格 | 输出价格 | 特点 |
|-----|------|--------|---------|---------|------|
| **V4-Flash** | 284B | **1M** | **¥0.2/百万** | **¥0.8/百万** | ⭐ 超级便宜！ |
| **V4-Pro** | 1.6T | **1M** | ¥12/百万 | ¥24/百万 | 高性能旗舰 |

### DeepSeek V3 系列

| 模型 | 参数 | 上下文 | 输入价格 | 输出价格 | 特点 |
|-----|------|--------|---------|---------|------|
| **V3** | 236B | 128K | ¥1/百万 | ¥2/百万 | 经济实惠 |

---

## 💰 价格对比（每百万tokens）

| 模型 | 输入价格 | 输出价格 | 相对价格 |
|-----|---------|---------|---------|
| **V4-Flash** | ¥0.2 | ¥0.8 | ⭐ 最便宜！ |
| V3 | ¥1 | ¥2 | 5倍于V4 |
| GPT-4o | ¥75 | ¥225 | 375倍于V4 |

**V4-Flash 比 GPT-4o 便宜 375 倍！**

---

## 🚀 核心突破

### 1. 100万Token超长上下文
- 一次性处理《三体》三部曲（约75万字）
- 整份合同、代码库一次性分析
- 300+页年报秒级提炼
- 完整阅读并理解整本书

### 2. 混合注意力架构
- CSA（压缩稀疏注意力）：轻度压缩，保留细节
- HCA（重度压缩注意力）：极限压缩，全局视野
- SWA（滑动窗口注意力）：局部细节

### 3. 深度思考模式
- **非思考模式**：快速响应日常问题
- **Think High**：深度逻辑分析
- **Think Max**：极限推理能力

---

## 📈 性能对比

| 能力 | V4-Flash | V4-Pro | V3 |
|-----|---------|--------|-----|
| 数学推理 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 代码能力 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 中文理解 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 长文本 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Agent能力 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 🎯 使用建议

### 日常使用 → V4-Flash
```
✅ 最便宜：¥0.2/百万tokens
✅ 超长上下文：100万token
✅ 速度快
```
适合：聊天、写作、代码、文档分析

### 复杂任务 → V4-Pro
```
✅ 高性能旗舰
✅ 推理能力最强
✅ 处理复杂任务
```
适合：深度分析、复杂推理、专业领域

### 预算有限 → V3
```
✅ 经济实惠
✅ ¥1/百万tokens
✅ 性能足够日常使用
```
适合：预算敏感、简单任务

---

## 🔧 API 使用方法

### Python 示例

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="https://api.deepseek.com/v1"
)

# V4-Flash（推荐日常使用）
response = client.chat.completions.create(
    model="deepseek-v4-flash",
    messages=[
        {"role": "user", "content": "你好，请介绍一下自己"}
    ]
)

# V4-Pro（复杂任务）
response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=[
        {"role": "user", "content": "深度分析量子计算"}
    ]
)

print(response.choices[0].message.content)
```

### JavaScript 示例

```javascript
const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-key'
  },
  body: JSON.stringify({
    model: 'deepseek-v4-flash',  // 或 'deepseek-v4-pro'
    messages: [
      { role: 'user', content: '你好，请介绍一下自己' }
    ]
  })
});
```

---

## 📋 实际成本计算

| 任务类型 | tokens | V4-Flash费用 | V3费用 | GPT-4o费用 |
|---------|-------|-------------|--------|-----------|
| 一段对话 | 500 | ¥0.0001 | ¥0.0005 | ¥0.0375 |
| 一篇文章 | 2000 | ¥0.0004 | ¥0.002 | ¥0.15 |
| 一本书摘要 | 10000 | ¥0.002 | ¥0.01 | ¥0.75 |
| 100次对话 | 50000 | ¥0.01 | ¥0.05 | ¥3.75 |
| 月度使用 | 100万 | ¥0.2 | ¥1 | ¥75 |

**V4-Flash 用100万tokens只需2毛钱！**

---

## 🌐 获取 API Key

### 1. 访问 DeepSeek 开放平台
```
https://platform.deepseek.com/
```

### 2. 注册/登录账号
- 支持手机号、邮箱注册
- 完成实名认证

### 3. 创建 API Key
- 进入「API Keys」页面
- 点击「Create API Key」
- 复制密钥

### 4. 配置并使用

```bash
# 设置环境变量
set DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx

# 运行示例
node examples/deepseek-demo.mjs
```

---

## 💡 使用技巧

### 1. 选择合适的模型
- 日常聊天 → V4-Flash（最便宜）
- 复杂任务 → V4-Pro（最强）
- 预算有限 → V3（性价比)

### 2. 控制输出长度
```javascript
// 设置最大输出tokens
{
  model: 'deepseek-v4-flash',
  max_tokens: 10000 // 控制输出长度，节省费用
}
```

### 3. 使用流式输出
```javascript
// 流式响应，用户体验更好
{
  model: 'deepseek-v4-flash',
  stream: true
}
```

### 4. 利用超长上下文
```javascript
// 一次发送整本书进行分析
{
  model: 'deepseek-v4-flash',
  messages: [
    { role: "user", content: "分析以下文档..." + 整本书内容 }
  ]
}
```

---

## 🎓 进阶功能

### 深度思考模式

```javascript
// 启用深度思考
{
  model: 'deepseek-v4-pro',
  messages: [
    { 
      role: "user", 
      content: "分析量子计算对未来AI的影响" 
    }
  ],
  extra_body: {
    thinking_type: "high"  // 或 "max"
  }
}
```

### 函数调用（Tool Use）

```javascript
{
  model: 'deepseek-v4-flash',
  messages: [
    { role: "user", content: "北京的天气怎么样？" }
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "get_weather",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string" }
          }
        }
      }
    }
  ]
}
```

---

## ⚠️ 注意事项

1. **V4-Pro 价格较高**：¥12/百万输入，适合重要任务
2. **V4-Flash 性价比最高**：¥0.2/百万，日常使用首选
3. **超长上下文**：善用100万token，一次性处理大文档
4. **深度思考**：复杂问题启用Think模式

---

## 📚 相关资源

- [DeepSeek 官方文档](https://api-docs.deepseek.com/)
- [API Keys 管理](https://platform.deepseek.com/api_keys)
- [价格说明](https://api-docs.deepseek.com/guides/pricing)
- [模型列表](https://api-docs.deepseek.com/models)

---

## 🎉 总结

**DeepSeek V4 是目前性价比最高的大模型！**

- ⭐ **V4-Flash**：¥0.2/百万tokens，超级便宜！
- 🚀 **100万token上下文**：处理整本书
- 🧠 **深度思考**：复杂问题更准确
- 🌐 **开源**：可本地部署

**强烈推荐使用 V4-Flash，日常使用足够，便宜到不要钱！** 💰
