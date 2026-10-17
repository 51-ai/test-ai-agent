# OpenAI API 使用示例

本目录包含多个OpenAI API使用示例，演示不同的功能和工具。

## 📁 文件列表

### 基础功能示例

| 文件 | 功能 | 模型 | API |
|-----|------|------|-----|
| `image-analysis.mjs` | 图像分析 | gpt-4o | Chat Completions |
| `pdf-analysis-url.mjs` | PDF文档分析（URL） | gpt-4o | Chat Completions |
| `pdf-analysis-upload.mjs` | PDF文档分析（上传） | gpt-4o | Assistants API |

### 高级工具示例

| 文件 | 功能 | 工具类型 | 说明 |
|-----|------|---------|------|
| `web-search.mjs` | Web搜索 | Web Search | 搜索实时信息 |
| `file-search.mjs` | 文件搜索 | File Search | 向量存储检索 |
| `function-calling.mjs` | 函数调用 | Function Calling | 自定义工具 |
| `mcp-tool.mjs` | MCP工具 | MCP | 外部服务器集成 |

### 国内模型示例

| 文件 | 功能 | 厂商 | 说明 |
|-----|------|------|------|
| `deepseek-demo.mjs` | **DeepSeek V3** | 深度求索 | ⭐ 性能强、成本极低 |
| `doubao-demo.mjs` | 豆包API | 字节跳动 | 国内可用的AI服务 |
| `free-models.mjs` | 免费模型合集 | 多家 | ⭐ 包含6个免费模型 |

### 🌟 完全免费模型

| 文件 | 功能 | 厂商 | 说明 |
|-----|------|------|------|
| `ollama-demo.mjs` | **⭐⭐⭐ Ollama 本地** | Ollama | ⭐⭐⭐ **强烈推荐！真正完全免费！离线可用！** |
| `groq-demo.mjs` | Groq LLaMA | Groq | 完全免费、速度快（需代理） |

### 本地模拟示例

| 文件 | 功能 | 说明 |
|-----|------|------|
| `local-mock-demo.mjs` | 本地模拟 | 无需外部API即可运行 |

## 🚀 运行方式

### 1. 设置环境变量

```bash
# Windows
set OPENAI_API_KEY=sk-your-api-key-here

# Linux/Mac
export OPENAI_API_KEY=sk-your-api-key-here
```

### 2. 运行示例

```bash
# 基础功能
node examples/image-analysis.mjs
node examples/pdf-analysis-url.mjs
node examples/pdf-analysis-upload.mjs

# 高级工具
node examples/web-search.mjs
node examples/file-search.mjs
node examples/function-calling.mjs
node examples/mcp-tool.mjs
```

## 📝 示例说明

### 1. 图像分析 (image-analysis.mjs)

使用 GPT-4 Vision 分析图像内容：
- 支持传入图像URL
- 自动识别图像中的物体、场景、文字等
- 输出详细的图像描述

### 2. PDF分析 - URL方式 (pdf-analysis-url.mjs)

通过URL分析PDF文档：
- 需要先提取PDF文本内容
- 将文本发送给模型进行分析
- 适合已有PDF文本内容的场景

### 3. PDF分析 - 上传方式 (pdf-analysis-upload.mjs)

上传PDF文件进行分析：
- 使用 Assistants API
- 支持文件上传和检索
- 适合需要分析本地PDF文件的场景

### 4. Web搜索 (web-search.mjs)

搜索实时网络信息：
- 获取最新的新闻和信息
- 支持实时数据查询
- 可能需要特殊权限

### 5. 文件搜索 (file-search.mjs)

向量存储文件检索：
- 创建向量存储
- 上传文件到知识库
- 智能检索相关内容

### 6. 函数调用 (function-calling.mjs)

自定义工具集成：
- 定义自定义函数
- 模型自动判断何时调用
- 执行并返回结果

### 7. MCP工具 (mcp-tool.mjs)

Model Context Protocol集成：
- 连接外部MCP服务器
- 支持复杂工具链
- 企业级工具集成

### 8. 免费模型合集 (free-models.mjs)

⭐ **强烈推荐！无需信用卡即可使用**

包含6个免费/有免费额度的AI模型：

| 模型 | 厂商 | 特点 | 获取地址 |
|-----|------|------|---------|
| **DeepSeek V3** | 深度求索 | 性能强、成本低 | platform.deepseek.com |
| **通义千问 Qwen** | 阿里云 | 中文优化好 | dashscope.console.aliyun.com |
| **智谱 GLM** | 智谱AI | 中文能力强 | open.bigmodel.cn |
| **Groq LLaMA** | Groq | 速度快 | console.groq.com |
| **Cohere Command** | Cohere | 多语言支持 | cohere.com |
| **豆包 Doubao** | 字节跳动 | 响应快 | doubao.com |

运行方式：
```bash
# 查看可用模型
node examples/free-models.mjs list

# 测试 DeepSeek（推荐）
set DEEPSEEK_API_KEY=your-key
node examples/free-models.mjs test deepseek
```

## ⚠️ 注意事项

1. **模型版本**
   - 示例使用 `gpt-4o`（当前最新版本）
   - `gpt-5.5` / `gpt-5` 尚未发布，请勿使用

2. **API差异**
   - Chat Completions API：适合文本、图像、函数调用
   - Assistants API：适合文件上传、复杂任务、向量存储
   - MCP工具：需要特殊配置和权限

3. **工具权限**
   - Web Search：可能需要企业版订阅
   - File Search：需要创建向量存储
   - MCP：需要外部服务器配置

4. **文件上传**
   - PDF文件分析需要使用 Assistants API
   - Chat Completions API 不直接支持 file_id

## 🔧 工具对比

| 工具类型 | 适用场景 | API | 复杂度 |
|---------|---------|-----|--------|
| **Web Search** | 实时信息查询 | Responses API | ⭐⭐ |
| **File Search** | 文档知识库检索 | Assistants API | ⭐⭐⭐ |
| **Function Calling** | 自定义工具集成 | Chat Completions | ⭐⭐ |
| **MCP** | 外部服务器集成 | Responses API | ⭐⭐⭐⭐ |

## 🔗 参考链接

- [OpenAI API文档](https://platform.openai.com/docs)
- [GPT-4 Vision指南](https://platform.openai.com/docs/guides/vision)
- [Assistants API指南](https://platform.openai.com/docs/assistants)
- [Function Calling指南](https://platform.openai.com/docs/guides/function-calling)
- [MCP协议文档](https://modelcontextprotocol.io)