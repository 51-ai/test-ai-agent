import { Router } from 'express';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middlewares/auth';
import { getSharedAgent } from '../core/Agent';

const router = Router();
// 单例：与开发者入口共享同一个 Agent 实例，保证记忆/会话/RAG/监控数据同步
const agent = getSharedAgent();

// 允许的模型白名单
const ALLOWED_MODELS = new Set([
  'deepseek-v4-pro',
  'deepseek-v4-flash',
  'deepseek-chat',
  'deepseek-reasoner',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-3.5-turbo',
  'claude-3-sonnet-20240229',
  'claude-3-opus-20240229',
  'qwen-max',
  'qwen-plus',
]);

function validateModel(model: string | undefined): string {
  if (!model) return process.env.LLM_MODEL || 'deepseek-v4-pro';
  if (ALLOWED_MODELS.has(model)) return model;
  console.warn(`[SECURITY] Rejected unknown model: ${model}, falling back to default`);
  return process.env.LLM_MODEL || 'deepseek-v4-pro';
}

router.post('/chat', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { message, model } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 模型参数仅记录日志，实际由 Agent 内部 LLM 配置决定
    if (model) {
      validateModel(model);
    }

    const startTime = Date.now();
    
    // 统一走 Agent.processInput，保证会话/用户画像/对话状态/定时任务全部更新
    const response = await agent.processInput(message, req.user!.id, req.user!.role);
    const elapsedMs = Date.now() - startTime;
    
    res.json({
      response: response.content,
      emotion: response.emotion,
      taskId: response.taskId,
      status: response.status,
      usage: response.usage || {
        promptTokens: Math.ceil(message.length / 2),
        completionTokens: Math.ceil((response.content?.length || 0) / 2),
        totalTokens: Math.ceil((message.length + (response.content?.length || 0)) / 2),
      },
      elapsedMs
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.get('/memory/stats', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const stats = agent.getMemoryStats(req.user!.id);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/memory/consolidate', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    agent.consolidateMemory(req.user!.id);
    res.json({ success: true, message: 'Memory consolidated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== Special Events API ==========
router.get('/events/stats', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const stats = agent.getSpecialEventStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/events', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { category, severity } = req.query;
    
    let events;
    if (category) {
      events = agent.getSpecialEventsByCategory(category as string);
    } else if (severity) {
      events = agent.getSpecialEventsBySeverity(severity as string);
    } else {
      events = agent.getAllSpecialEvents();
    }
    
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/events/:eventId/view', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { eventId } = req.params;
    agent.markEventAsViewed(eventId);
    res.json({ success: true, message: 'Event marked as viewed' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/events/:eventId/memorize', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { eventId } = req.params;
    agent.markEventAsMemorized(eventId);
    res.json({ success: true, message: 'Event marked as memorized' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/training/status', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const status = agent.getFullSystemStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== 对话总结 API ==========
router.post('/summarize', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // 构建对话内容
    const conversationText = messages
      .map((msg: { role: string; content: string }) => `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content}`)
      .join('\n');

    // 调用 LLM 生成总结
    const summaryPrompt = `请用简洁的语言总结以下对话的主要内容（不超过50字）：

${conversationText}

总结：`;
    
    const startTime = Date.now();
    
    // 统一走 Agent.processInput，保证会话/用户画像/对话状态/定时任务全部更新
    const response = await agent.processInput(summaryPrompt, req.user!.id, req.user!.role);
    const elapsedMs = Date.now() - startTime;
    
    let summary = response.content || '无法生成总结';
    if (summary.length > 100) {
      summary = summary.substring(0, 100) + '...';
    }
    
    res.json({
      summary,
      usage: response.usage || {
        promptTokens: Math.ceil(summaryPrompt.length / 2),
        completionTokens: Math.ceil(summary.length / 2),
        totalTokens: Math.ceil((summaryPrompt.length + summary.length) / 2),
      },
      elapsedMs
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

export default router;