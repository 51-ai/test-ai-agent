import { useState, useEffect, useRef } from 'react';
import { conversationAPI, agentAPI, type AgentResponse, type Conversation, type Message } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { Send, Plus, MessageSquare, Trash2, Edit2, LogOut, Wrench, Zap, Brain, Bolt } from 'lucide-react';
import LanguageToggle from './LanguageToggle';

interface ChatProps {
  onLogout: () => void;
}

interface TokenUsage {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  elapsedMs: number;
}

// 模型选项
const MODEL_OPTIONS = [
  { id: 'deepseek-v4-pro', name: 'V4-Pro', icon: Brain, desc: '旗舰推理', price: '¥3/百万' },
  { id: 'deepseek-v4-flash', name: 'V4-Flash', icon: Bolt, desc: '经济快速', price: '¥1/百万' },
];

export default function Chat({ onLogout }: ChatProps) {
  const { t } = useLanguage();
  
  // 模型选择状态
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const saved = localStorage.getItem('chat_selected_model');
    return saved || 'deepseek-v4-pro';
  });
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [lastTokenUsage, setLastTokenUsage] = useState<TokenUsage | null>(null);
  const [totalSessionTokens, setTotalSessionTokens] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 保存模型选择到 localStorage
  useEffect(() => {
    localStorage.setItem('chat_selected_model', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await conversationAPI.getAll();
      // 合并后端数据和本地数据，保留本地新增的对话
      const backendConvs = response.data || [];
      const localConvs = conversations.filter(local => 
        !backendConvs.some((backend: Conversation) => backend._id === local._id)
      );
      const merged = [...localConvs, ...backendConvs];
      setConversations(merged);
      
      // 如果当前没有选中的对话，选择第一个
      if (!selectedConversation && merged.length > 0) {
        setSelectedConversation(merged[0]);
      }
    } catch (err) {
      // Silently fall back to empty state — no console logging of errors
    }
  };

  const createConversation = async () => {
    setIsCreating(true);
    try {
      const response = await conversationAPI.create();
      setConversations(prev => [response.data, ...prev]);
      setSelectedConversation(response.data);
    } catch (err) {
      // Silently handle error
    } finally {
      setIsCreating(false);
    }
  };

  // 自动生成对话标题
  const generateConversationTitle = async (messages: Message[], convId: string) => {
    if (messages.length < 2) return;
    
    try {
      const response = await agentAPI.summarize(messages, selectedModel);
      const data = response.data as { summary: string; usage?: TokenUsage };
      
      // 更新对话标题
      const newTitle = data.summary.substring(0, 50);
      
      // 更新本地状态
      setSelectedConversation(prev => prev ? {
        ...prev,
        title: newTitle
      } : null);
      
      setConversations(prev => prev.map(c => 
        c._id === convId ? { ...c, title: newTitle } : c
      ));
      
      if (data.usage) {
        setLastTokenUsage(data.usage);
        setTotalSessionTokens(prev => prev + data.usage!.totalTokens);
      }
    } catch (err) {
      // Silently handle error
    }
  };

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    setLoading(true);
    
    // 添加用户消息到本地状态
    const userMessage = {
      content: message,
      role: 'user' as const,
      timestamp: new Date().toISOString()
    };
    
    if (selectedConversation) {
      setSelectedConversation(prev => prev ? {
        ...prev,
        messages: [...prev.messages, userMessage]
      } : null);
    }

    try {
      // 使用 agentAPI.chat 获取响应
      const response = await agentAPI.chat(message, selectedModel);
      const agentResponse = response.data as AgentResponse;
      
      // 更新 token 使用量
      if (agentResponse.usage) {
        setLastTokenUsage(agentResponse.usage);
        setTotalSessionTokens(prev => prev + agentResponse.usage!.totalTokens);
      }
      
      // 添加助手消息
      const assistantMessage = {
        content: agentResponse.response,
        role: 'assistant' as const,
        timestamp: new Date().toISOString(),
        metadata: { emotion: agentResponse.emotion }
      };
      
      let currentConvId = '';
      
      if (selectedConversation) {
        currentConvId = selectedConversation._id;
        const updatedMessages = [...selectedConversation.messages, userMessage, assistantMessage];
        setSelectedConversation(prev => prev ? {
          ...prev,
          messages: updatedMessages
        } : null);
        
        // 自动生成对话标题（当对话有2条消息且标题是默认标题时）
        if (updatedMessages.length >= 2 && 
            (selectedConversation.title === 'New Conversation' || 
             selectedConversation.title.startsWith('temp-') ||
             selectedConversation.title.length <= 10)) {
          generateConversationTitle(updatedMessages, currentConvId);
        }
      } else {
        // 如果没有选中会话，创建一个新的
        currentConvId = 'temp-' + Date.now();
        const newConv = {
          _id: currentConvId,
          title: message.substring(0, 30),
          messages: [userMessage, assistantMessage],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as Conversation;
        setSelectedConversation(newConv);
        setConversations(prev => [newConv, ...prev]);
        
        // 自动生成对话标题
        generateConversationTitle([userMessage, assistantMessage], currentConvId);
      }
      
      setMessage('');
    } catch (err) {
      // Silently handle error
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const deleteConversation = async (id: string) => {
    if (confirm(t.chat.deleteConfirm)) {
      try {
        await conversationAPI.delete(id);
        setConversations(prev => prev.filter(c => c._id !== id));
        if (selectedConversation?._id === id) {
          setSelectedConversation(null);
        }
      } catch (err) {
        // Silently handle error
      }
    }
  };

  const getEmotionIcon = (emotion?: { type: string }) => {
    switch (emotion?.type) {
      case 'positive': return '😊';
      case 'negative': return '😔';
      default: return '😐';
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversation?.messages]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-screen flex bg-gray-100">
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-lg font-semibold text-gray-800">AI Agent</h1>
              <button type="button"
                
                onClick={onLogout}
                className="mt-2 text-sm text-gray-500 hover:text-red-500 flex items-center gap-1"
              >
                <LogOut className="w-4 h-4" />
                {t.chat.logout}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <button type="button"
                
                onClick={() => window.location.href = '/dev'}
                className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
                title="开发者入口"
              >
                <Wrench className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-3">
          <button type="button"
            
            onClick={createConversation}
            disabled={isCreating}
            className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            {isCreating ? 'Creating...' : t.chat.newConversation}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {conversations.map(conversation => (
            <div
              key={conversation._id}
              className={`p-3 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition ${
                selectedConversation?._id === conversation._id ? 'bg-primary-50 border-l-2 border-primary-500' : ''
              }`}
              onClick={() => setSelectedConversation(conversation)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-800 truncate">{conversation.title}</h3>
                  <p className="text-sm text-gray-500 truncate mt-1">
                    {conversation.messages[conversation.messages.length - 1]?.content || 'No messages'}
                  </p>
                </div>
                <button type="button"
                  
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conversation._id);
                  }}
                  className="text-gray-400 hover:text-red-500 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {formatTime(conversation.updatedAt)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <div className="p-4 bg-white border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">{selectedConversation.title}</h2>
                <div className="flex items-center gap-3">
                  {/* 模型选择按钮 */}
                  <div className="flex items-center gap-1">
                    {MODEL_OPTIONS.map((model) => (
                      <button type="button"
                        
                        key={model.id}
                        onClick={() => setSelectedModel(model.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-all ${
                          selectedModel === model.id
                            ? 'bg-primary-100 text-primary-700 border border-primary-300'
                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
                        }`}
                        title={`${model.desc} - ${model.price}`}
                      >
                        <model.icon className={`w-4 h-4 ${
                          selectedModel === model.id ? 'text-primary-600' : 'text-gray-400'
                        }`} />
                        <span className="font-medium">{model.name}</span>
                      </button>
                    ))}
                  </div>
                  
                  {/* Token 消耗显示 - 顶部工具栏 */}
                  <div className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-1.5">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <span className="text-gray-500">Tokens:</span>
                    <span className="text-primary-600 font-bold">{totalSessionTokens}</span>
                    {lastTokenUsage && (
                      <span className="text-gray-400 text-xs">
                        (+{lastTokenUsage.totalTokens})
                      </span>
                    )}
                  </div>
                  <Edit2 className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-pointer" />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {selectedConversation.messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] px-4 py-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white rounded-br-md'
                      : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <div className={`flex items-center gap-2 mt-1 text-xs ${
                      msg.role === 'user' ? 'text-primary-200' : 'text-gray-400'
                    }`}>
                      <span>{formatTime(msg.timestamp)}</span>
                      {msg.role === 'assistant' && !!msg.metadata?.emotion && (
                        <span>{getEmotionIcon(msg.metadata.emotion as unknown as { type: string })}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-end gap-3">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={t.chat.sendPlaceholder}
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-3 resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                  rows={2}
                />
                <button type="button"
                  
                  onClick={handleSend}
                  disabled={loading || !message.trim()}
                  className="bg-primary-600 text-white p-3 rounded-xl hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-600 mb-2">Welcome to AI Agent</h3>
              <p className="text-gray-500">{t.chat.noConversation}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}