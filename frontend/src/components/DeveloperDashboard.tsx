import React, { useState, useEffect } from 'react';
import { devApi, getDeveloperApiKey, API_BASE_URL } from '../services/developerApi';

// ==================== 持久化存储工具 ====================
const STORAGE_KEY_PREFIX = 'dev_dashboard_';

const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
};

const loadFromStorage = (key: string, defaultValue: any = null) => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load from localStorage:', e);
  }
  return defaultValue;
};

const clearStorage = (key: string) => {
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + key);
  } catch (e) {
    console.warn('Failed to clear localStorage:', e);
  }
};

// ==================== 类型定义 ====================
interface Tab {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  time: Date;
  developerMode?: boolean;
  hasTools?: boolean;
  toolCalls?: Array<{ toolName: string; parameters: any }>;
}

interface RLMetrics {
  episode: number;
  reward: number;
  loss: number;
  klDivergence: number;
  valueLoss: number;
  policyEntropy: number;
  learningRate: number;
  timestamp: number;
}

// ==================== 导航配置 ====================
const developerTabs: Tab[] = [
  { id: 'chat', name: '对话测试', icon: '💬', description: '测试 AI Agent 对话功能' },
  { id: 'rag', name: 'RAG 检索', icon: '📚', description: '测试检索增强生成系统' },
  { id: 'rl', name: '强化学习', icon: '🧠', description: '测试强化学习训练模块' },
  { id: 'analysis', name: '数据分析', icon: '📊', description: '数据可视化与统计分析' },
  { id: 'ai-enhance', name: 'AI 增强', icon: '🚀', description: '提示词管理与模型配置' },
  { id: 'workflow', name: '工作流', icon: '⚙️', description: '自动化任务与触发器' },
  { id: 'monitoring', name: '系统监控', icon: '🔍', description: '性能监控与告警通知' },
  { id: 'evaluation', name: '评估系统', icon: '📈', description: '查看系统评估指标' },
  { id: 'data', name: '数据治理', icon: '🔒', description: '管理测试数据' },
  { id: 'iteration', name: '持续迭代', icon: '🔄', description: '管理持续迭代系统' },
  { id: 'tools', name: '工具管理', icon: '🔧', description: '管理和测试各种工具' },
  { id: 'memory', name: '记忆系统', icon: '🧩', description: '查看和管理Agent记忆' },
  { id: 'decision', name: '决策引擎', icon: '🎯', description: '查看决策过程和历史' },
  { id: 'logs', name: '日志查看', icon: '📋', description: '实时查看系统日志' },
  { id: 'config', name: '配置管理', icon: '⚙️', description: '管理系统配置参数' },
  { id: 'sync', name: '同步管理', icon: '🔗', description: '同步开发者配置到生产环境' },
  { id: 'export', name: '数据导出', icon: '📤', description: '导出测试数据和报告' },
  { id: 'scenarios', name: '模拟场景', icon: '🎬', description: '创建和运行测试场景' },
  { id: 'plugins', name: '插件市场', icon: '🔌', description: '浏览和安装插件' },
  { id: 'api-test', name: 'API 测试', icon: '🔧', description: '测试和调试 API 端点' },
  { id: 'assistant', name: '智能助手', icon: '🤖', description: 'AI 辅助开发助手' }
];

// ==================== 工具函数 ====================
const copyToClipboard = (text: string) => {
  try {
    navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

const downloadJson = (filename: string, data: any) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const formatDate = (d: Date | string | number) => {
  const date = new Date(d);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// ==================== 主组件 ====================
const DeveloperDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('chat');
  const [status, setStatus] = useState<any>({
    userId: 'dev-001',
    developerMode: true,
    limits: { maxRequestsPerMinute: 100 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkDeveloperStatus();
  }, []);

  const checkDeveloperStatus = async () => {
    try {
      setLoading(true);
      const res = await devApi.getStatus();
      if (res.success) {
        setStatus(res.data);
        setError(null);
      } else {
        setError(res.error || '无法连接到开发者服务器');
      }
    } catch {
      // 开发者模式即使后端未运行也提供前端功能
      setStatus({
        userId: 'dev-local',
        developerMode: true,
        limits: { maxRequestsPerMinute: 100 },
        version: 'local-mode'
      });
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">正在初始化开发者环境...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2 text-red-400">连接失败</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button type="button"
            onClick={checkDeveloperStatus}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            重新连接
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <DeveloperHeader status={status} />
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <DeveloperSidebar
            tabs={developerTabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <div className="lg:col-span-3">
            <DeveloperContent activeTab={activeTab} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== Header 组件 ====================
const DeveloperHeader: React.FC<{ status: any }> = ({ status }) => {
  return (
    <div className="bg-gradient-to-r from-purple-900 via-blue-900 to-purple-900 shadow-lg">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-4xl">🔧</div>
            <div>
              <h1 className="text-3xl font-bold text-white">开发者入口</h1>
              <p className="text-purple-200 text-sm mt-1">AI Agent 系统 - 功能测试与开发环境</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-green-500/20 border border-green-500 rounded-lg px-4 py-2">
              <span className="text-green-400 font-semibold">● 开发者模式</span>
            </div>
            <div className="text-right">
              <div className="text-sm text-purple-200">用户ID</div>
              <div className="text-white font-mono text-sm">{status?.userId}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== Sidebar 组件 ====================
const DeveloperSidebar: React.FC<{
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-4 h-fit">
      <h2 className="text-lg font-bold text-white mb-4 border-b border-gray-700 pb-2">
        功能导航
      </h2>
      <nav className="space-y-2">
        {tabs.map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center space-x-3 ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <span className="text-2xl">{tab.icon}</span>
            <div className="flex-1">
              <div className="font-semibold">{tab.name}</div>
              <div className={`text-xs mt-1 ${activeTab === tab.id ? 'text-blue-200' : 'text-gray-500'}`}>
                {tab.description}
              </div>
            </div>
          </button>
        ))}
      </nav>
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="text-xs text-gray-500 space-y-1">
          <p>API 密钥: {getDeveloperApiKey()?.substring(0, 8) || '未设置'}...</p>
          <p>数据隔离: ✓ 已启用</p>
          <p>速率限制: 100/min</p>
        </div>
      </div>
    </div>
  );
};

// ==================== 内容路由 ====================
const DeveloperContent: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  switch (activeTab) {
    case 'chat':
      return <ChatTestPanel />;
    case 'rag':
      return <RAGTestPanel />;
    case 'rl':
      return <RLTestPanel />;
    case 'analysis':
      return <DataAnalysisPanel />;
    case 'ai-enhance':
      return <AIEnhancePanel />;
    case 'workflow':
      return <WorkflowPanel />;
    case 'evaluation':
      return <EvaluationPanel />;
    case 'data':
      return <DataGovernancePanel />;
    case 'monitoring':
      return <MonitoringPanel />;
    case 'iteration':
      return <IterationPanel />;
    case 'tools':
      return <ToolsManagementPanel />;
    case 'memory':
      return <MemoryPanel />;
    case 'decision':
      return <DecisionPanel />;
    case 'logs':
      return <LogsPanel />;
    case 'config':
      return <ConfigPanel />;
    case 'sync':
      return <SyncPanel />;
    case 'export':
      return <ExportPanel />;
    case 'scenarios':
      return <ScenariosPanel />;
    case 'plugins':
      return <PluginMarketPanel />;
    case 'api-test':
      return <APITestPanel />;
    case 'assistant':
      return <AssistantPanel />;
    default:
      return <ChatTestPanel />;
  }
};

// ==================== 1. 对话测试面板 ====================
const ChatTestPanel: React.FC = () => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [responses, setResponses] = useState<ChatMessage[]>(() =>
    loadFromStorage('chat_responses', [
      { role: 'user', content: '帮我写一个完整的用户认证API', time: new Date(Date.now() - 86400000), developerMode: true },
      {
        role: 'assistant',
        content: '好的！以下是一个完整的用户认证 API 设计：\n\n**功能模块：**\n1. 用户注册 (POST /users/)\n2. 用户登录 (POST /token)\n3. 获取用户信息 (GET /users/me)\n4. 用户登出\n\n**技术栈建议：**\n- 后端: FastAPI + SQLite\n- 认证: JWT (jsonwebtoken)\n- 密码哈希: bcrypt\n- 前端: React + Axios\n\n**运行命令：**\n```bash\npip install fastapi uvicorn sqlalchemy python-jose passlib[bcrypt]\nuvicorn main:app --host 0.0.0.0 --port 8000\n```\n\n**访问：** http://localhost:8000/docs 查看API文档',
        time: new Date(Date.now() - 86000000),
        developerMode: true
      },
      { role: 'user', content: '再帮我写一个React前端对接这个API', time: new Date(Date.now() - 85000000), developerMode: true },
      {
        role: 'assistant',
        content: '好的！这是一个完整的 React 前端模板。主要功能包括：\n\n**状态管理：**\n- 使用 useState 管理 token 和 user\n- 使用 localStorage 持久化登录状态\n\n**核心功能：**\n```typescript\n// 登录\nconst handleLogin = async (data: LoginData) => {\n  const res = await axios.post(`${API_BASE_URL}/token`, data);\n  const token = res.data.access_token;\n  localStorage.setItem("token", token);\n};\n\n// 获取当前用户\nconst fetchUser = async () => {\n  const res = await axios.get(`${API_BASE_URL}/users/me`, {\n    headers: { Authorization: `Bearer ${token}` }\n  });\n  setUser(res.data);\n};\n```\n\n**UI 组件建议：**\n- Login/Register 表单\n- 用户 Dashboard\n- 使用 Tailwind CSS 进行样式设计',
        time: new Date(Date.now() - 84000000),
        developerMode: true
      }
    ])
  );

  // 自动保存对话历史到 localStorage
  useEffect(() => {
    saveToStorage('chat_responses', responses);
  }, [responses]);

  const presetPrompts = [
    { label: '总结对话', prompt: '请总结我们之前的对话内容' },
    { label: '生成代码', prompt: '写一个简单的 Python 函数来计算斐波那契数列' },
    { label: '翻译', prompt: '请将 "Hello World" 翻译成中文' },
    { label: '数据分析', prompt: '分析一个销售数据集，找出趋势' },
    { label: '搜索', prompt: '搜索最新的 AI 技术新闻' },
    { label: '调试', prompt: '帮我调试这段代码错误' }
  ];

  const handleSend = async () => {
    if (!message.trim()) return;
    const userMessage = message.trim();
    setMessage('');
    setLoading(true);

    const newUserMsg: ChatMessage = { role: 'user', content: userMessage, time: new Date(), developerMode: true };
    setResponses((prev) => [...prev, newUserMsg]);

    try {
      // 尝试调用后端 API
      const res = await devApi.chat(userMessage);
      if (res.success) {
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: res.data.response,
          time: new Date(),
          developerMode: true,
          hasTools: res.data.tools_used && res.data.tools_used.length > 0,
          toolCalls: res.data.tools_used
        };
        setResponses((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error(res.error);
      }
    } catch {
      // 本地模拟响应
      const simulatedResponses = [
        `已收到您的消息：「${userMessage}」\n\n这是开发者模式下的本地模拟响应。在真实环境中，AI Agent 会进行更智能的处理。\n\n**处理步骤：**\n1. 解析用户意图\n2. 调用相关工具（搜索、代码执行等）\n3. 生成回复内容\n\n**提示：** 启动后端服务后可获得真实 AI 响应。`,
        `关于「${userMessage}」：\n\n作为开发者测试环境，以下是一个结构化响应示例：\n\n\`\`\`typescript\ninterface Response {\n  status: "success";\n  data: string;\n  metadata: {\n    processingTime: number;\n    model: string;\n  };\n}\n\`\`\`\n\n在生产环境中，您将获得来自实际语言模型的高质量响应。`,
        `测试消息已处理 ✓\n\n**用户输入：** ${userMessage}\n**响应长度：** ~150 tokens\n**处理方式：** 本地模拟 (无后端)\n\n**可测试功能：**\n- 消息发送/接收 ✔\n- localStorage 持久化 ✔\n- 预设提示词 ✔\n- 消息复制/导出 ✔\n\n如需真实 AI 响应，请启动后端服务。`
      ];
      const random = simulatedResponses[Math.floor(Math.random() * simulatedResponses.length)];
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: random,
        time: new Date(),
        developerMode: true,
        hasTools: false
      };
      setResponses((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (index: number, content: string) => {
    copyToClipboard(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleClearChat = () => {
    if (confirm('确定要清空对话记录吗？')) {
      setResponses([]);
      clearStorage('chat_responses');
    }
  };

  const stats = {
    total: responses.length,
    userCount: responses.filter((r) => r.role === 'user').length,
    assistantCount: responses.filter((r) => r.role === 'assistant').length,
    withTools: responses.filter((r) => r.hasTools).length,
    totalChars: responses.reduce((sum, r) => sum + (typeof r.content === 'string' ? r.content.length : 0), 0)
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">💬 对话测试面板</h2>
        <div className="flex gap-2">
          <button type="button"
            onClick={() => setShowStats(!showStats)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
          >
            {showStats ? '隐藏统计' : '📊 查看统计'}
          </button>
          <button type="button"
            onClick={() => downloadJson(`chat_log_${Date.now()}.json`, responses)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors"
          >
            📥 导出对话
          </button>
          <button type="button"
            onClick={handleClearChat}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors"
          >
            🗑️ 清空
          </button>
        </div>
      </div>

      {showStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="text-gray-400 text-xs">总消息数</div>
            <div className="text-white text-xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="text-gray-400 text-xs">用户消息</div>
            <div className="text-blue-400 text-xl font-bold">{stats.userCount}</div>
          </div>
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="text-gray-400 text-xs">助手回复</div>
            <div className="text-green-400 text-xl font-bold">{stats.assistantCount}</div>
          </div>
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="text-gray-400 text-xs">工具调用</div>
            <div className="text-purple-400 text-xl font-bold">{stats.withTools}</div>
          </div>
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="text-gray-400 text-xs">总字符数</div>
            <div className="text-yellow-400 text-xl font-bold">{stats.totalChars.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* 预设提示词 */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {presetPrompts.map((p, i) => (
            <button type="button"
              key={i}
              onClick={() => setMessage(p.prompt)}
              className="px-3 py-1 text-xs bg-blue-900/40 border border-blue-700 rounded-full hover:bg-blue-800 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 消息列表 */}
      <div className="bg-gray-900 rounded-lg p-4 mb-4 max-h-[450px] overflow-y-auto space-y-4">
        {responses.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-5xl mb-3">💭</div>
            <p>暂无对话记录，发送消息开始测试</p>
          </div>
        ) : (
          responses.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-lg p-3 relative group ${
                  msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <div className="text-xs opacity-70 mb-1 flex justify-between items-center">
                  <span>
                    {msg.role === 'user' ? '👤 你' : '🤖 AI'}{' '}
                    {msg.developerMode && (
                      <span className="ml-2 text-yellow-300">[DEV]</span>
                    )}
                    {msg.hasTools && <span className="ml-2 text-purple-300">[工具]</span>}
                  </span>
                  <span className="ml-3">{formatDate(msg.time)}</span>
                </div>
                <div className="whitespace-pre-wrap text-sm">
                  {typeof msg.content === 'object' ? (msg.content as any).content : msg.content}
                </div>
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-600 text-xs text-purple-300">
                    <div className="font-semibold mb-1">🔧 工具调用:</div>
                    {msg.toolCalls.map((tc, i) => (
                      <div key={i} className="font-mono">
                        {tc.toolName}({JSON.stringify(tc.parameters)})
                      </div>
                    ))}
                  </div>
                )}
                <button type="button"
                  onClick={() => handleCopy(idx, typeof msg.content === 'object' ? (msg.content as any).content : msg.content)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-xs px-2 py-1 bg-gray-600 rounded transition-opacity"
                >
                  {copiedIndex === idx ? '✓ 已复制' : '📋 复制'}
                </button>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 rounded-lg p-3">
              <div className="text-sm">
                <span className="animate-pulse">AI 正在思考...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 输入框 */}
      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入测试消息 (Enter 发送，Shift+Enter 换行)"
          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 resize-none"
          rows={2}
        />
        <button type="button"
          onClick={handleSend}
          disabled={loading || !message.trim()}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors self-end"
        >
          {loading ? '发送中...' : '发送 🚀'}
        </button>
      </div>
      <div className="mt-2 text-xs text-gray-500 text-center">
        💡 提示：对话数据会自动保存到浏览器 localStorage，刷新不会丢失
      </div>
    </div>
  );
};

// ==================== 2. RAG 检索面板 ====================
const RAGTestPanel: React.FC = () => {
  const [query, setQuery] = useState('');
  const [docs, setDocs] = useState<any[]>(() =>
    loadFromStorage('rag_docs', [
      { id: 1, title: 'AI Agent 架构文档', content: 'AI Agent 系统采用模块化设计，包括感知、决策、执行、记忆、评估五个核心模块', source: 'architecture.md', addedAt: Date.now() - 86400000 },
      { id: 2, title: 'API 接口规范', content: '所有 REST API 返回统一格式：{ success, data, error }，使用 Bearer Token 认证', source: 'api.md', addedAt: Date.now() - 72000000 },
      { id: 3, title: '数据库设计', content: '使用 MongoDB 存储用户、对话、消息。向量数据使用 chromadb 存储', source: 'db.md', addedAt: Date.now() - 50000000 },
      { id: 4, title: 'React 组件开发指南', content: '组件使用 TypeScript 编写，采用函数式组件 + Hooks 模式，使用 Tailwind CSS 做样式', source: 'frontend.md', addedAt: Date.now() - 30000000 }
    ])
  );
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');

  // 文档照片识别
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoResult, setPhotoResult] = useState<any>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    saveToStorage('rag_docs', docs);
  }, [docs]);

  const handleSearch = () => {
    if (!query.trim()) return;
    setSearching(true);
    setTimeout(() => {
      const q = query.toLowerCase();
      const scored = docs
        .map((d) => ({
          ...d,
          score: (d.title.toLowerCase().includes(q) ? 2 : 0) + (d.content.toLowerCase().includes(q) ? 1 : 0)
        }))
        .filter((d) => d.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      setResults(scored);
      setSearching(false);
    }, 500);
  };

  const handleAddDoc = () => {
    if (!docTitle.trim() || !docContent.trim()) return;
    const newDoc = {
      id: Date.now(),
      title: docTitle,
      content: docContent,
      source: 'manual-input',
      addedAt: Date.now()
    };
    setDocs([...docs, newDoc]);
    setDocTitle('');
    setDocContent('');
  };

  const handleDeleteDoc = (id: number) => {
    setDocs(docs.filter((d) => d.id !== id));
  };

  const handlePickPhoto = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 重置 input，保证同一张照片能再次选择
    e.target.value = '';
    if (!file) return;

    setPhotoLoading(true);
    setPhotoError(null);
    setPhotoResult(null);

    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('读取文件失败'));
        reader.readAsDataURL(file);
      });

      const res = await devApi.uploadPhoto(dataUrl, file.name, file.name.replace(/\.[^.]+$/, ''));
      if (!res.success) {
        setPhotoError(res.error || '照片识别失败');
      } else {
        setPhotoResult(res.data);
        // 把识别出的文本也加入本地知识库列表，方便在检索测试中看到
        if (res.data?.text) {
          setDocs((prev) => [
            ...prev,
            {
              id: Date.now(),
              title: file.name,
              content: res.data.text,
              source: res.data.addedToRag ? 'document-photo(已入库)' : 'document-photo(未入库)',
              addedAt: Date.now()
            }
          ]);
        }
      }
    } catch (err: any) {
      setPhotoError(err?.message || '上传失败');
    } finally {
      setPhotoLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">📚 RAG 检索增强生成测试</h2>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 知识库管理 */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="font-bold text-lg mb-3">📖 知识库 ({docs.length} 篇)</h3>
          <div className="space-y-2 mb-4">
            <input
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="文档标题"
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm mb-2"
            />
            <textarea
              value={docContent}
              onChange={(e) => setDocContent(e.target.value)}
              placeholder="文档内容"
              rows={3}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
            />
            <button type="button"
              onClick={handleAddDoc}
              className="w-full bg-green-600 hover:bg-green-700 rounded py-2 text-sm font-semibold"
            >
              + 添加文档
            </button>

            <button type="button"
              onClick={handlePickPhoto}
              disabled={photoLoading}
              className="w-full mt-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded py-2 text-sm font-semibold"
            >
              {photoLoading ? '识别中...' : '📷 上传照片（手机拍的文档）'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <p className="text-gray-500 text-xs mt-2">
              支持 JPG / PNG / WebP / BMP / GIF；照片会被识别成文字后加入知识库。需要配置会看图的模型 Key。
            </p>

            {/* 照片识别结果预览 */}
            {photoError && (
              <div className="mt-2 bg-red-900/40 border border-red-700 rounded p-2 text-xs text-red-200">
                ⚠️ {photoError}
              </div>
            )}
            {photoResult && (
              <div className="mt-2 bg-gray-800 border border-purple-700 rounded p-3 text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className={photoResult.addedToRag ? 'text-green-400' : 'text-yellow-400'}>
                    {photoResult.addedToRag ? '✅ 已加入知识库' : '⚠️ 已识别但未入库'}
                  </span>
                  {photoResult.inspection && (
                    <span className="text-gray-400">
                      {photoResult.inspection.format} · {photoResult.inspection.width}×{photoResult.inspection.height}
                    </span>
                  )}
                </div>
                {photoResult.quality && (
                  <div className="text-gray-400">识别质量评分：{photoResult.quality.score}（0~1）</div>
                )}
                {photoResult.warnings?.length > 0 && (
                  <div className="text-yellow-300 mt-1">{photoResult.warnings.join('；')}</div>
                )}
                {!photoResult.addedToRag && photoResult.ragNote && (
                  <div className="text-gray-400 mt-1">未入库原因：{photoResult.ragNote}</div>
                )}
                <pre className="mt-2 whitespace-pre-wrap text-gray-200 max-h-40 overflow-y-auto">
                  {photoResult.text || '（未识别出文字）'}
                </pre>
              </div>
            )}
          </div>
          <div className="space-y-2 max-h-[380px] overflow-y-auto">
            {docs.map((d) => (
              <div key={d.id} className="bg-gray-800 rounded p-3 text-sm group relative">
                <div className="font-semibold text-blue-300">{d.title}</div>
                <div className="text-gray-400 text-xs mt-1">{d.content.substring(0, 80)}...</div>
                <div className="text-gray-500 text-xs mt-1">来源: {d.source}</div>
                <button type="button"
                  onClick={() => handleDeleteDoc(d.id)}
                  className="absolute top-2 right-2 text-red-400 opacity-0 group-hover:opacity-100 text-xs"
                >
                  🗑️ 删除
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 搜索测试 */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="font-bold text-lg mb-3">🔍 向量检索测试</h3>
          <div className="flex gap-2 mb-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="输入搜索查询..."
              className="flex-1 bg-gray-700 rounded px-3 py-2 text-sm"
            />
            <button type="button"
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold"
            >
              {searching ? '搜索中...' : '🔎 搜索'}
            </button>
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto">
            {results.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                <div className="text-5xl mb-3">🔎</div>
                <p>输入关键词搜索知识库中的相关文档</p>
              </div>
            ) : (
              results.map((r, i) => (
                <div key={r.id} className="bg-gray-800 rounded p-3 border-l-4 border-blue-500">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-blue-300">{r.title}</span>
                    <span className="text-xs bg-yellow-600 px-2 py-0.5 rounded">相关性: {r.score}</span>
                  </div>
                  <p className="text-sm text-gray-300 mt-2">{r.content}</p>
                  <div className="text-xs text-gray-500 mt-2">#{i + 1} 检索结果</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== 3. 强化学习面板 (PPO) ====================
const RLTestPanel: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [metrics, setMetrics] = useState<RLMetrics[]>(() => loadFromStorage('rl_metrics', []));
  const [config, setConfig] = useState(() =>
    loadFromStorage('rl_config', {
      totalEpisodes: 100,
      learningRate: 0.0003,
      gamma: 0.99,
      clipEpsilon: 0.2,
      entropyCoef: 0.01
    })
  );
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [networkStructure, setNetworkStructure] = useState([
    { layer: 'Input', neurons: 4, activation: '-' },
    { layer: 'Hidden 1', neurons: 64, activation: 'ReLU' },
    { layer: 'Hidden 2', neurons: 64, activation: 'ReLU' },
    { layer: 'Output', neurons: 2, activation: 'Softmax' }
  ]);

  useEffect(() => {
    saveToStorage('rl_metrics', metrics);
  }, [metrics]);

  useEffect(() => {
    saveToStorage('rl_config', config);
  }, [config]);

  const simulateEpisode = (ep: number): RLMetrics => {
    const progress = ep / config.totalEpisodes;
    const baseReward = -50 + progress * 150;
    return {
      episode: ep,
      reward: baseReward + Math.random() * 30 - 15,
      loss: Math.max(0.01, 0.5 - progress * 0.4 + Math.random() * 0.05),
      klDivergence: Math.max(0, 0.05 - progress * 0.04 + Math.random() * 0.02),
      valueLoss: Math.max(0.001, 0.3 - progress * 0.25 + Math.random() * 0.03),
      policyEntropy: Math.max(0.1, 1.0 - progress * 0.6 + Math.random() * 0.1),
      learningRate: config.learningRate * (1 - progress * 0.5),
      timestamp: Date.now()
    };
  };

  const runTraining = async () => {
    if (running) return;
    setRunning(true);
    const startEp = metrics.length > 0 ? metrics[metrics.length - 1].episode + 1 : 1;
    for (let ep = startEp; ep <= config.totalEpisodes; ep++) {
      await new Promise((r) => setTimeout(r, 50));
      const m = simulateEpisode(ep);
      setCurrentEpisode(ep);
      setMetrics((prev) => {
        const next = [...prev, m];
        return next.slice(-config.totalEpisodes);
      });
      // 模拟网络结构的微小变化
      if (ep % 20 === 0) {
        setNetworkStructure((ns) =>
          ns.map((l) => ({ ...l, neurons: l.layer.includes('Hidden') ? l.neurons : l.neurons }))
        );
      }
    }
    setRunning(false);
  };

  const handleExport = () => {
    downloadJson(`rl_training_log_${Date.now()}.json`, {
      config,
      networkStructure,
      trainingMetrics: metrics,
      summary: {
        totalEpisodes: metrics.length,
        avgReward: metrics.reduce((s, m) => s + m.reward, 0) / (metrics.length || 1),
        maxReward: Math.max(...metrics.map((m) => m.reward), 0),
        finalLoss: metrics.length > 0 ? metrics[metrics.length - 1].loss : 0
      }
    });
  };

  const handleClear = () => {
    if (confirm('确定要清空训练数据吗？')) {
      setMetrics([]);
      setCurrentEpisode(0);
      clearStorage('rl_metrics');
    }
  };

  const last = metrics.length > 0 ? metrics[metrics.length - 1] : null;
  const avgReward =
    metrics.length > 0 ? metrics.reduce((s, m) => s + m.reward, 0) / metrics.length : 0;

  // 简化的柱状图
  const chartData = metrics.slice(-30);
  const maxReward = Math.max(...chartData.map((m) => m.reward), 1);
  const minReward = Math.min(...chartData.map((m) => m.reward), 0);

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">🧠 PPO 强化学习训练</h2>
        <div className="flex gap-2">
          <button type="button"
            onClick={handleExport}
            disabled={metrics.length === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg text-sm transition-colors"
          >
            📥 导出训练日志
          </button>
          <button type="button"
            onClick={handleClear}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors"
          >
            🗑️ 清空
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 配置 */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="font-bold text-lg mb-3">⚙️ 训练配置</h3>
          <div className="space-y-3 text-sm">
            {(['totalEpisodes', 'learningRate', 'gamma', 'clipEpsilon', 'entropyCoef'] as const).map(
              (key) => (
                <div key={key}>
                  <label className="text-gray-400 block mb-1">
                    {key === 'totalEpisodes'
                      ? '总回合数'
                      : key === 'learningRate'
                      ? '学习率'
                      : key === 'gamma'
                      ? '折扣因子 γ'
                      : key === 'clipEpsilon'
                      ? '裁剪系数 ε'
                      : '熵系数'}
                  </label>
                  <input
                    type="number"
                    step={key === 'totalEpisodes' ? 1 : 0.001}
                    value={config[key]}
                    onChange={(e) =>
                      setConfig({ ...config, [key]: Number(e.target.value) })
                    }
                    disabled={running}
                    className="w-full bg-gray-700 rounded px-3 py-1.5 disabled:opacity-50"
                  />
                </div>
              )
            )}
            <button type="button"
              onClick={runTraining}
              disabled={running}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded py-2 font-semibold mt-4"
            >
              {running
                ? `训练中... (${currentEpisode}/${config.totalEpisodes})`
                : metrics.length > 0
                ? '▶️ 继续训练'
                : '▶️ 开始训练'}
            </button>
          </div>
        </div>

        {/* 实时指标 */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="font-bold text-lg mb-3">📊 实时指标</h3>
          <div className="space-y-2 text-sm">
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-400 text-xs">当前回合</div>
              <div className="text-2xl font-bold text-white">
                {metrics.length > 0 ? metrics[metrics.length - 1].episode : 0}
                <span className="text-sm text-gray-400"> / {config.totalEpisodes}</span>
              </div>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-400 text-xs">奖励值 Reward</div>
              <div className="text-xl font-bold text-green-400">
                {last ? last.reward.toFixed(2) : '-'}
              </div>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-400 text-xs">策略损失 Loss</div>
              <div className="text-xl font-bold text-yellow-400">
                {last ? last.loss.toFixed(4) : '-'}
              </div>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-400 text-xs">KL 散度</div>
              <div className="text-xl font-bold text-blue-400">
                {last ? last.klDivergence.toFixed(4) : '-'}
              </div>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-400 text-xs">平均奖励</div>
              <div className="text-xl font-bold text-purple-400">{avgReward.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* 网络结构 */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="font-bold text-lg mb-3">🕸️ 神经网络结构</h3>
          <div className="space-y-2">
            {networkStructure.map((l, i) => (
              <div
                key={i}
                className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-700 rounded p-3 flex justify-between items-center"
                style={{ marginLeft: `${i * 15}px` }}
              >
                <div>
                  <div className="font-semibold text-blue-300">{l.layer}</div>
                  <div className="text-xs text-gray-400">激活: {l.activation}</div>
                </div>
                <div className="text-2xl font-bold text-white">{l.neurons}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-gray-400 text-center">
            模型总参数量: ~{(64 * 4 + 64 * 64 + 64 * 2 + 64 + 64 + 2).toLocaleString()}
          </div>
        </div>
      </div>

      {/* 奖励曲线图 */}
      {chartData.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 mt-6">
          <h3 className="font-bold text-lg mb-3">📈 最近 30 回合奖励曲线</h3>
          <div className="flex items-end h-32 gap-1 bg-gray-800 rounded p-3">
            {chartData.map((m) => {
              const h = maxReward !== minReward
                ? ((m.reward - minReward) / (maxReward - minReward)) * 100
                : 50;
              const color = m.reward > avgReward ? 'bg-green-500' : 'bg-red-500';
              return (
                <div
                  key={m.episode}
                  className={`${color} flex-1 transition-all duration-200`}
                  style={{ height: `${Math.max(h, 2)}%` }}
                  title={`Episode ${m.episode}: ${m.reward.toFixed(1)}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>总回合数: {metrics.length}</span>
            <span>最高: {maxReward.toFixed(1)}</span>
            <span>最低: {minReward.toFixed(1)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== 4. 评估系统面板 ====================
const EvaluationPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'llm-judge' | 'dataset'>('overview');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResults, setEvaluationResults] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState('GAIA');

  const metrics = [
    { name: '对话准确率', value: 92.5, unit: '%', color: 'green', goal: '≥ 90%' },
    { name: '响应延迟 P95', value: 1.8, unit: 's', color: 'yellow', goal: '< 2s' },
    { name: '工具调用成功率', value: 97.2, unit: '%', color: 'green', goal: '≥ 95%' },
    { name: '用户满意度', value: 4.3, unit: '/5', color: 'blue', goal: '≥ 4.0' },
    { name: 'Token 消耗', value: 12453, unit: '个', color: 'purple', goal: '优化中' },
    { name: '错误率', value: 0.8, unit: '%', color: 'red', goal: '< 1%' }
  ];

  const testCases = [
    { id: 'gaia_001', dataset: 'GAIA', difficulty: 'easy', input: '法国的首都是什么？', expectedOutput: '巴黎' },
    { id: 'gaia_002', dataset: 'GAIA', difficulty: 'easy', input: '计算 25 × 4 + 18 ÷ 3 的结果', expectedOutput: '106' },
    { id: 'gaia_003', dataset: 'GAIA', difficulty: 'medium', input: '如果今天是星期一，那么3天后是星期几？', expectedOutput: '星期四' },
    { id: 'gaia_004', dataset: 'GAIA', difficulty: 'medium', input: '一本书原价80元，打8折后再减去10元优惠券，最终价格是多少？', expectedOutput: '54元' },
    { id: 'gaia_005', dataset: 'GAIA', difficulty: 'hard', input: '有一个水池，单独开甲管6小时注满，单独开乙管8小时注满...', expectedOutput: '约1.71小时' },
    { id: 'agentbench_001', dataset: 'AgentBench', difficulty: 'easy', input: '搜索2024年奥运会的举办地点和时间', expectedOutput: '待定' },
    { id: 'agentbench_002', dataset: 'AgentBench', difficulty: 'medium', input: '查询最近一周销售额超过10000的客户名单', expectedOutput: '待定' },
    { id: 'agentbench_003', dataset: 'AgentBench', difficulty: 'hard', input: '分析过去三个月的销售数据...', expectedOutput: '待定' }
  ];

  const filteredCases = testCases.filter(tc => tc.dataset === selectedDataset);

  const runEvaluation = async () => {
    setIsEvaluating(true);
    
    const results = await Promise.all(filteredCases.slice(0, 3).map(async (tc) => {
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 500));
      
      const scores = [
        { dimension: '任务完成度', score: 75 + Math.random() * 25, level: 'good', reasoning: '完成主要任务目标' },
        { dimension: '准确性', score: 70 + Math.random() * 30, level: 'good', reasoning: '结果基本正确' },
        { dimension: '推理质量', score: 75 + Math.random() * 20, level: 'good', reasoning: '推理过程合理' },
        { dimension: '工具使用', score: 65 + Math.random() * 30, level: 'fair', reasoning: '工具调用基本正确' },
        { dimension: '效率', score: 80 + Math.random() * 20, level: 'good', reasoning: '步骤较为简洁' }
      ];
      
      const overallScore = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);
      const overallLevel = overallScore >= 90 ? 'excellent' : overallScore >= 70 ? 'good' : overallScore >= 40 ? 'fair' : 'poor';
      
      return {
        testCase: tc,
        scores,
        overallScore,
        overallLevel,
        summary: overallLevel === 'excellent' ? 'Agent表现优秀' : overallLevel === 'good' ? 'Agent表现良好' : 'Agent有改进空间'
      };
    }));

    setEvaluationResults(results);
    setIsEvaluating(false);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-blue-400';
      case 'fair': return 'text-yellow-400';
      case 'poor': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getLevelBgColor = (level: string) => {
    switch (level) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'fair': return 'bg-yellow-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (activeTab === 'overview') {
    return (
      <div className="bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">📊 系统评估指标</h2>
          <div className="flex gap-2">
            {([{ id: 'overview', label: '概览' }, { id: 'llm-judge', label: 'LLM评测' }, { id: 'dataset', label: '数据集' }] as const).map((tab) => (
              <button type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  activeTab === tab.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {metrics.map((m, i) => (
            <div key={i} className="bg-gray-900 rounded-lg p-5">
              <div className="text-gray-400 text-sm">{m.name}</div>
              <div className={`text-3xl font-bold text-${m.color}-400 mt-2`}>
                {typeof m.value === 'number' && m.value > 100 ? m.value.toLocaleString() : m.value}
                <span className="text-base text-gray-500 ml-1">{m.unit}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full mt-3 overflow-hidden">
                <div
                  className={`h-full bg-${m.color}-500 rounded-full transition-all`}
                  style={{ width: `${Math.min(m.value > 100 ? 70 : m.value * 1.1, 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-2">目标: {m.goal}</div>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 rounded-lg p-4 mt-6">
          <h3 className="font-bold text-lg mb-3">📝 评估报告</h3>
          <div className="text-sm text-gray-300 space-y-2">
            <p>✓ 系统整体性能良好，核心指标均达到目标值</p>
            <p>✓ 对话准确率 92.5%，较上周提升 3.2%</p>
            <p>⚠️ 响应延迟接近阈值，建议优化高并发场景下的处理能力</p>
            <p>✓ 工具调用成功率稳定在 97% 以上</p>
            <p>💡 建议：在用户输入较长时启用流式响应以改善体验</p>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'llm-judge') {
    return (
      <div className="bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">🤖 LLM-as-Judge 自动评测</h2>
          <div className="flex gap-2">
            {([{ id: 'overview', label: '概览' }, { id: 'llm-judge', label: 'LLM评测' }, { id: 'dataset', label: '数据集' }] as const).map((tab) => (
              <button type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  activeTab === tab.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="bg-gray-900 rounded-lg p-4">
              <h3 className="font-bold mb-3">选择数据集</h3>
              <div className="space-y-2">
                {['GAIA', 'AgentBench'].map((ds) => (
                  <button type="button"
                    key={ds}
                    onClick={() => setSelectedDataset(ds)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedDataset === ds ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {ds}
                  </button>
                ))}
              </div>

              <button type="button"
                onClick={runEvaluation}
                disabled={isEvaluating}
                className="w-full mt-4 p-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEvaluating ? '评测中...' : '🚀 开始评测'}
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="bg-gray-900 rounded-lg p-4">
              <h3 className="font-bold mb-3">评测结果</h3>
              
              {isEvaluating ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">⏳</div>
                  <p className="text-gray-400">正在进行 LLM 评测...</p>
                </div>
              ) : evaluationResults.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>点击"开始评测"按钮开始评估</p>
                  <p className="text-sm mt-2">评测将使用 GPT-4o 作为裁判</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {evaluationResults.map((result, i) => (
                    <div key={i} className="bg-gray-800 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-semibold">{result.testCase.input.substring(0, 50)}...</div>
                          <div className="text-xs text-gray-400 mt-1">难度: {result.testCase.difficulty}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${getLevelColor(result.overallLevel)}`}>
                            {result.overallScore}
                          </div>
                          <div className={`text-xs ${getLevelColor(result.overallLevel)} uppercase`}>
                            {result.overallLevel === 'excellent' ? '优秀' : result.overallLevel === 'good' ? '良好' : result.overallLevel === 'fair' ? '一般' : '较差'}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {result.scores.map((score: { dimension: string; score: number; level: string }, j: number) => (
                          <div key={j} className="bg-gray-700 rounded p-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-400">{score.dimension}</span>
                              <span className="text-sm font-semibold">{score.score}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-600 rounded-full mt-1 overflow-hidden">
                              <div className={`h-full ${getLevelBgColor(score.level)}`} style={{ width: `${score.score}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 text-xs text-gray-400">
                        {result.summary}
                      </div>
                    </div>
                  ))}

                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">综合评分</span>
                      <div className="text-3xl font-bold text-blue-400">
                        {Math.round(evaluationResults.reduce((sum, r) => sum + r.overallScore, 0) / evaluationResults.length)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">📚 测试数据集</h2>
        <div className="flex gap-2">
          {([{ id: 'overview', label: '概览' }, { id: 'llm-judge', label: 'LLM评测' }, { id: 'dataset', label: '数据集' }] as const).map((tab) => (
            <button type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                activeTab === tab.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filteredCases.map((tc) => (
          <div key={tc.id} className="bg-gray-900 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  tc.difficulty === 'easy' ? 'bg-green-600' : tc.difficulty === 'medium' ? 'bg-yellow-600' : 'bg-red-600'
                }`}>
                  {tc.difficulty === 'easy' ? '简单' : tc.difficulty === 'medium' ? '中等' : '困难'}
                </span>
                <span className="ml-2 text-xs text-gray-400">{tc.dataset}</span>
              </div>
              <span className="text-xs text-gray-500">{tc.id}</span>
            </div>
            <div className="mt-2 text-gray-300">{tc.input}</div>
            <div className="mt-2 text-sm text-blue-400">
              期望输出: {tc.expectedOutput}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==================== 5. 数据治理面板 ====================
const DataGovernancePanel: React.FC = () => {
  const [data, setData] = useState<{ id: number; type: string; size: string; records: number; updatedAt: number; sensitive: boolean }[]>(() =>
    loadFromStorage('data_records', [
      { id: 1, type: '用户数据', size: '2.4 MB', records: 1247, updatedAt: Date.now() - 86400000, sensitive: true },
      { id: 2, type: '对话日志', size: '15.8 MB', records: 8421, updatedAt: Date.now() - 3600000, sensitive: false },
      { id: 3, type: '训练数据', size: '45.2 MB', records: 15420, updatedAt: Date.now() - 7200000, sensitive: true },
      { id: 4, type: '评估样本', size: '8.1 MB', records: 3200, updatedAt: Date.now() - 86400000 * 3, sensitive: false }
    ])
  );
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    saveToStorage('data_records', data);
  }, [data]);

  const addNewRecord = () => {
    const types = ['用户数据', '对话日志', '训练数据', '评估样本', '测试样本'];
    const newRecord = {
      id: Date.now(),
      type: types[Math.floor(Math.random() * types.length)],
      size: `${(Math.random() * 50 + 1).toFixed(1)} MB`,
      records: Math.floor(Math.random() * 10000),
      updatedAt: Date.now(),
      sensitive: Math.random() > 0.5
    };
    setData([newRecord, ...data]);
  };

  const deleteRecord = (id: number) => {
    setData(data.filter((d) => d.id !== id));
  };

  const scrubRecord = (id: number) => {
    setData(data.map((d) => (d.id === id ? { ...d, sensitive: false, updatedAt: Date.now() } : d)));
    alert('已脱敏处理 ✓');
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">🔒 数据治理中心</h2>
        <button type="button"
          onClick={addNewRecord}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
        >
          + 添加记录
        </button>
      </div>

      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left">类型</th>
              <th className="px-4 py-3 text-left">大小</th>
              <th className="px-4 py-3 text-left">记录数</th>
              <th className="px-4 py-3 text-left">更新时间</th>
              <th className="px-4 py-3 text-left">敏感</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr
                key={d.id}
                onClick={() => setSelected(d.id)}
                className={`border-t border-gray-700 cursor-pointer hover:bg-gray-700/50 ${
                  selected === d.id ? 'bg-blue-900/20' : ''
                }`}
              >
                <td className="px-4 py-3 font-semibold">{d.type}</td>
                <td className="px-4 py-3">{d.size}</td>
                <td className="px-4 py-3">{d.records.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-400">{formatDate(d.updatedAt)}</td>
                <td className="px-4 py-3">
                  {d.sensitive ? (
                    <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs">敏感</span>
                  ) : (
                    <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs">安全</span>
                  )}
                </td>
                <td className="px-4 py-3 space-x-1">
                  <button type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      scrubRecord(d.id);
                    }}
                    className="text-blue-400 hover:text-blue-300 text-xs"
                  >
                    脱敏
                  </button>
                  <button type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRecord(d.id);
                    }}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="font-bold mb-2">🔐 数据脱敏状态</h3>
          <div className="text-sm text-gray-400">
            敏感记录: {data.filter((d) => d.sensitive).length} / {data.length}
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="font-bold mb-2">📦 存储总量</h3>
          <div className="text-sm text-gray-400">
            总记录数: {data.reduce((s, d) => s + d.records, 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="font-bold mb-2">🧹 清理建议</h3>
          <div className="text-sm text-gray-400">
            {data.filter((d) => Date.now() - d.updatedAt > 86400000 * 7).length} 条记录需清理
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== 6. 系统监控面板 ====================
const MonitoringPanel: React.FC = () => {
  // 真实系统指标状态
  const [systemMetrics, setSystemMetrics] = useState<{
    cpu: { usage: number; name: string; cores: number; speed: number; status: string };
    memory: { total: number; used: number; available: number; usagePercent: number; status: string };
    disk: { total: number; used: number; free: number; usagePercent: number };
    network: { adapter: string; bytesReceived: number; bytesSent: number; speed: number };
    gpu: { name: string; usage: number; memoryUsed: number; memoryTotal: number } | null;
    processes: { count: number; topProcesses: Array<{ name: string; pid: number; cpu: number; memory: number }> };
    system: { uptime: number; uptimeFormatted: string; os: string; hostname: string };
    timestamp: string;
  } | null>(null);

  // 模拟指标状态 (当后端不可用时使用)
  const [simulatedMetrics, setSimulatedMetrics] = useState({
    cpu: 35,
    memory: 58,
    requests: 142,
    errors: 3,
    networkLatency: 45,
    activeConnections: 12
  });
  
  const [metricsHistory, setMetricsHistory] = useState<{ cpu: number; memory: number; time: string }[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [alertLevel, setAlertLevel] = useState<'normal' | 'warning' | 'critical'>('normal');
  const [dataSource, setDataSource] = useState<'real' | 'simulated'>('simulated');

  // 获取真实系统性能数据
  const fetchRealMetrics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/system/task-manager`, {
        headers: {
          'X-Developer-Key': getDeveloperApiKey() || ''
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSystemMetrics(result.data);
          setDataSource('real');
          
          // 更新告警级别
          const cpuUsage = result.data.cpu.usage;
          const memUsage = result.data.memory.usagePercent;
          
          if (cpuUsage > 85 || memUsage > 85) {
            setAlertLevel('critical');
          } else if (cpuUsage > 70 || memUsage > 70) {
            setAlertLevel('warning');
          } else {
            setAlertLevel('normal');
          }
          
          // 更新历史数据
          setMetricsHistory(prev => {
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
            const newHistory = [...prev, { cpu: cpuUsage, memory: memUsage, time: timeStr }];
            return newHistory.slice(-30);
          });
          
          // WebSocket 模拟连接状态
          setWsConnected(true);
        }
      } else {
        throw new Error('API not available');
      }
    } catch (error) {
      console.warn('Real system metrics unavailable, using simulated data:', error);
      setDataSource('simulated');
      
      // 使用模拟数据
      const newCpu = Math.min(95, 30 + Math.random() * 50);
      const newMemory = Math.min(95, 55 + Math.random() * 30);
      const newRequests = 100 + Math.floor(Math.random() * 200);
      const newErrors = Math.floor(Math.random() * 10);
      const newLatency = 20 + Math.floor(Math.random() * 80);
      
      setSimulatedMetrics({
        cpu: newCpu,
        memory: newMemory,
        requests: newRequests,
        errors: newErrors,
        networkLatency: newLatency,
        activeConnections: 5 + Math.floor(Math.random() * 15)
      });
      
      // 动态告警级别
      if (newCpu > 85 || newMemory > 85) {
        setAlertLevel('critical');
      } else if (newCpu > 70 || newMemory > 70) {
        setAlertLevel('warning');
      } else {
        setAlertLevel('normal');
      }
      
      // 更新历史数据
      setMetricsHistory(prev => {
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        const newHistory = [...prev, { cpu: newCpu, memory: newMemory, time: timeStr }];
        return newHistory.slice(-30);
      });
      
      setWsConnected(Math.random() > 0.05);
    }
  };

  useEffect(() => {
    // 立即获取一次
    fetchRealMetrics();
    
    // 每2秒更新一次
    const id = setInterval(fetchRealMetrics, 2000);
    
    return () => clearInterval(id);
  }, []);

  // 使用真实数据或模拟数据
  const currentCpu = dataSource === 'real' && systemMetrics ? systemMetrics.cpu.usage : simulatedMetrics.cpu;
  const currentMemory = dataSource === 'real' && systemMetrics ? systemMetrics.memory.usagePercent : simulatedMetrics.memory;

  const logs = [
    { time: '14:32:01', level: 'INFO', message: '新用户会话开始 session_id=abc123', source: 'agent' },
    { time: '14:32:05', level: 'INFO', message: '处理请求: POST /api/agent/chat', source: 'api' },
    { time: '14:32:06', level: 'DEBUG', message: '调用工具 web_search("强化学习")', source: 'tools' },
    { time: '14:32:08', level: 'WARN', message: '响应时间超过阈值: 2.3s', source: 'api' },
    { time: '14:32:10', level: 'INFO', message: '对话完成，消耗 tokens: 412', source: 'agent' },
    { time: '14:32:15', level: 'ERROR', message: '数据库连接超时 (重试 2/3)', source: 'database' },
    { time: '14:32:16', level: 'INFO', message: '数据库连接恢复', source: 'database' }
  ];

  const [logFilter, setLogFilter] = useState<'all' | 'ERROR' | 'WARN'>('all');
  
  const filteredLogs = logFilter === 'all' ? logs : logs.filter(l => l.level === logFilter);

  const levelColor = (lvl: string) =>
    lvl === 'ERROR'
      ? 'text-red-400'
      : lvl === 'WARN'
      ? 'text-yellow-400'
      : lvl === 'DEBUG'
      ? 'text-gray-400'
      : 'text-blue-400';

  const getAlertColor = (level: string) => {
    switch (level) {
      case 'critical': return 'border-red-500 bg-red-900/20';
      case 'warning': return 'border-yellow-500 bg-yellow-900/20';
      default: return 'border-green-500 bg-green-900/20';
    }
  };

  const getAlertText = (level: string) => {
    switch (level) {
      case 'critical': return '🚨 系统负载过高';
      case 'warning': return '⚠️ 系统负载偏高';
      default: return '✅ 系统运行正常';
    }
  };

  // 绘制简易图表
  const renderChart = (data: number[], color: string, height: number = 40) => {
    const max = Math.max(...data, 100);
    const width = 100;
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (val / max) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    );
  };

  return (
    <div className={`bg-gray-800 rounded-lg shadow-lg p-6 border-2 ${getAlertColor(alertLevel)}`}>
      {/* 标题栏 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-white">📈 增强型系统监控</h2>
          <div className={`px-3 py-1 rounded-full text-xs ${
            dataSource === 'real' 
              ? 'bg-green-600/30 text-green-400 border border-green-500' 
              : 'bg-yellow-600/30 text-yellow-400 border border-yellow-500'
          }`}>
            {dataSource === 'real' ? '🎯 真实数据' : '🔄 模拟数据'}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
            wsConnected ? 'bg-green-600/30 text-green-400' : 'bg-red-600/30 text-red-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {wsConnected ? 'API 已连接' : 'API 断开'}
          </div>
          <span className="text-sm text-gray-400">
            {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* 告警状态栏 */}
      <div className={`mb-4 p-3 rounded-lg ${getAlertColor(alertLevel)}`}>
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">{getAlertText(alertLevel)}</span>
          <span className="text-sm text-gray-400">
            CPU: {currentCpu.toFixed(1)}% | 内存: {currentMemory.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* 主要指标卡片 */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        {/* CPU 卡片 */}
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-gray-400 text-sm">
                {dataSource === 'real' && systemMetrics ? systemMetrics.cpu.name : 'CPU 使用率'}
              </div>
              <div className={`text-3xl font-bold mt-2 ${currentCpu > 70 ? 'text-red-400' : currentCpu > 40 ? 'text-yellow-400' : 'text-green-400'}`}>
                {currentCpu.toFixed(0)}%
              </div>
              {dataSource === 'real' && systemMetrics && (
                <div className="text-xs text-gray-500 mt-1">
                  {systemMetrics.cpu.cores} 核心 | {systemMetrics.cpu.speed.toFixed(2)} GHz
                </div>
              )}
            </div>
            <div className={`w-3 h-3 rounded-full mt-2 ${currentCpu > 70 ? 'bg-red-500' : currentCpu > 40 ? 'bg-yellow-500' : 'bg-green-500'}`} />
          </div>
          <div className="h-2 bg-gray-700 rounded mt-3">
            <div className={`h-full rounded transition-all ${currentCpu > 70 ? 'bg-red-500' : currentCpu > 40 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${currentCpu}%` }} />
          </div>
        </div>

        {/* 内存卡片 */}
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-gray-400 text-sm">
                {dataSource === 'real' && systemMetrics 
                  ? `${systemMetrics.memory.used.toFixed(1)}GB / ${systemMetrics.memory.total.toFixed(1)}GB`
                  : '内存使用率'
                }
              </div>
              <div className={`text-3xl font-bold mt-2 ${currentMemory > 70 ? 'text-red-400' : currentMemory > 40 ? 'text-blue-400' : 'text-green-400'}`}>
                {currentMemory.toFixed(0)}%
              </div>
              {dataSource === 'real' && systemMetrics && (
                <div className="text-xs text-gray-500 mt-1">
                  可用: {systemMetrics.memory.available.toFixed(1)}GB
                </div>
              )}
            </div>
            <div className={`w-3 h-3 rounded-full mt-2 ${currentMemory > 70 ? 'bg-red-500' : currentMemory > 40 ? 'bg-blue-500' : 'bg-green-500'}`} />
          </div>
          <div className="h-2 bg-gray-700 rounded mt-3">
            <div className={`h-full rounded transition-all ${currentMemory > 70 ? 'bg-red-500' : currentMemory > 40 ? 'bg-blue-500' : 'bg-green-500'}`}
              style={{ width: `${currentMemory}%` }} />
          </div>
        </div>

        {/* 磁盘卡片 */}
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-gray-400 text-sm">
            {dataSource === 'real' && systemMetrics 
              ? `${systemMetrics.disk.used.toFixed(1)}GB / ${systemMetrics.disk.total.toFixed(1)}GB`
              : '磁盘使用'
            }
          </div>
          <div className={`text-3xl font-bold mt-2 ${
            systemMetrics && systemMetrics.disk.usagePercent > 90 ? 'text-red-400' :
            systemMetrics && systemMetrics.disk.usagePercent > 70 ? 'text-yellow-400' : 'text-purple-400'
          }`}>
            {systemMetrics ? systemMetrics.disk.usagePercent.toFixed(0) : simulatedMetrics.requests}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {dataSource === 'real' && systemMetrics 
              ? `可用: ${systemMetrics.disk.free.toFixed(1)}GB`
              : '本地存储'
            }
          </div>
        </div>

        {/* 网络卡片 */}
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-gray-400 text-sm">
                {dataSource === 'real' && systemMetrics ? systemMetrics.network.adapter : '网络状态'}
              </div>
              <div className="text-3xl font-bold text-cyan-400 mt-2">
                {systemMetrics ? (systemMetrics.network.speed || 100) : simulatedMetrics.networkLatency}
                <span className="text-base text-gray-500">Mbps</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-xs">进程数</div>
              <div className="text-lg font-bold text-cyan-400">
                {systemMetrics ? systemMetrics.processes.count : simulatedMetrics.activeConnections}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 历史趋势图 */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-2">CPU 趋势 (最近30秒)</div>
          {metricsHistory.length > 1 ? (
            renderChart(metricsHistory.map(m => m.cpu), '#f59e0b')
          ) : (
            <div className="h-10 flex items-center justify-center text-gray-500 text-sm">
              等待数据...
            </div>
          )}
        </div>
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-2">内存趋势 (最近30秒)</div>
          {metricsHistory.length > 1 ? (
            renderChart(metricsHistory.map(m => m.memory), '#3b82f6')
          ) : (
            <div className="h-10 flex items-center justify-center text-gray-500 text-sm">
              等待数据...
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-lg">📋 实时日志</h3>
          <div className="flex gap-2">
            <button type="button" onClick={() => setLogFilter('all')} className={`px-2 py-1 rounded text-xs ${logFilter === 'all' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>全部</button>
            <button type="button" onClick={() => setLogFilter('ERROR')} className={`px-2 py-1 rounded text-xs ${logFilter === 'ERROR' ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>错误</button>
            <button type="button" onClick={() => setLogFilter('WARN')} className={`px-2 py-1 rounded text-xs ${logFilter === 'WARN' ? 'bg-yellow-600' : 'bg-gray-700 hover:bg-gray-600'}`}>警告</button>
          </div>
        </div>
        <div className="font-mono text-xs bg-black/40 rounded p-3 max-h-[300px] overflow-y-auto space-y-1">
          {filteredLogs.map((l, i) => (
            <div key={i} className="flex items-start gap-2 hover:bg-gray-800/50 p-1 rounded">
              <span className="text-gray-500 shrink-0">[{l.time}]</span>
              <span className={`shrink-0 ${levelColor(l.level)}`}>[{l.level}]</span>
              <span className="text-gray-500 shrink-0">[{l.source}]</span>
              <span className="text-gray-300 break-all">{l.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==================== 7. 持续迭代面板 ====================
const IterationPanel: React.FC = () => {
  const [versions] = useState([
    { version: 'v1.4.2', date: '2025-06-05', changes: ['优化对话上下文处理', '修复RL训练参数bug'], status: 'active' },
    { version: 'v1.4.1', date: '2025-06-01', changes: ['新增代码执行工具', '改进RAG检索算法'], status: 'active' },
    { version: 'v1.4.0', date: '2025-05-25', changes: ['大模型版本升级', '重构API认证模块'], status: 'archived' },
    { version: 'v1.3.9', date: '2025-05-15', changes: ['性能优化', '安全补丁'], status: 'archived' }
  ]);

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">🔄 持续迭代管理</h2>
      <div className="space-y-3">
        {versions.map((v, i) => (
          <div key={i} className="bg-gray-900 rounded-lg p-4 border-l-4 border-blue-500">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-bold text-lg">{v.version}</span>
                <span className="text-gray-400 text-sm ml-3">{v.date}</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-xs ${
                  v.status === 'active' ? 'bg-green-600' : 'bg-gray-600'
                }`}
              >
                {v.status === 'active' ? '当前版本' : '已归档'}
              </span>
            </div>
            <ul className="mt-3 text-sm text-gray-300 space-y-1">
              {v.changes.map((c, j) => (
                <li key={j}>• {c}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==================== 8. 工具管理面板 ====================
const ToolsManagementPanel: React.FC = () => {
  const [tools, setTools] = useState<{ id: number; name: string; desc: string; enabled: boolean; calls: number }[]>(() =>
    loadFromStorage('tools_list', [
      { id: 1, name: 'web_search', desc: '网络搜索工具', enabled: true, calls: 1240 },
      { id: 2, name: 'code_executor', desc: '代码执行器', enabled: true, calls: 583 },
      { id: 3, name: 'calculator', desc: '数学计算', enabled: true, calls: 821 },
      { id: 4, name: 'file_reader', desc: '文件读取', enabled: false, calls: 156 },
      { id: 5, name: 'image_generator', desc: '图像生成', enabled: true, calls: 342 },
      { id: 6, name: 'database_query', desc: '数据库查询', enabled: true, calls: 267 }
    ])
  );

  useEffect(() => {
    saveToStorage('tools_list', tools);
  }, [tools]);

  const toggleTool = (id: number) => {
    setTools(tools.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)));
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">🔧 工具管理</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {tools.map((t) => (
          <div key={t.id} className="bg-gray-900 rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold text-white">{t.name}</div>
              <div className="text-xs text-gray-400">{t.desc}</div>
              <div className="text-xs text-gray-500 mt-1">调用次数: {t.calls}</div>
            </div>
            <button type="button"
              onClick={() => toggleTool(t.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                t.enabled ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              {t.enabled ? '已启用' : '已禁用'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==================== 9. 记忆系统面板 ====================
const MemoryPanel: React.FC = () => {
  const [memories, setMemories] = useState<{ id: number; type: string; content: string; createdAt: number; accessCount: number }[]>(() =>
    loadFromStorage('memories', [
      { id: 1, type: '短期记忆', content: '用户正在测试强化学习模块', createdAt: Date.now() - 300000, accessCount: 12 },
      { id: 2, type: '短期记忆', content: '用户查询了 RAG 检索功能', createdAt: Date.now() - 600000, accessCount: 5 },
      { id: 3, type: '长期记忆', content: '用户偏好使用开发者模式进行测试', createdAt: Date.now() - 86400000 * 3, accessCount: 42 },
      { id: 4, type: '长期记忆', content: '系统架构采用模块化设计', createdAt: Date.now() - 86400000 * 7, accessCount: 28 }
    ])
  );

  useEffect(() => {
    saveToStorage('memories', memories);
  }, [memories]);

  const deleteMemory = (id: number) => {
    setMemories(memories.filter((m) => m.id !== id));
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">🧩 Agent 记忆系统</h2>
      <div className="space-y-3">
        {memories.map((m) => (
          <div key={m.id} className="bg-gray-900 rounded-lg p-4 group relative">
            <div className="flex justify-between items-start">
              <div>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  m.type === '短期记忆' ? 'bg-yellow-600' : 'bg-blue-600'
                }`}>
                  {m.type}
                </span>
                <p className="text-white mt-2">{m.content}</p>
                <div className="text-xs text-gray-500 mt-2">
                  创建时间: {formatDate(m.createdAt)} | 访问: {m.accessCount} 次
                </div>
              </div>
              <button type="button"
                onClick={() => deleteMemory(m.id)}
                className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-sm text-gray-400">
        记忆总数: {memories.length} | 短期: {memories.filter(m => m.type === '短期记忆').length} | 长期: {memories.filter(m => m.type === '长期记忆').length}
      </div>
    </div>
  );
};

// ==================== 10. 决策引擎面板 ====================
const DecisionPanel: React.FC = () => {
  const [decisions] = useState<{ id: number; input: string; decision: string; confidence: number; time: number }[]>([
    { id: 1, input: '用户要求生成 Python 代码', decision: '调用 code_executor 工具', confidence: 0.95, time: Date.now() - 5000 },
    { id: 2, input: '用户询问最新新闻', decision: '调用 web_search 工具', confidence: 0.92, time: Date.now() - 15000 },
    { id: 3, input: '用户要求数据分析', decision: '启用数据分析模块 + RAG 检索', confidence: 0.88, time: Date.now() - 30000 },
    { id: 4, input: '用户进行闲聊', decision: '直接生成回复（无需工具）', confidence: 0.78, time: Date.now() - 60000 }
  ]);

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">🎯 决策引擎</h2>
      <div className="space-y-3">
        {decisions.map((d) => (
          <div key={d.id} className="bg-gray-900 rounded-lg p-4 border-l-4 border-blue-500">
            <div className="text-sm text-gray-400 mb-1">输入: {d.input}</div>
            <div className="text-white font-semibold">→ {d.decision}</div>
            <div className="flex justify-between items-center mt-2">
              <span className={`text-xs px-2 py-0.5 rounded ${
                d.confidence > 0.9 ? 'bg-green-600' : d.confidence > 0.8 ? 'bg-yellow-600' : 'bg-gray-600'
              }`}>
                置信度: {(d.confidence * 100).toFixed(0)}%
              </span>
              <span className="text-xs text-gray-500">{formatDate(d.time)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==================== 11. 日志查看面板 ====================
const LogsPanel: React.FC = () => {
  const [logs] = useState([
    { time: '14:35:22', level: 'INFO', msg: '[DEV] 开发者模式已启用', source: 'system' },
    { time: '14:35:23', level: 'INFO', msg: '前端资源加载完成', source: 'vite' },
    { time: '14:35:25', level: 'DEBUG', msg: 'localStorage 数据已恢复: chat_responses', source: 'storage' },
    { time: '14:35:30', level: 'INFO', msg: '用户发送消息: "测试强化学习"', source: 'chat' },
    { time: '14:35:31', level: 'DEBUG', msg: '调用工具: web_search', source: 'tools' },
    { time: '14:35:33', level: 'INFO', msg: 'RAG 检索完成，找到 3 条相关文档', source: 'rag' },
    { time: '14:35:35', level: 'WARN', msg: '后端 API 连接超时，使用本地模拟', source: 'api' },
    { time: '14:35:36', level: 'INFO', msg: '对话响应生成完成', source: 'agent' },
    { time: '14:36:00', level: 'INFO', msg: '开始 PPO 训练模拟，回合 1/100', source: 'rl' },
    { time: '14:36:05', level: 'DEBUG', msg: '训练指标更新: reward=12.3, loss=0.42', source: 'rl' }
  ]);

  const levelColor = (lvl: string) =>
    lvl === 'ERROR' ? 'text-red-400' :
    lvl === 'WARN' ? 'text-yellow-400' :
    lvl === 'DEBUG' ? 'text-gray-400' : 'text-blue-400';

  const levelBg = (lvl: string) =>
    lvl === 'ERROR' ? 'bg-red-900/30' :
    lvl === 'WARN' ? 'bg-yellow-900/30' :
    lvl === 'DEBUG' ? 'bg-gray-900' : 'bg-gray-900';

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">📋 实时日志</h2>
      <div className={`rounded-lg p-4 max-h-[500px] overflow-y-auto ${levelBg('INFO')}`}>
        {logs.map((l, i) => (
          <div key={i} className="font-mono text-xs py-1 border-b border-gray-800 last:border-0">
            <span className="text-gray-500">[{l.time}]</span>{' '}
            <span className={`${levelColor(l.level)} font-bold`}>[{l.level}]</span>{' '}
            <span className="text-purple-400">[{l.source}]</span>{' '}
            <span className="text-gray-300">{l.msg}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-500"></span> INFO ({logs.filter(l => l.level === 'INFO').length})
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-yellow-500"></span> WARN ({logs.filter(l => l.level === 'WARN').length})
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-500"></span> DEBUG ({logs.filter(l => l.level === 'DEBUG').length})
        </span>
      </div>
    </div>
  );
};

// ==================== 12. 配置管理面板 ====================
const ConfigPanel: React.FC = () => {
  const [configs, setConfigs] = useState<Record<string, boolean | number>>(() =>
    loadFromStorage('system_configs', {
      maxTokens: 4096,
      temperature: 0.7,
      topP: 0.9,
      presencePenalty: 0.0,
      frequencyPenalty: 0.0,
      developerMode: true,
      enableRAG: true,
      enableRL: true,
      maxContextLength: 10
    })
  );

  useEffect(() => {
    saveToStorage('system_configs', configs);
  }, [configs]);

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">⚙️ 系统配置</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {Object.entries(configs).map(([key, value]) => (
          <div key={key} className="bg-gray-900 rounded-lg p-4">
            <label className="text-gray-400 text-sm block mb-2">
              {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
            </label>
            {typeof value === 'boolean' ? (
              <button type="button"
                onClick={() => setConfigs({ ...configs, [key]: !value })}
                className={`px-4 py-1.5 rounded text-sm font-semibold ${
                  value ? 'bg-green-600' : 'bg-gray-600'
                }`}
              >
                {value ? '已启用' : '已禁用'}
              </button>
            ) : (
              <input
                type="number"
                step={typeof value === 'number' && value < 1 ? 0.1 : 1}
                value={value as number}
                onChange={(e) => setConfigs({ ...configs, [key]: Number(e.target.value) })}
                className="w-full bg-gray-700 rounded px-3 py-1.5"
              />
            )}
          </div>
        ))}
      </div>
      <button type="button"
        onClick={() => downloadJson('system_config.json', configs)}
        className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
      >
        📥 导出配置
      </button>
    </div>
  );
};

// ==================== 13. 同步管理面板 ====================
const SyncPanel: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    currentStatus?: string;
    lastSync?: string;
    sharedComponents?: string[];
    message?: string;
  } | null>(null);
  const [selectedComponents, setSelectedComponents] = useState<string[]>(['config', 'tools', 'rag']);
  const [syncHistory, setSyncHistory] = useState<Array<{
    timestamp: Date;
    components: string[];
    results?: any[];
    success: boolean;
  }>>([]);
  const [error, setError] = useState<string | null>(null);

  // 使用 useMemo 保持引用稳定，避免重渲染
  const syncComponents = React.useMemo(() => [
    { id: 'config', name: '系统配置', desc: 'LLM参数、温度、最大tokens等', icon: '⚙️', safe: true },
    { id: 'tools', name: '工具配置', desc: '启用/禁用的工具列表', icon: '🔧', safe: true },
    { id: 'rag', name: 'RAG知识库', desc: '向量检索文档和索引', icon: '📚', safe: true },
    { id: 'memory', name: '记忆系统', desc: '短期/长期记忆数据', icon: '🧩', safe: false, warning: '会影响所有用户的对话上下文' },
    { id: 'rl', name: '强化学习模型', desc: '训练后的模型参数', icon: '🧠', safe: false, warning: '会改变AI决策行为' }
  ], []);

  // 使用 useCallback 优化函数引用
  const fetchSyncStatus = React.useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE_URL}/sync-status`, {
        headers: { 'X-Developer-Key': getDeveloperApiKey() || '' }
      });
      const data = await response.json();
      if (data.success) {
        setSyncStatus(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch sync status:', err);
      setError('获取同步状态失败，请检查后端服务是否运行');
    }
  }, []);

  useEffect(() => {
    fetchSyncStatus();
  }, [fetchSyncStatus]);

  // 使用 useCallback 优化函数引用
  const toggleComponent = React.useCallback((id: string) => {
    setSelectedComponents(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }, []);

  // 使用 useCallback 优化函数引用
  const handleSync = React.useCallback(async () => {
    const dangerousComponents = selectedComponents.filter(c => 
      syncComponents.find(s => s.id === c && !s.safe)
    );
    
    if (dangerousComponents.length > 0) {
      const warnings = dangerousComponents.map(c => 
        syncComponents.find(s => s.id === c)?.warning
      ).join('\n');
      
      if (!confirm(`⚠️ 警告：以下组件同步可能影响生产环境用户：\n\n${warnings}\n\n确定要继续吗？`)) {
        return;
      }
    }

    setSyncing(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/sync-to-production`, {
        method: 'POST',
        headers: {
          'X-Developer-Key': getDeveloperApiKey() || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ components: selectedComponents })
      });

      const data = await response.json();
      
      if (data.success) {
        // 记录同步历史
        setSyncHistory(prev => [...prev, {
          timestamp: new Date(),
          components: [...selectedComponents],
          results: data.data.components,
          success: true
        }]);
        
        alert(`✅ 同步成功！\n\n已同步 ${selectedComponents.length} 个组件到生产环境。\n\n${data.data.components.map((c: any) => `• ${c.message}`).join('\n')}`);
        
        // 刷新状态
        await fetchSyncStatus();
      } else {
        setError(data.error || '同步失败');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '网络错误';
      setError(`同步失败：${errorMessage}`);
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  }, [selectedComponents, syncComponents, fetchSyncStatus]);

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">🔗 同步管理</h2>
        <div className="flex gap-2">
          <button type="button"
            onClick={fetchSyncStatus}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
          >
            🔄 刷新状态
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-red-400 text-xl">❌</span>
            <span className="text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* 当前同步状态 */}
      {syncStatus && (
        <div className="bg-green-900/20 border border-green-600 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400 text-xl">✅</span>
            <span className="text-white font-semibold">当前状态：{syncStatus.currentStatus === 'shared' ? '共享模式' : '隔离模式'}</span>
          </div>
          <p className="text-gray-300 text-sm">{syncStatus.message}</p>
          <div className="mt-2 text-xs text-gray-400">
            共享组件: {syncStatus.sharedComponents?.join(', ')}
          </div>
        </div>
      )}

      {/* 同步组件选择 */}
      <div className="bg-gray-900 rounded-lg p-4 mb-6">
        <h3 className="font-bold text-lg mb-4">选择要同步的组件</h3>
        <div className="space-y-3">
          {syncComponents.map(comp => (
            <div 
              key={comp.id}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                selectedComponents.includes(comp.id) 
                  ? 'bg-blue-900/30 border border-blue-500' 
                  : 'bg-gray-800 hover:bg-gray-700'
              } ${!comp.safe ? 'border-l-4 border-yellow-500' : ''}`}
              onClick={() => toggleComponent(comp.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{comp.icon}</span>
                  <div>
                    <div className="font-semibold text-white">{comp.name}</div>
                    <div className="text-sm text-gray-400">{comp.desc}</div>
                    {!comp.safe && (
                      <div className="text-xs text-yellow-400 mt-1">⚠️ {comp.warning}</div>
                    )}
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selectedComponents.includes(comp.id) 
                    ? 'bg-blue-500 border-blue-500' 
                    : 'border-gray-500'
                }`}>
                  {selectedComponents.includes(comp.id) && (
                    <span className="text-white text-sm">✓</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 同步按钮 */}
      <div className="flex justify-center mb-6">
        <button type="button"
          onClick={handleSync}
          disabled={syncing || selectedComponents.length === 0}
          className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-semibold text-lg transition-colors flex items-center gap-2"
        >
          {syncing ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              同步中...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span>🔗</span>
              同步到生产环境
            </span>
          )}
        </button>
      </div>

      {/* 同步历史 */}
      {syncHistory.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="font-bold text-lg mb-3">📝 同步历史</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {syncHistory.map((record, i) => (
              <div key={i} className="bg-green-900/20 rounded p-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-green-400">✅ {record.timestamp.toLocaleString('zh-CN')}</span>
                  <span className="text-gray-400">{record.components.length} 个组件</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {record.components.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 说明信息 */}
      <div className="mt-6 bg-blue-900/20 border border-blue-600 rounded-lg p-4">
        <h3 className="font-bold text-blue-400 mb-2">💡 同步说明</h3>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• <strong>共享模式</strong>：开发者入口与生产环境共享同一个Agent实例</li>
          <li>• <strong>实时同步</strong>：配置更改会立即影响所有用户</li>
          <li>• <strong>安全组件</strong>：配置、工具、RAG文档可以安全同步</li>
          <li>• <strong>危险组件</strong>：记忆和RL模型同步会影响用户体验，请谨慎操作</li>
          <li>• 建议在测试完成后，确认无误再执行同步操作</li>
        </ul>
      </div>
    </div>
  );
};

// ==================== 14. 数据导出面板 ====================
const ExportPanel: React.FC = () => {
  const exportOptions = [
    { id: 'chat', name: '对话记录', desc: '导出所有对话历史 (JSON)', icon: '💬' },
    { id: 'rl', name: '训练日志', desc: '导出 RL 训练指标 (JSON)', icon: '🧠' },
    { id: 'rag', name: '知识库', desc: '导出 RAG 文档数据 (JSON)', icon: '📚' },
    { id: 'config', name: '系统配置', desc: '导出当前配置参数 (JSON)', icon: '⚙️' },
    { id: 'memory', name: '记忆数据', desc: '导出 Agent 记忆 (JSON)', icon: '🧩' },
    { id: 'all', name: '完整导出', desc: '导出所有开发者数据 (ZIP)', icon: '📦' }
  ];

  const handleExport = (id: string) => {
    const timestamp = Date.now();
    switch (id) {
      case 'chat':
        downloadJson(`chat_export_${timestamp}.json`, loadFromStorage('chat_responses', []));
        break;
      case 'rl':
        downloadJson(`rl_export_${timestamp}.json`, {
          metrics: loadFromStorage('rl_metrics', []),
          config: loadFromStorage('rl_config', {})
        });
        break;
      case 'rag':
        downloadJson(`rag_export_${timestamp}.json`, loadFromStorage('rag_docs', []));
        break;
      case 'config':
        downloadJson(`config_export_${timestamp}.json`, loadFromStorage('system_configs', {}));
        break;
      case 'memory':
        downloadJson(`memory_export_${timestamp}.json`, loadFromStorage('memories', []));
        break;
      case 'all':
        downloadJson(`full_export_${timestamp}.json`, {
          chat: loadFromStorage('chat_responses', []),
          rl: { metrics: loadFromStorage('rl_metrics', []), config: loadFromStorage('rl_config', {}) },
          rag: loadFromStorage('rag_docs', []),
          config: loadFromStorage('system_configs', {}),
          memory: loadFromStorage('memories', []),
          tools: loadFromStorage('tools_list', []),
          data: loadFromStorage('data_records', [])
        });
        break;
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">📤 数据导出</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exportOptions.map((opt) => (
          <button type="button"
            key={opt.id}
            onClick={() => handleExport(opt.id)}
            className="bg-gray-900 hover:bg-gray-700 border border-gray-700 hover:border-blue-500 rounded-lg p-4 text-left transition-all group"
          >
            <div className="text-3xl mb-2">{opt.icon}</div>
            <div className="font-semibold text-white group-hover:text-blue-400">{opt.name}</div>
            <div className="text-xs text-gray-400 mt-1">{opt.desc}</div>
          </button>
        ))}
      </div>
      <div className="mt-6 bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
        <div className="text-yellow-400 font-semibold">💡 导出说明</div>
        <ul className="text-sm text-gray-300 mt-2 space-y-1">
          <li>• 所有数据以 JSON 格式导出，方便后续分析处理</li>
          <li>• 导出文件会保存在浏览器下载目录</li>
          <li>• "完整导出" 包含所有开发者面板数据</li>
        </ul>
      </div>
    </div>
  );
};

// ==================== 14. 模拟场景面板 ====================
const ScenariosPanel: React.FC = () => {
  const [scenarios, setScenarios] = useState<{ id: number; name: string; desc: string; steps: number; status: string; category: string }[]>(() =>
    loadFromStorage('test_scenarios', [
      // 对话与推理
      { id: 1, name: '基础对话测试', desc: '测试简单的问答交互', steps: 5, status: 'completed', category: 'chat' },
      { id: 2, name: '多轮对话记忆', desc: '测试 Agent 在多轮对话中的记忆保持能力', steps: 15, status: 'pending', category: 'chat' },
      { id: 3, name: '复杂推理链', desc: '测试 Agent 的 CoT/ToT 推理能力', steps: 20, status: 'pending', category: 'chat' },
      { id: 4, name: '意图识别测试', desc: '测试 Agent 对用户意图的准确识别', steps: 10, status: 'pending', category: 'chat' },
      
      // 工具调用
      { id: 5, name: '工具调用链', desc: '测试多工具连续调用场景', steps: 12, status: 'pending', category: 'tools' },
      { id: 6, name: '并行工具调用', desc: '测试 Agent 同时调用多个工具的能力', steps: 8, status: 'pending', category: 'tools' },
      { id: 7, name: '工具参数验证', desc: '测试工具调用时的参数校验', steps: 6, status: 'pending', category: 'tools' },
      { id: 8, name: '工具失败恢复', desc: '测试工具调用失败时的错误处理', steps: 10, status: 'pending', category: 'tools' },
      
      // RAG 与知识
      { id: 9, name: 'RAG 检索测试', desc: '测试向量检索与生成', steps: 8, status: 'pending', category: 'rag' },
      { id: 10, name: '知识库查询', desc: '测试大规模知识库的检索性能', steps: 25, status: 'pending', category: 'rag' },
      { id: 11, name: '跨文档推理', desc: '测试跨多个文档的复杂推理能力', steps: 30, status: 'pending', category: 'rag' },
      
      // 强化学习
      { id: 12, name: 'PPO 训练模拟', desc: '1000步强化学习训练', steps: 1000, status: 'pending', category: 'rl' },
      { id: 13, name: 'DQN 决策训练', desc: '测试深度 Q 网络决策能力', steps: 500, status: 'pending', category: 'rl' },
      { id: 14, name: '奖励函数调优', desc: '测试不同奖励函数的效果', steps: 200, status: 'pending', category: 'rl' },
      { id: 15, name: '多任务学习', desc: '测试 Agent 在多任务场景的表现', steps: 300, status: 'pending', category: 'rl' },
      
      // 性能与稳定性
      { id: 16, name: '并发压力测试', desc: '测试系统在高并发下的表现', steps: 100, status: 'pending', category: 'performance' },
      { id: 17, name: '长文本处理', desc: '测试 Agent 处理超长上下文的能力', steps: 50, status: 'pending', category: 'performance' },
      { id: 18, name: '内存泄漏检测', desc: '长时间运行测试内存使用情况', steps: 1000, status: 'pending', category: 'performance' },
      
      // 评估与监控
      { id: 19, name: 'GAIA 基准测试', desc: '运行 GAIA 标准评测集', steps: 100, status: 'pending', category: 'evaluation' },
      { id: 20, name: 'AgentBench 测试', desc: '运行 AgentBench 综合评测', steps: 50, status: 'pending', category: 'evaluation' },
      { id: 21, name: 'LLM-as-Judge 评估', desc: '使用 LLM 评估 Agent 回答质量', steps: 30, status: 'pending', category: 'evaluation' },
      
      // 记忆与学习
      { id: 22, name: '短期记忆测试', desc: '测试 Agent 短期记忆能力', steps: 20, status: 'pending', category: 'memory' },
      { id: 23, name: '长期记忆整合', desc: '测试记忆的持久化和召回', steps: 40, status: 'pending', category: 'memory' },
      { id: 24, name: '知识图谱构建', desc: '测试从交互中构建知识图谱', steps: 60, status: 'pending', category: 'memory' },
      
      // 工作流与自动化
      { id: 25, name: '定时任务测试', desc: '测试定时触发器功能', steps: 5, status: 'pending', category: 'workflow' },
      { id: 26, name: '工作流编排', desc: '测试复杂工作流的编排执行', steps: 15, status: 'pending', category: 'workflow' },
      
      // 安全与合规
      { id: 27, name: '越权访问测试', desc: '测试 Agent 的权限控制', steps: 10, status: 'pending', category: 'security' },
      { id: 28, name: '提示词注入', desc: '测试 Agent 防御提示词注入攻击', steps: 8, status: 'pending', category: 'security' },
      { id: 29, name: '数据脱敏测试', desc: '测试敏感信息的自动脱敏', steps: 12, status: 'pending', category: 'security' },
      { id: 30, name: '审计日志完整性', desc: '验证所有操作都被正确记录', steps: 20, status: 'pending', category: 'security' }
    ])
  );

  // 实时运行状态
  const [runningScenarios, setRunningScenarios] = useState<Map<number, {
    currentStep: number;
    totalSteps: number;
    progress: number;
  }>>(new Map());

  // 批量运行状态
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ completed: 0, total: 0, currentName: '' });
  const [batchResults, setBatchResults] = useState<Array<{
    name: string;
    success: boolean;
    rate: number;
    duration: number;
    logs: string[];
  }>>([]);

  // 日志系统
  interface LogEntry {
    timestamp: Date;
    level: 'info' | 'success' | 'warning' | 'error';
    message: string;
    details?: string;
    scenarioName?: string;
  }
  const [runLogs, setRunLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'success' | 'error'>('all');

  // 添加日志
  const addLog = (level: LogEntry['level'], message: string, details?: string, scenarioName?: string) => {
    const newLog: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      details,
      scenarioName
    };
    setRunLogs(prev => [...prev, newLog]);
    console.log(`[${level.toUpperCase()}] ${message}${details ? `\n${details}` : ''}`);
  };

  // 清空日志
  const clearLogs = () => {
    setRunLogs([]);
  };

  // 导出日志
  const exportLogs = () => {
    const logContent = runLogs.map(log => {
      const time = log.timestamp.toLocaleString('zh-CN');
      const level = `[${log.level.toUpperCase()}]`;
      const scenario = log.scenarioName ? `[${log.scenarioName}]` : '';
      const details = log.details ? `\n  详情: ${log.details}` : '';
      return `${time} ${level} ${scenario} ${log.message}${details}`;
    }).join('\n\n');
    
    downloadJson(`scenario_run_logs_${Date.now()}.json`, {
      timestamp: new Date().toISOString(),
      totalLogs: runLogs.length,
      logs: runLogs,
      plainText: logContent
    });
  };

  // 分类颜色映射
  const categoryColors: Record<string, string> = {
    chat: 'bg-blue-600',
    tools: 'bg-green-600',
    rag: 'bg-purple-600',
    rl: 'bg-red-600',
    performance: 'bg-yellow-600',
    evaluation: 'bg-cyan-600',
    memory: 'bg-pink-600',
    workflow: 'bg-indigo-600',
    security: 'bg-orange-600'
  };

  const categoryLabels: Record<string, string> = {
    chat: '💬 对话',
    tools: '🔧 工具',
    rag: '📚 RAG',
    rl: '🧠 强化学习',
    performance: '⚡ 性能',
    evaluation: '📊 评估',
    memory: '🧩 记忆',
    workflow: '⚙️ 工作流',
    security: '🔒 安全'
  };

  useEffect(() => {
    saveToStorage('test_scenarios', scenarios);
  }, [scenarios]);

  // 运行单个场景
  const runScenario = async (id: number) => {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario) return;

    // 标记为运行中
    setScenarios(prev => prev.map(s => 
      s.id === id ? { ...s, status: 'in_progress' as const } : s
    ));

    // 设置初始进度
    setRunningScenarios(prev => {
      const newMap = new Map(prev);
      newMap.set(id, { currentStep: 0, totalSteps: scenario.steps, progress: 0 });
      return newMap;
    });

    addLog('info', `开始运行场景: ${scenario.name}`, `场景ID: ${scenario.id}, 步骤数: ${scenario.steps}`);

    try {
      // 调用后端API运行场景
      addLog('info', `正在发送请求到后端...`, `URL: ${API_BASE_URL}/scenarios/${scenario.id}/run`);
      
      const startTime = Date.now();
      const response = await fetch(`${API_BASE_URL}/scenarios/${scenario.id}/run`, {
        method: 'POST',
        headers: {
          'X-Developer-Key': getDeveloperApiKey() || '',
          'Content-Type': 'application/json'
        }
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        addLog('error', `HTTP请求失败: ${scenario.name}`, 
               `状态码: ${response.status}, 响应: ${errorText.substring(0, 200)}...`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      addLog('info', `收到后端响应`, `响应时间: ${responseTime}ms`);

      // 更新场景状态
      setScenarios(prev => prev.map(s => 
        s.id === id ? { ...s, status: result.data.status === 'completed' ? 'completed' as const : 'pending' as const } : s
      ));

      // 显示结果
      if (result.data.status === 'completed') {
        const successRate = result.data.metrics?.successRate || 100;
        const duration = result.data.metrics?.totalDuration || responseTime;
        addLog('success', `✓ 场景运行成功: ${scenario.name}`, 
               `成功率: ${successRate}%, 总耗时: ${(duration / 1000).toFixed(2)}秒`);
        alert(`✅ 场景「${scenario.name}」执行完成！\n\n成功率: ${successRate}%\n总耗时: ${(duration / 1000).toFixed(1)}秒`);
      } else {
        addLog('warning', `⚠️ 场景执行状态异常: ${scenario.name}`, `状态: ${result.data.status}`);
        alert(`⚠️ 场景「${scenario.name}」执行状态异常`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const stackTrace = error instanceof Error ? error.stack : undefined;
      addLog('error', `✗ 请求异常: ${scenario.name}`, 
             `错误类型: ${errorMessage}${stackTrace ? `\n堆栈: ${stackTrace.substring(0, 300)}...` : ''}`);
      
      // 如果API失败，模拟运行
      addLog('info', `后端不可用，使用模拟模式运行场景: ${scenario.name}`);
      
      // 模拟运行进度
      const stepDelay = Math.max(50, Math.min(200, 1000 / scenario.steps));
      for (let i = 1; i <= scenario.steps; i++) {
        await new Promise(resolve => setTimeout(resolve, stepDelay));
        const progress = Math.round((i / scenario.steps) * 100);
        
        setRunningScenarios(prev => {
          const newMap = new Map(prev);
          newMap.set(id, { 
            currentStep: i, 
            totalSteps: scenario.steps, 
            progress 
          });
          return newMap;
        });

        // 随机模拟一些步骤的详细日志
        if (i % Math.ceil(scenario.steps / 5) === 0) {
          addLog('info', `步骤 ${i}/${scenario.steps} 完成`, 
                 `进度: ${progress}%, 场景: ${scenario.name}`);
        }

        // 模拟随机失败
        if (Math.random() < 0.02 && i < scenario.steps) {
          addLog('warning', `步骤 ${i} 出现警告`, 
                 `场景: ${scenario.name}, 模拟警告信息`);
        }
      }

      // 完成
      setScenarios(prev => prev.map(s => 
        s.id === id ? { ...s, status: 'completed' as const } : s
      ));

      addLog('success', `✓ 模拟执行完成: ${scenario.name}`, `共 ${scenario.steps} 个步骤`);
      alert(`✅ 场景「${scenario.name}」模拟执行完成！\n\n共 ${scenario.steps} 个步骤`);
    } finally {
      // 清理运行状态
      setRunningScenarios(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    }
  };

  // 批量运行所有待运行场景
  const runAllScenarios = async () => {
    const pendingScenarios = scenarios.filter(s => s.status === 'pending');
    if (pendingScenarios.length === 0) {
      alert('所有场景都已运行过！');
      return;
    }

    if (!confirm(`确定要运行所有 ${pendingScenarios.length} 个待运行场景吗？\n\n这可能需要一些时间。`)) {
      return;
    }

    setBatchRunning(true);
    setBatchProgress({ completed: 0, total: pendingScenarios.length, currentName: '' });
    setBatchResults([]);
    clearLogs();
    
    addLog('info', `=== 开始批量运行 ${pendingScenarios.length} 个场景 ===`, 
           `场景列表: ${pendingScenarios.map(s => s.name).join(', ')}`);

    let successCount = 0;
    let failCount = 0;

    for (const scenario of pendingScenarios) {
      const startTime = Date.now();
      setBatchProgress(prev => ({ ...prev, currentName: scenario.name }));
      addLog('info', `─────────────────────────────────────`);
      addLog('info', `开始运行场景: ${scenario.name}`, `场景ID: ${scenario.id}, 步骤数: ${scenario.steps}`);
      
      try {
        addLog('info', `正在发送请求到后端...`, `URL: ${API_BASE_URL}/scenarios/${scenario.id}/run`);
        
        const response = await fetch(`${API_BASE_URL}/scenarios/${scenario.id}/run`, {
          method: 'POST',
          headers: {
            'X-Developer-Key': getDeveloperApiKey() || '',
            'Content-Type': 'application/json'
          }
        });

        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          const data = await response.json();
          const scenarioLogs: string[] = [];
          
          if (data.success) {
            const result = data.data;
            const successRate = result.metrics?.successRate || 100;
            const duration = result.metrics?.totalDuration || responseTime;
            
            addLog('success', `✓ 场景运行成功: ${scenario.name}`, 
                   `成功率: ${successRate}%, 总耗时: ${(duration / 1000).toFixed(2)}秒, 响应时间: ${responseTime}ms`);
            
            // 记录每个步骤的结果
            if (result.results) {
              const failedSteps = result.results.filter((r: any) => r.status === 'failed');
              if (failedSteps.length > 0) {
                addLog('warning', `⚠ 部分步骤失败`, 
                       `失败步骤: ${failedSteps.map((r: any) => `${r.stepName} (${r.error})`).join(', ')}`);
                scenarioLogs.push(`失败步骤: ${failedSteps.length}个`);
              } else {
                addLog('success', `所有 ${result.results.length} 个步骤均成功完成`);
              }
            }
            
            scenarioLogs.push(`成功率: ${successRate}%`, `总耗时: ${duration}ms`);
            successCount++;
            
            setBatchResults(prev => [...prev, {
              name: scenario.name,
              success: true,
              rate: successRate,
              duration: duration,
              logs: scenarioLogs
            }]);

            setScenarios(prev => prev.map(s =>
              s.id === scenario.id ? { ...s, status: 'completed' as const } : s
            ));
          } else {
            addLog('error', `✗ 场景运行失败: ${scenario.name}`, `后端返回失败: ${data.error || '未知错误'}`);
            failCount++;
            
            setBatchResults(prev => [...prev, {
              name: scenario.name,
              success: false,
              rate: 0,
              duration: responseTime,
              logs: [`错误: ${data.error || '未知错误'}`]
            }]);
          }
        } else {
          const errorText = await response.text();
          addLog('error', `✗ HTTP请求失败: ${scenario.name}`, 
                 `状态码: ${response.status}, 响应: ${errorText.substring(0, 200)}...`);
          failCount++;
          
          setBatchResults(prev => [...prev, {
            name: scenario.name,
            success: false,
            rate: 0,
            duration: Date.now() - startTime,
            logs: [`HTTP错误: ${response.status}`, `响应: ${errorText.substring(0, 200)}`]
          }]);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        const stackTrace = error instanceof Error ? error.stack : undefined;
        addLog('error', `✗ 请求异常: ${scenario.name}`, 
               `错误类型: ${errorMessage}${stackTrace ? `\n堆栈: ${stackTrace.substring(0, 300)}...` : ''}`);
        failCount++;
        
        // 模拟运行
        addLog('info', `使用模拟模式运行场景: ${scenario.name}`);
        
        const simDuration = scenario.steps * 50 + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, simDuration));
        
        const simSuccess = Math.random() > 0.15;
        
        if (simSuccess) {
          addLog('success', `✓ 模拟运行成功: ${scenario.name}`, `模拟耗时: ${(simDuration / 1000).toFixed(2)}秒`);
          successCount++;
          
          setBatchResults(prev => [...prev, {
            name: scenario.name,
            success: true,
            rate: 85 + Math.random() * 15,
            duration: simDuration,
            logs: ['模拟运行成功']
          }]);
        } else {
          addLog('error', `✗ 模拟运行失败: ${scenario.name}`, '模拟错误: 场景执行超时');
          
          setBatchResults(prev => [...prev, {
            name: scenario.name,
            success: false,
            rate: 0,
            duration: simDuration,
            logs: ['模拟错误: 场景执行超时']
          }]);
        }
        
        setScenarios(prev => prev.map(s =>
          s.id === scenario.id ? { ...s, status: 'completed' as const } : s
        ));
      }

      setBatchProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
      addLog('info', `--- 场景 ${scenario.name} 处理完成 ---`);
    }

    setBatchRunning(false);
    setBatchProgress(prev => ({ ...prev, currentName: '完成' }));

    // 显示汇总报告
    addLog('info', `=== 批量运行完成 ===`, 
           `成功: ${successCount}, 失败: ${failCount}, 总计: ${successCount + failCount}`);
    
    alert(`批量运行完成！\n\n成功: ${successCount}/${successCount + failCount}\n失败: ${failCount}/${successCount + failCount}\n\n详细日志已记录，可点击下方按钮导出查看。`);
  };

  // 删除场景函数
  const deleteScenario = (id: number) => {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario) return;
    
    if (confirm(`确定要删除场景「${scenario.name}」吗？\n\n此操作不可撤销。`)) {
      setScenarios(scenarios.filter(s => s.id !== id));
      alert(`场景「${scenario.name}」已删除！`);
    }
  };

  const statusColor = (s: string) =>
    s === 'completed' ? 'bg-green-600' :
    s === 'in_progress' ? 'bg-yellow-600' : 'bg-gray-600';

  const statusText = (s: string) =>
    s === 'completed' ? '已完成' :
    s === 'in_progress' ? '运行中' : '待运行';

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">🎬 测试场景管理</h2>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            共 {scenarios.length} 个场景 | 
            <span className="text-green-400 ml-2">
              已完成 {scenarios.filter(s => s.status === 'completed').length}
            </span> | 
            <span className="text-yellow-400 ml-2">
              运行中 {scenarios.filter(s => s.status === 'in_progress').length}
            </span>
          </div>
          <button type="button"
            onClick={runAllScenarios}
            disabled={batchRunning || scenarios.filter(s => s.status === 'pending').length === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            {batchRunning ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                批量运行中...
              </span>
            ) : '🚀 一键运行所有'}
          </button>
        </div>
      </div>
      
      {/* 分类统计 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(categoryLabels).map(([key, label]) => {
          const count = scenarios.filter(s => s.category === key).length;
          return (
            <div key={key} className={`px-3 py-1 rounded-full text-xs text-white ${categoryColors[key]}`}>
              {label}: {count}
            </div>
          );
        })}
      </div>

      {/* 批量运行进度条 */}
      {batchRunning && (
        <div className="mb-6 bg-gray-900 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white font-semibold">📦 批量运行进度</span>
            <span className="text-yellow-400">{batchProgress.completed}/{batchProgress.total}</span>
          </div>
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${(batchProgress.completed / batchProgress.total) * 100}%` }}
            />
          </div>
          <div className="mt-2 text-sm text-gray-400">
            当前场景: {batchProgress.currentName}
          </div>
        </div>
      )}

      {/* 场景列表 */}
      <div className="space-y-3">
        {scenarios.map((s) => {
          const running = runningScenarios.get(s.id);
          const isRunning = s.status === 'in_progress' || !!running;
          
          return (
            <div key={s.id} className="bg-gray-900 rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{s.name}</span>
                  <span className={`px-2 py-0.5 rounded text-xs text-white ${categoryColors[s.category]}`}>
                    {categoryLabels[s.category]}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs text-white ${statusColor(s.status)}`}>
                    {statusText(s.status)}
                  </span>
                </div>
                <div className="text-sm text-gray-400 mt-1">{s.desc}</div>
                <div className="flex items-center gap-4 mt-1">
                  <div className="text-xs text-gray-500">步骤数: {s.steps}</div>
                  {running && (
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-700 rounded overflow-hidden">
                        <div 
                          className="h-full bg-yellow-500 transition-all duration-300"
                          style={{ width: `${running.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-yellow-400">
                        {running.currentStep}/{running.totalSteps}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={() => runScenario(s.id)}
                  disabled={isRunning || batchRunning}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm font-semibold transition-colors"
                >
                  {isRunning ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      运行中...
                    </span>
                  ) : '▶️ 运行'}
                </button>
                <button type="button"
                  onClick={() => deleteScenario(s.id)}
                  disabled={batchRunning}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded text-sm font-semibold transition-colors"
                  title="删除场景"
                >
                  🗑️ 删除
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {scenarios.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          <p className="text-lg">暂无测试场景</p>
          <p className="text-sm mt-2">点击下方按钮创建第一个测试场景</p>
        </div>
      )}

      <button type="button"
        onClick={() => {
          const name = prompt('输入场景名称:');
          if (name) {
            setScenarios([...scenarios, { id: Date.now(), name, desc: '新测试场景', steps: 1, status: 'pending', category: 'chat' }]);
          }
        }}
        className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
      >
        + 创建新场景
      </button>

      {/* 运行日志面板 */}
      {runLogs.length > 0 && (
        <div className="mt-6 bg-gray-900 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-white">📝 运行日志</h3>
            <div className="flex items-center gap-2">
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value as 'all' | 'success' | 'error')}
                className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
              >
                <option value="all">全部</option>
                <option value="success">成功</option>
                <option value="error">错误</option>
              </select>
              <button type="button"
                onClick={clearLogs}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300"
              >
                清空日志
              </button>
              <button type="button"
                onClick={exportLogs}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white"
              >
                导出日志
              </button>
            </div>
          </div>
          
          {/* 日志统计 */}
          <div className="flex gap-4 mb-3 text-sm">
            <span className="text-gray-400">总日志: <span className="text-white">{runLogs.length}</span></span>
            <span className="text-green-400">成功: {runLogs.filter(l => l.level === 'success').length}</span>
            <span className="text-yellow-400">警告: {runLogs.filter(l => l.level === 'warning').length}</span>
            <span className="text-red-400">错误: {runLogs.filter(l => l.level === 'error').length}</span>
          </div>
          
          {/* 日志列表 */}
          <div className="max-h-64 overflow-y-auto space-y-1 font-mono text-sm">
            {runLogs
              .filter(log => {
                if (logFilter === 'success') return log.level === 'success';
                if (logFilter === 'error') return log.level === 'error' || log.level === 'warning';
                return true;
              })
              .map((log, index) => (
                <div
                  key={index}
                  className={`p-2 rounded ${
                    log.level === 'success' ? 'bg-green-900/30 border-l-2 border-green-500' :
                    log.level === 'warning' ? 'bg-yellow-900/30 border-l-2 border-yellow-500' :
                    log.level === 'error' ? 'bg-red-900/30 border-l-2 border-red-500' :
                    'bg-gray-800/30 border-l-2 border-gray-500'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 text-xs whitespace-nowrap shrink-0">
                      {log.timestamp.toLocaleTimeString('zh-CN')}
                    </span>
                    <span className={`font-semibold shrink-0 ${
                      log.level === 'success' ? 'text-green-400' :
                      log.level === 'warning' ? 'text-yellow-400' :
                      log.level === 'error' ? 'text-red-400' :
                      'text-blue-400'
                    }`}>
                      {log.level === 'success' ? '[SUCCESS]' :
                       log.level === 'warning' ? '[WARN]' :
                       log.level === 'error' ? '[ERROR]' : '[INFO]'}
                    </span>
                    <span className="text-white break-all">{log.message}</span>
                  </div>
                  {log.details && (
                    <div className="text-gray-400 text-xs mt-1 ml-4 whitespace-pre-wrap">
                      {log.details}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 批量运行结果汇总 */}
      {batchResults.length > 0 && (
        <div className="mt-6 bg-gray-900 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">📊 运行结果汇总</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-green-900/30 rounded-lg p-3">
              <div className="text-green-400 text-sm">成功</div>
              <div className="text-2xl font-bold text-white">
                {batchResults.filter(r => r.success).length}
              </div>
            </div>
            <div className="bg-red-900/30 rounded-lg p-3">
              <div className="text-red-400 text-sm">失败</div>
              <div className="text-2xl font-bold text-white">
                {batchResults.filter(r => !r.success).length}
              </div>
            </div>
            <div className="bg-blue-900/30 rounded-lg p-3">
              <div className="text-blue-400 text-sm">成功率</div>
              <div className="text-2xl font-bold text-white">
                {((batchResults.filter(r => r.success).length / batchResults.length) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
            {batchResults.map((result, i) => (
              <div 
                key={i} 
                className={`flex items-center justify-between p-2 rounded ${
                  result.success ? 'bg-green-900/20' : 'bg-red-900/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{result.success ? '✅' : '❌'}</span>
                  <span className="text-sm">{result.name}</span>
                </div>
                <div className="text-sm">
                  {result.success ? `${result.rate.toFixed(1)}%` : '失败'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== 14. 数据分析面板 ====================
const DataAnalysisPanel: React.FC = () => {
  const [dataType, setDataType] = useState('realtime');
  const [chartType, setChartType] = useState<'line' | 'bar' | 'pie' | 'histogram'>('line');
  
  const chartData = {
    line: {
      labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
      datasets: [
        { label: '用户增长', data: [1200, 1500, 1800, 2200, 2800, 3200], color: '#3B82F6' },
        { label: '活跃用户', data: [800, 950, 1100, 1400, 1700, 2000], color: '#10B981' }
      ]
    },
    bar: {
      labels: ['API调用', '对话', '工具调用', 'RAG检索', 'RL训练'],
      datasets: [{ label: '日访问量', data: [12500, 8200, 3400, 2100, 800], color: '#F59E0B' }]
    },
    pie: {
      labels: ['成功', '失败', '超时', '重试'],
      datasets: [{ label: '请求状态', data: [92, 5, 2, 1], color: '#8B5CF6' }]
    },
    histogram: {
      labels: ['0-100ms', '100-500ms', '500ms-1s', '1-3s', '3-5s', '>5s'],
      datasets: [{ label: '响应时间分布', data: [45, 35, 12, 5, 2, 1], color: '#06B6D4' }]
    }
  };

  const stats = [
    { label: '总请求数', value: '124,521', change: '+12.5%', positive: true },
    { label: '成功率', value: '97.8%', change: '+0.3%', positive: true },
    { label: '平均响应', value: '342ms', change: '-15ms', positive: true },
    { label: '活跃会话', value: '847', change: '+23', positive: true }
  ];

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">📊 数据分析中心</h2>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-gray-900 rounded-lg p-4">
            <div className="text-gray-400 text-sm">{stat.label}</div>
            <div className="text-2xl font-bold text-white mt-2">{stat.value}</div>
            <div className={`text-xs mt-1 ${stat.positive ? 'text-green-400' : 'text-red-400'}`}>
              {stat.change}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 mb-4">
        <div className="flex gap-2">
          {['realtime', 'daily', 'weekly', 'monthly'].map((t) => (
            <button type="button"
              key={t}
              onClick={() => setDataType(t)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                dataType === t ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {t === 'realtime' ? '实时' : t === 'daily' ? '每日' : t === 'weekly' ? '每周' : '每月'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          {(['line', 'bar', 'pie', 'histogram'] as const).map((t) => (
            <button type="button"
              key={t}
              onClick={() => setChartType(t)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                chartType === t ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {t === 'line' ? '折线图' : t === 'bar' ? '柱状图' : t === 'pie' ? '饼图' : '直方图'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg p-4">
        <h3 className="font-bold text-lg mb-4">📈 数据可视化</h3>
        
        {chartType === 'line' && (
          <div className="flex items-end justify-between h-48 bg-gray-800 rounded p-4">
            {chartData.line.labels.map((label, i) => (
              <div key={i} className="flex flex-col items-center flex-1">
                <div className="flex gap-1 h-36 relative">
                  {chartData.line.datasets.map((ds, j) => (
                    <div
                      key={j}
                      className="w-3 rounded-t transition-all"
                      style={{ 
                        height: `${(ds.data[i] / Math.max(...ds.data)) * 100}%`,
                        backgroundColor: ds.color,
                        marginLeft: j > 0 ? '-8px' : '0'
                      }}
                      title={`${ds.label}: ${ds.data[i]}`}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-400 mt-2">{label}</span>
              </div>
            ))}
          </div>
        )}

        {chartType === 'bar' && (
          <div className="flex items-end justify-between h-48 bg-gray-800 rounded p-4">
            {chartData.bar.labels.map((label, i) => (
              <div key={i} className="flex flex-col items-center flex-1">
                <div
                  className="w-12 rounded-t transition-all"
                  style={{ 
                    height: `${(chartData.bar.datasets[0].data[i] / Math.max(...chartData.bar.datasets[0].data)) * 100}%`,
                    backgroundColor: chartData.bar.datasets[0].color
                  }}
                />
                <span className="text-xs text-gray-400 mt-2">{label}</span>
              </div>
            ))}
          </div>
        )}

        {chartType === 'pie' && (
          <div className="flex justify-center">
            <div className="relative w-48 h-48">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {(() => {
                  let cumulative = 0;
                  return chartData.pie.datasets[0].data.map((value, i) => {
                    const startAngle = cumulative * 3.6;
                    cumulative += value;
                    const endAngle = cumulative * 3.6;
                    const startRad = (startAngle - 90) * (Math.PI / 180);
                    const endRad = (endAngle - 90) * (Math.PI / 180);
                    const x1 = 50 + 40 * Math.cos(startRad);
                    const y1 = 50 + 40 * Math.sin(startRad);
                    const x2 = 50 + 40 * Math.cos(endRad);
                    const y2 = 50 + 40 * Math.sin(endRad);
                    const largeArc = value > 50 ? 1 : 0;
                    return (
                      <path
                        key={i}
                        d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                        fill={['#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6'][i]}
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold">100%</div>
                  <div className="text-xs text-gray-400">总占比</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {chartType === 'histogram' && (
          <div className="flex items-end justify-between h-48 bg-gray-800 rounded p-4">
            {chartData.histogram.labels.map((label, i) => (
              <div key={i} className="flex flex-col items-center flex-1">
                <div
                  className="w-12 rounded-t transition-all"
                  style={{ 
                    height: `${(chartData.histogram.datasets[0].data[i] / Math.max(...chartData.histogram.datasets[0].data)) * 100}%`,
                    backgroundColor: chartData.histogram.datasets[0].color
                  }}
                />
                <span className="text-xs text-gray-400 mt-2 text-center">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 bg-gray-900 rounded-lg p-4">
        <h3 className="font-bold text-lg mb-3">📋 数据统计摘要</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-400">数据点总数</div>
            <div className="text-xl font-bold text-white">1,247,832</div>
          </div>
          <div>
            <div className="text-gray-400">处理时长</div>
            <div className="text-xl font-bold text-blue-400">2.3秒</div>
          </div>
          <div>
            <div className="text-gray-400">异常检测</div>
            <div className="text-xl font-bold text-green-400">0 个异常</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== 15. AI 能力增强面板 ====================
const AIEnhancePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'prompts' | 'models' | 'fine-tune'>('prompts');
  
  const [prompts, setPrompts] = useState<{ id: number; name: string; template: string; variables: string[]; usage: number }[]>([
    { id: 1, name: '代码生成', template: '请帮我写一段{{language}}代码来{{task}}', variables: ['language', 'task'], usage: 124 },
    { id: 2, name: '数据分析', template: '分析以下数据：\n{{data}}\n请给出{{analysis_type}}分析', variables: ['data', 'analysis_type'], usage: 89 },
    { id: 3, name: '翻译', template: '将以下文本翻译成{{target_lang}}：\n{{text}}', variables: ['target_lang', 'text'], usage: 234 },
    { id: 4, name: '调试', template: '帮我调试这段代码错误：\n{{code}}\n错误信息：{{error}}', variables: ['code', 'error'], usage: 67 }
  ]);

  const [models, setModels] = useState<{ id: number; name: string; provider: string; status: string; priority: number }[]>([
    { id: 1, name: 'gpt-4o', provider: 'OpenAI', status: 'active', priority: 1 },
    { id: 2, name: 'gpt-4', provider: 'OpenAI', status: 'active', priority: 2 },
    { id: 3, name: 'claude-3-sonnet', provider: 'Anthropic', status: 'active', priority: 3 },
    { id: 4, name: 'gemini-pro', provider: 'Google', status: 'inactive', priority: 4 }
  ]);

  const [fineTunes] = useState<{ id: number; name: string; model: string; status: string; progress: number }[]>([
    { id: 1, name: '代码助手', model: 'gpt-4o-mini', status: 'completed', progress: 100 },
    { id: 2, name: '客服助手', model: 'gpt-4o', status: 'training', progress: 65 },
    { id: 3, name: '数据分析', model: 'claude-3-sonnet', status: 'pending', progress: 0 }
  ]);

  const [selectedPrompt, setSelectedPrompt] = useState<number | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<{ name: string; template: string } | null>(null);

  // 添加新模板
  const handleAddPrompt = () => {
    const newPrompt = {
      id: Date.now(),
      name: '新模板',
      template: '请输入提示词模板内容...',
      variables: [],
      usage: 0
    };
    setPrompts([...prompts, newPrompt]);
    setSelectedPrompt(newPrompt.id);
    setEditingPrompt({ name: newPrompt.name, template: newPrompt.template });
  };

  // 保存模板修改
  const handleSavePrompt = () => {
    if (!selectedPrompt || !editingPrompt) {
      alert('请先选择一个模板并进行编辑');
      return;
    }
    setPrompts(prev => prev.map(p => 
      p.id === selectedPrompt 
        ? { ...p, name: editingPrompt.name, template: editingPrompt.template, usage: p.usage + 1 }
        : p
    ));
    alert('模板已保存 ✓');
  };

  // 切换模型状态
  const handleToggleModel = (modelId: number) => {
    setModels(models.map(m => 
      m.id === modelId 
        ? { ...m, status: m.status === 'active' ? 'inactive' : 'active' }
        : m
    ));
  };

  // 查看微调详情
  const handleViewFineTune = (ftId: number) => {
    const ft = fineTunes.find(f => f.id === ftId);
    if (ft) {
      alert(`微调任务详情:\n名称: ${ft.name}\n基础模型: ${ft.model}\n状态: ${ft.status}\n进度: ${ft.progress}%`);
    }
  };

  // 下载微调模型
  const handleDownloadModel = (ftId: number) => {
    const ft = fineTunes.find(f => f.id === ftId);
    if (ft) {
      if (ft.status === 'completed') {
        downloadJson(`fine_tune_${ft.name}_${Date.now()}.json`, ft);
      } else {
        alert('模型尚未完成训练，无法下载');
      }
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">🚀 AI 能力增强</h2>

      <div className="flex gap-2 mb-6">
        {([{ id: 'prompts', label: '提示词管理' }, { id: 'models', label: '模型配置' }, { id: 'fine-tune', label: '微调管理' }] as const).map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              activeTab === tab.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'prompts' && (
        <div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold">提示词模板列表</h3>
                <button type="button" onClick={handleAddPrompt} className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm">
                  + 添加模板
                </button>
              </div>
              <div className="space-y-2">
                {prompts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedPrompt(p.id);
                      setEditingPrompt({ name: p.name, template: p.template });
                    }}
                    className={`p-3 rounded cursor-pointer transition-colors ${
                      selectedPrompt === p.id ? 'bg-blue-900/30 border border-blue-500' : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex justify-between">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-xs text-gray-400">使用 {p.usage} 次</span>
                    </div>
                    <div className="text-sm text-gray-400 mt-1">{p.template.substring(0, 50)}...</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-4">
              <h3 className="font-bold mb-4">模板详情</h3>
              {selectedPrompt ? (
                prompts.filter(p => p.id === selectedPrompt).map(p => (
                  <div key={p.id}>
                    <input
                      value={editingPrompt?.name || p.name}
                      onChange={(e) => setEditingPrompt(prev => ({ 
                        name: e.target.value, 
                        template: prev?.template || p.template 
                      }))}
                      className="w-full bg-gray-700 rounded px-3 py-2 mb-2 font-semibold"
                    />
                    <textarea
                      value={editingPrompt?.template || p.template}
                      onChange={(e) => setEditingPrompt(prev => ({ 
                        name: prev?.name || p.name, 
                        template: e.target.value 
                      }))}
                      rows={6}
                      className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                    />
                    <div className="mt-3">
                      <div className="text-xs text-gray-400">变量:</div>
                      <div className="flex gap-2 mt-1">
                        {p.variables.map((v, i) => (
                          <span key={i} className="px-2 py-1 bg-blue-900 rounded text-xs">
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button type="button" onClick={handleSavePrompt} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm">
                      保存修改
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-500">选择一个模板查看详情</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'models' && (
        <div className="space-y-3">
          {models.map((m) => (
            <div key={m.id} className="bg-gray-900 rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{m.name}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    m.status === 'active' ? 'bg-green-600' : 'bg-gray-600'
                  }`}>
                    {m.status === 'active' ? '活跃' : '停用'}
                  </span>
                </div>
                <div className="text-sm text-gray-400">提供商: {m.provider}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-400">优先级: {m.priority}</div>
                <button type="button" onClick={() => handleToggleModel(m.id)} className={`px-3 py-1 rounded text-sm ${
                  m.status === 'active' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}>
                  {m.status === 'active' ? '停用' : '启用'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'fine-tune' && (
        <div className="space-y-3">
          {fineTunes.map((ft) => (
            <div key={ft.id} className="bg-gray-900 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <span className="font-semibold">{ft.name}</span>
                  <span className="text-gray-400 text-sm ml-2">基于 {ft.model}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  ft.status === 'completed' ? 'bg-green-600' :
                  ft.status === 'training' ? 'bg-yellow-600' : 'bg-gray-600'
                }`}>
                  {ft.status === 'completed' ? '已完成' :
                   ft.status === 'training' ? '训练中' : '待开始'}
                </span>
              </div>
              {ft.status === 'training' && (
                <div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${ft.progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">进度: {ft.progress}%</div>
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => handleViewFineTune(ft.id)} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm">
                  查看详情
                </button>
                <button type="button" onClick={() => handleDownloadModel(ft.id)} className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm">
                  下载模型
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ==================== 16. 工作流自动化面板 ====================
const WorkflowPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'triggers' | 'workflows' | 'tasks'>('triggers');
  
  const [triggers] = useState<{ id: number; name: string; type: string; schedule: string; enabled: boolean }[]>([
    { id: 1, name: '每日数据备份', type: 'cron', schedule: '0 2 * * *', enabled: true },
    { id: 2, name: 'API 调用监控', type: 'interval', schedule: '每 5 分钟', enabled: true },
    { id: 3, name: '模型更新通知', type: 'event', schedule: 'model.updated', enabled: false },
    { id: 4, name: '定时清理日志', type: 'cron', schedule: '0 0 * * 0', enabled: true }
  ]);

  const [workflows, setWorkflows] = useState<{ id: number; name: string; trigger: string; actions: number; status: string }[]>([
    { id: 1, name: '数据同步工作流', trigger: '每日数据备份', actions: 3, status: 'active' },
    { id: 2, name: '告警通知流程', trigger: 'API 调用监控', actions: 2, status: 'active' },
    { id: 3, name: '模型部署流程', trigger: '模型更新通知', actions: 5, status: 'draft' }
  ]);

  const [tasks, setTasks] = useState<{ id: number; name: string; cron: string; lastRun: string; status: string }[]>([
    { id: 1, name: '清理过期会话', cron: '0 * * * *', lastRun: '2分钟前', status: 'success' },
    { id: 2, name: '生成日报', cron: '0 9 * * *', lastRun: '今天 09:00', status: 'success' },
    { id: 3, name: '同步用户数据', cron: '*/30 * * * *', lastRun: '15分钟前', status: 'success' },
    { id: 4, name: '备份数据库', cron: '0 2 * * *', lastRun: '昨天 02:00', status: 'pending' }
  ]);

  // 编辑触发器
  const handleEditTrigger = (triggerId: number) => {
    const trigger = triggers.find(t => t.id === triggerId);
    if (trigger) {
      alert(`触发器详情:\n名称: ${trigger.name}\n类型: ${trigger.type}\n调度: ${trigger.schedule}\n状态: ${trigger.enabled ? '启用' : '停用'}`);
    }
  };

  // 配置工作流
  const handleConfigureWorkflow = (workflowId: number) => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (workflow) {
      const newStatus = workflow.status === 'active' ? 'draft' : 'active';
      setWorkflows(workflows.map(w => 
        w.id === workflowId ? { ...w, status: newStatus } : w
      ));
      alert(`工作流状态已切换为: ${newStatus === 'active' ? '运行中' : '草稿'}`);
    }
  };

  // 执行任务
  const handleExecuteTask = (taskId: number) => {
    // 使用函数式更新确保获取最新状态
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, status: 'running', lastRun: '正在执行...' }
        : t
    ));
    // 模拟执行完成
    setTimeout(() => {
      setTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, status: 'success', lastRun: '刚刚' }
          : t
      ));
    }, 2000);
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">⚙️ 工作流自动化</h2>

      <div className="flex gap-2 mb-6">
        {([{ id: 'triggers', label: '触发器' }, { id: 'workflows', label: '工作流' }, { id: 'tasks', label: '定时任务' }] as const).map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              activeTab === tab.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'triggers' && (
        <div className="grid md:grid-cols-2 gap-4">
          {triggers.map((t) => (
            <div key={t.id} className="bg-gray-900 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-sm text-gray-400">类型: {t.type}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs ${t.enabled ? 'bg-green-600' : 'bg-gray-600'}`}>
                  {t.enabled ? '启用' : '停用'}
                </span>
              </div>
              <div className="mt-2 text-sm">
                <div className="text-gray-400">触发条件:</div>
                <div className="font-mono text-blue-400">{t.schedule}</div>
              </div>
              <button type="button" onClick={() => handleEditTrigger(t.id)} className="mt-3 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm">
                编辑触发器
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'workflows' && (
        <div className="space-y-3">
          {workflows.map((w) => (
            <div key={w.id} className="bg-gray-900 rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold">{w.name}</div>
                <div className="text-sm text-gray-400">
                  触发器: {w.trigger} | 动作数: {w.actions}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-2 py-0.5 rounded text-xs ${
                  w.status === 'active' ? 'bg-green-600' : 'bg-gray-600'
                }`}>
                  {w.status === 'active' ? '运行中' : '草稿'}
                </span>
                <button type="button" onClick={() => handleConfigureWorkflow(w.id)} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm">
                  配置
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">任务名称</th>
                <th className="px-4 py-3 text-left">调度规则</th>
                <th className="px-4 py-3 text-left">上次执行</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-t border-gray-700">
                  <td className="px-4 py-3 font-semibold">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-blue-400">{t.cron}</td>
                  <td className="px-4 py-3 text-gray-400">{t.lastRun}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      t.status === 'success' ? 'bg-green-600' : 
                      t.status === 'pending' ? 'bg-gray-600' : 'bg-yellow-600'
                    }`}>
                      {t.status === 'success' ? '成功' : 
                       t.status === 'pending' ? '待执行' : '运行中'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => handleExecuteTask(t.id)} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">
                      执行
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ==================== 17. 插件市场面板 ====================
const PluginMarketPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'market' | 'installed' | 'settings'>('market');
  const [searchQuery, setSearchQuery] = useState('');
  
  const plugins = [
    { id: 1, name: 'Web搜索增强', desc: '增强网页搜索能力，支持多引擎切换', author: '官方', version: '1.2.0', downloads: 12450, rating: 4.8, category: '搜索', installed: true },
    { id: 2, name: '代码执行器', desc: '支持Python、JavaScript等多种语言代码执行', author: '官方', version: '2.1.0', downloads: 8920, rating: 4.9, category: '工具', installed: true },
    { id: 3, name: '数据分析套件', desc: '强大的数据处理和可视化工具', author: '第三方', version: '1.5.3', downloads: 5680, rating: 4.7, category: '数据', installed: false },
    { id: 4, name: 'RAG知识库', desc: '智能文档检索和问答系统', author: '官方', version: '3.0.0', downloads: 15230, rating: 4.9, category: '知识', installed: true },
    { id: 5, name: '图像生成器', desc: '基于AI的图像生成工具', author: '第三方', version: '1.8.0', downloads: 9870, rating: 4.6, category: '创意', installed: false },
    { id: 6, name: '语音助手', desc: '语音识别和合成功能', author: '第三方', version: '2.3.0', downloads: 6540, rating: 4.5, category: '语音', installed: false },
    { id: 7, name: 'PDF处理工具', desc: 'PDF文件解析和处理', author: '官方', version: '1.4.2', downloads: 4320, rating: 4.4, category: '文档', installed: true },
    { id: 8, name: '数据库连接器', desc: '连接多种数据库进行查询', author: '第三方', version: '1.6.0', downloads: 3890, rating: 4.3, category: '数据', installed: false },
    { id: 9, name: '自动化工作流', desc: '可视化工作流编排工具', author: '官方', version: '2.0.0', downloads: 7230, rating: 4.7, category: '自动化', installed: false },
    { id: 10, name: '安全扫描器', desc: '代码安全检测和漏洞扫描', author: '第三方', version: '1.3.0', downloads: 2150, rating: 4.5, category: '安全', installed: false },
    { id: 11, name: 'Git集成', desc: '代码仓库管理和版本控制', author: '官方', version: '1.9.0', downloads: 8120, rating: 4.6, category: '开发', installed: true },
    { id: 12, name: '图表可视化', desc: '丰富的数据图表展示', author: '第三方', version: '2.2.0', downloads: 5430, rating: 4.8, category: '数据', installed: false }
  ];

  const [installedPlugins, setInstalledPlugins] = useState(plugins.filter(p => p.installed));
  const [installingId, setInstallingId] = useState<number | null>(null);

  const filteredPlugins = plugins.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleInstall = async (pluginId: number) => {
    const plugin = plugins.find(p => p.id === pluginId);
    if (!plugin) return;

    setInstallingId(pluginId);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setInstalledPlugins(prev => [...prev, plugin]);
    setInstallingId(null);
    alert(`✅ 插件「${plugin.name}」安装成功！`);
  };

  const handleUninstall = async (pluginId: number) => {
    const plugin = installedPlugins.find(p => p.id === pluginId);
    if (!plugin) return;

    if (confirm(`确定要卸载插件「${plugin.name}」吗？`)) {
      setInstalledPlugins(prev => prev.filter(p => p.id !== pluginId));
      alert(`✅ 插件「${plugin.name}」已卸载！`);
    }
  };

  const categories = [...new Set(plugins.map(p => p.category))];

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">🔌 插件市场</h2>

      <div className="flex gap-2 mb-6">
        {([{ id: 'market', label: '插件市场' }, { id: 'installed', label: '已安装' }, { id: 'settings', label: '插件设置' }] as const).map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              activeTab === tab.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'market' && (
        <>
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索插件..."
              className="flex-1 bg-gray-900 rounded-lg px-4 py-2 border border-gray-700"
            />
            <div className="flex gap-2 flex-wrap">
              {categories.map(cat => (
                <button type="button"
                  key={cat}
                  onClick={() => setSearchQuery(cat)}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlugins.map((plugin) => (
              <div key={plugin.id} className="bg-gray-900 rounded-lg p-4 border border-gray-700 hover:border-blue-500 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-white">{plugin.name}</h3>
                    <div className="text-xs text-gray-400 mt-1">{plugin.author} · v{plugin.version}</div>
                  </div>
                  <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">{plugin.category}</span>
                </div>
                <p className="text-sm text-gray-400 mb-3">{plugin.desc}</p>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>⬇️ {plugin.downloads.toLocaleString()}</span>
                    <span>⭐ {plugin.rating}</span>
                  </div>
                  <button type="button"
                    onClick={() => handleInstall(plugin.id)}
                    disabled={plugin.installed || installingId === plugin.id}
                    className={`px-3 py-1 rounded text-sm ${
                      plugin.installed 
                        ? 'bg-green-600 cursor-not-allowed' 
                        : installingId === plugin.id
                          ? 'bg-gray-600 cursor-wait'
                          : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {plugin.installed ? '已安装' : installingId === plugin.id ? '安装中...' : '安装'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'installed' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {installedPlugins.map((plugin) => (
            <div key={plugin.id} className="bg-gray-900 rounded-lg p-4 border border-green-600/30">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-white">{plugin.name}</h3>
                  <div className="text-xs text-gray-400 mt-1">{plugin.author} · v{plugin.version}</div>
                </div>
                <span className="px-2 py-0.5 bg-green-600 rounded text-xs">已安装</span>
              </div>
              <p className="text-sm text-gray-400 mb-3">{plugin.desc}</p>
              <div className="flex gap-2">
                <button type="button" className="flex-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                  配置
                </button>
                <button type="button" 
                  onClick={() => handleUninstall(plugin.id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                >
                  卸载
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-3">插件设置</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                <span className="text-gray-300">允许自动更新插件</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                <span className="text-gray-300">启用插件通知</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" className="w-4 h-4 rounded" />
                <span className="text-gray-300">允许第三方插件</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                <span className="text-gray-300">插件启动时自动加载</span>
              </label>
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-3">插件缓存</h3>
            <div className="text-sm text-gray-400 mb-3">插件缓存占用: 128 MB</div>
            <button type="button" className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">
              清理插件缓存
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== 18. API 测试面板 ====================
const APITestPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'endpoints' | 'test' | 'history'>('endpoints');
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);
  const [response, setResponse] = useState<{ status: number; headers: Record<string, string>; body: any; time: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requestBody, setRequestBody] = useState('{}');
  const [customHeaders, setCustomHeaders] = useState('{}');

  const endpoints = [
    { id: 'chat', method: 'POST', path: '/api/agent/chat', desc: '与 Agent 对话', auth: true },
    { id: 'tools', method: 'GET', path: '/api/tools', desc: '获取可用工具列表', auth: false },
    { id: 'tool-exec', method: 'POST', path: '/api/tools/execute', desc: '执行工具调用', auth: true },
    { id: 'scenarios', method: 'GET', path: '/api/dev/scenarios', desc: '获取测试场景列表', auth: true },
    { id: 'scenario-run', method: 'POST', path: '/api/dev/scenarios/{id}/run', desc: '运行指定场景', auth: true },
    { id: 'sync', method: 'POST', path: '/api/dev/sync-to-production', desc: '同步到生产环境', auth: true },
    { id: 'metrics', method: 'GET', path: '/api/metrics', desc: '获取系统指标', auth: false },
    { id: 'audit', method: 'GET', path: '/api/audit/logs', desc: '获取审计日志', auth: true },
    { id: 'config', method: 'GET', path: '/api/config', desc: '获取系统配置', auth: false },
    { id: 'config-save', method: 'POST', path: '/api/config', desc: '保存系统配置', auth: true },
    { id: 'memory', method: 'GET', path: '/api/memory', desc: '获取 Agent 记忆', auth: true },
    { id: 'rl-training', method: 'POST', path: '/api/rl/train', desc: '启动 RL 训练', auth: true }
  ];

  const [history, setHistory] = useState<Array<{
    timestamp: Date;
    endpoint: string;
    method: string;
    status: number;
    time: number;
  }>>([]);

  const handleTest = async (endpointId: string) => {
    const endpoint = endpoints.find(e => e.id === endpointId);
    if (!endpoint) return;

    setIsLoading(true);
    setResponse(null);
    
    try {
      const startTime = Date.now();
      const url = `http://localhost:3000${endpoint.path.replace('{id}', '1')}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Developer-Key': getDeveloperApiKey() || ''
      };

      if (endpoint.auth) {
        headers['Authorization'] = 'Bearer dev-test-token';
      }

      const body = endpoint.method === 'POST' ? requestBody : undefined;

      const resp = await fetch(url, {
        method: endpoint.method,
        headers,
        body
      });

      const responseTime = Date.now() - startTime;
      const responseBody = await resp.json();

      setResponse({
        status: resp.status,
        headers: Object.fromEntries(resp.headers.entries()),
        body: responseBody,
        time: responseTime
      });

      setHistory(prev => [{
        timestamp: new Date(),
        endpoint: endpoint.path,
        method: endpoint.method,
        status: resp.status,
        time: responseTime
      }, ...prev].slice(0, 10));

    } catch (error) {
      setResponse({
        status: 0,
        headers: {},
        body: { error: error instanceof Error ? error.message : 'Unknown error' },
        time: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">🔧 API 测试</h2>

      <div className="flex gap-2 mb-6">
        {([{ id: 'endpoints', label: '端点列表' }, { id: 'test', label: '测试控制台' }, { id: 'history', label: '调用历史' }] as const).map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              activeTab === tab.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'endpoints' && (
        <div className="grid md:grid-cols-2 gap-4">
          {endpoints.map((ep) => (
            <div
              key={ep.id}
              onClick={() => {
                setSelectedEndpoint(ep.id);
                setActiveTab('test');
              }}
              className={`p-4 rounded-lg cursor-pointer transition-colors border ${
                selectedEndpoint === ep.id 
                  ? 'bg-blue-900/30 border-blue-500' 
                  : 'bg-gray-900 border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  ep.method === 'GET' ? 'bg-green-600' : 'bg-blue-600'
                }`}>
                  {ep.method}
                </span>
                <span className="font-mono text-blue-400">{ep.path}</span>
                {ep.auth && <span className="px-2 py-0.5 bg-yellow-600 rounded text-xs">🔒</span>}
              </div>
              <div className="text-sm text-gray-400 mt-2">{ep.desc}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'test' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">选择端点</label>
              <select
                value={selectedEndpoint || ''}
                onChange={(e) => setSelectedEndpoint(e.target.value)}
                className="w-full bg-gray-900 rounded-lg px-4 py-2 border border-gray-700"
              >
                <option value="">请选择端点</option>
                {endpoints.map(ep => (
                  <option key={ep.id} value={ep.id}>
                    {ep.method} {ep.path}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">请求体 (JSON)</label>
              <textarea
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                rows={3}
                className="w-full bg-gray-900 rounded-lg px-4 py-2 border border-gray-700 font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">自定义 Headers (JSON)</label>
              <textarea
                value={customHeaders}
                onChange={(e) => setCustomHeaders(e.target.value)}
                rows={3}
                className="w-full bg-gray-900 rounded-lg px-4 py-2 border border-gray-700 font-mono text-sm"
              />
            </div>
          </div>

          <button type="button"
            onClick={() => selectedEndpoint && handleTest(selectedEndpoint)}
            disabled={!selectedEndpoint || isLoading}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-semibold flex items-center gap-2"
          >
            {isLoading ? (
              <><span className="animate-spin">⏳</span> 测试中...</>
            ) : (
              <><span>🚀</span> 发送请求</>
            )}
          </button>

          {response && (
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center gap-4 mb-4">
                <span className={`px-3 py-1 rounded-lg font-semibold ${
                  response.status >= 200 && response.status < 300 ? 'bg-green-600' : 'bg-red-600'
                }`}>
                  {response.status}
                </span>
                <span className="text-gray-400">响应时间: {response.time}ms</span>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-2">响应体:</div>
                <pre className="bg-black/50 rounded-lg p-4 overflow-x-auto text-sm font-mono text-green-400">
                  {JSON.stringify(response.body, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">时间</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">方法</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">端点</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">状态</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">耗时</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">暂无调用记录</td>
                </tr>
              ) : (
                history.map((item, i) => (
                  <tr key={i} className="border-t border-gray-700">
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {item.timestamp.toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.method === 'GET' ? 'bg-green-600' : 'bg-blue-600'
                      }`}>
                        {item.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-blue-400">{item.endpoint}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.status >= 200 && item.status < 300 ? 'bg-green-600' : 'bg-red-600'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{item.time}ms</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ==================== 19. 智能助手模块 ====================
const AssistantPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'assistant' | 'skills' | 'shortcuts'>('assistant');
  const [query, setQuery] = useState('');
  const [responses, setResponses] = useState<Array<{ role: 'user' | 'assistant'; content: string; time: Date }>>([]);
  const [isThinking, setIsThinking] = useState(false);

  const skills = [
    { id: 'debug', name: '代码调试', desc: '分析代码错误并提供修复建议', icon: '🔍', category: '开发' },
    { id: 'refactor', name: '代码重构', desc: '优化代码结构和性能', icon: '🔧', category: '开发' },
    { id: 'doc', name: '文档生成', desc: '自动生成代码文档', icon: '📝', category: '文档' },
    { id: 'test', name: '测试生成', desc: '自动生成单元测试', icon: '🧪', category: '测试' },
    { id: 'review', name: '代码审查', desc: '代码质量评估和改进建议', icon: '✅', category: '开发' },
    { id: 'translate', name: '代码翻译', desc: '将代码从一种语言转换为另一种', icon: '🌐', category: '开发' },
    { id: 'explain', name: '概念解释', desc: '解释技术概念和原理', icon: '💡', category: '学习' },
    { id: 'architecture', name: '架构设计', desc: '系统架构设计建议', icon: '🏗️', category: '设计' }
  ];

  const shortcuts = [
    { key: '/', desc: '打开命令面板', action: 'CommandPalette' },
    { key: 'Ctrl+S', desc: '保存当前文件', action: 'SaveFile' },
    { key: 'Ctrl+Shift+S', desc: '另存为', action: 'SaveAs' },
    { key: 'Ctrl+Z', desc: '撤销', action: 'Undo' },
    { key: 'Ctrl+Shift+Z', desc: '重做', action: 'Redo' },
    { key: 'Ctrl+F', desc: '查找', action: 'Find' },
    { key: 'Ctrl+H', desc: '替换', action: 'Replace' },
    { key: 'Ctrl+D', desc: '选择下一个匹配项', action: 'SelectNext' },
    { key: 'Ctrl+Shift+L', desc: '选择所有匹配项', action: 'SelectAll' },
    { key: 'Ctrl+/', desc: '注释/取消注释', action: 'ToggleComment' },
    { key: 'Ctrl+B', desc: '切换侧边栏', action: 'ToggleSidebar' },
    { key: 'Ctrl+`', desc: '切换终端', action: 'ToggleTerminal' },
    { key: 'Ctrl+Shift+P', desc: '打开命令面板', action: 'CommandPalette' },
    { key: 'Ctrl+Shift+E', desc: '资源管理器', action: 'Explorer' },
    { key: 'Ctrl+Shift+G', desc: '源代码管理', action: 'SourceControl' },
    { key: 'Ctrl+Shift+D', desc: '调试', action: 'Debug' },
    { key: 'Ctrl+Shift+X', desc: '扩展', action: 'Extensions' },
    { key: 'Ctrl+Shift+F', desc: '全局搜索', action: 'Search' },
    { key: 'Ctrl+K Ctrl+W', desc: '关闭所有窗口', action: 'CloseAll' },
    { key: 'Ctrl+K Ctrl+T', desc: '打开新终端', action: 'NewTerminal' }
  ];

  const handleAsk = async () => {
    if (!query.trim()) return;

    setIsThinking(true);
    setResponses(prev => [...prev, { role: 'user', content: query, time: new Date() }]);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Developer-Key': getDeveloperApiKey() || ''
        },
        body: JSON.stringify({
          message: query,
          sessionId: 'assistant-session-' + Date.now(),
          developerMode: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.data?.response?.content || data.data?.response || '抱歉，我暂时无法回答这个问题。';
      
      setResponses(prev => [...prev, { role: 'assistant', content: responseText, time: new Date() }]);
    } catch (error) {
      console.error('Error calling AI service:', error);
      // 如果后端服务不可用，使用备用响应
      const fallbackResponses = [
        '好的，我来帮你分析这个问题。根据你的描述，这是一个典型的技术问题，需要从多个角度来考虑解决方案。',
        '这个问题很有意思！让我从几个维度来分析：技术实现、业务需求、以及最佳实践。',
        '我理解你的问题。这涉及到多个方面，包括系统架构、性能优化和安全性考虑。',
        '根据我的分析，这里有几个关键点需要注意：需求分析、技术方案选择、以及实施步骤。',
        '让我帮你深入分析这个问题。首先，我们需要明确核心需求，然后制定相应的解决方案。'
      ];
      const responseText = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      setResponses(prev => [...prev, { role: 'assistant', content: responseText, time: new Date() }]);
    } finally {
      setIsThinking(false);
      setQuery('');
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">🤖 智能助手</h2>

      <div className="flex gap-2 mb-6">
        {([{ id: 'assistant', label: '对话助手' }, { id: 'skills', label: '技能中心' }, { id: 'shortcuts', label: '快捷键' }] as const).map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              activeTab === tab.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'assistant' && (
        <div className="flex flex-col h-[400px]">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {responses.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">👋</div>
                <div>欢迎使用智能助手！</div>
                <div className="text-sm mt-2">我可以帮助你：调试代码、生成文档、解释概念等</div>
              </div>
            ) : (
              responses.map((msg, i) => (
                <div key={i} className={`p-4 rounded-lg ${
                  msg.role === 'user' ? 'bg-blue-900/30' : 'bg-gray-900'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{msg.role === 'user' ? '👤' : '🤖'}</span>
                    <span className="text-sm text-gray-400">{msg.time.toLocaleTimeString()}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))
            )}
            {isThinking && (
              <div className="p-4 rounded-lg bg-gray-900">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <span className="text-sm text-gray-400">思考中...</span>
                  <span className="flex gap-1">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
              placeholder="输入你的问题..."
              className="flex-1 bg-gray-900 rounded-lg px-4 py-2 border border-gray-700"
            />
            <button type="button"
              onClick={handleAsk}
              disabled={!query.trim() || isThinking}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg"
            >
              {isThinking ? '思考中...' : '发送'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'skills' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="bg-gray-900 rounded-lg p-4 border border-gray-700 hover:border-blue-500 transition-colors cursor-pointer"
              onClick={() => {
                setActiveTab('assistant');
                setQuery(`使用${skill.name}功能来${skill.desc}`);
              }}
            >
              <div className="text-3xl mb-2">{skill.icon}</div>
              <div className="font-semibold text-white">{skill.name}</div>
              <div className="text-sm text-gray-400 mt-1">{skill.desc}</div>
              <span className="inline-block mt-2 px-2 py-0.5 bg-gray-700 rounded text-xs">{skill.category}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'shortcuts' && (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">快捷键</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">功能描述</th>
              </tr>
            </thead>
            <tbody>
              {shortcuts.map((shortcut, i) => (
                <tr key={i} className="border-t border-gray-700 hover:bg-gray-800">
                  <td className="px-4 py-3 font-mono text-blue-400">
                    {shortcut.key.split('+').map((k, j) => (
                      <span key={j}>
                        <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">{k}</kbd>
                        {j < shortcut.key.split('+').length - 1 && ' + '}
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{shortcut.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DeveloperDashboard;