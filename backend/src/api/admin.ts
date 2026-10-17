import { Router } from 'express';
import { adminOnly } from '../middlewares/audit';
import { AuthenticatedRequest } from '../middlewares/auth';
import { UserService } from '../services/UserService';
import { ConversationService } from '../services/ConversationService';
import { MemoryService } from '../services/MemoryService';
import { TaskService } from '../services/TaskService';
import { ToolService } from '../services/ToolService';
import { getAuditSystem } from '../core/audit/AuditSystem';
import type { AuditLevel, AuditCategory } from '../core/audit/AuditSystem';
import { User, IUser } from '../models/User';
import { Conversation } from '../models/Conversation';
import { Memory } from '../models/Memory';
import { Task } from '../models/Task';
import { Tool } from '../models/Tool';
import mongoose from 'mongoose';
import { LLMService, ChatMessage } from '../services/LLMService';
import securityReportService from '../services/SecurityReportService';
import type { RiskLevel } from '../models/SecurityReport';
import { SecurityReport } from '../models/SecurityReport';

const router = Router();

const userService = new UserService();
const conversationService = new ConversationService();
const memoryService = new MemoryService();
const taskService = new TaskService();
const toolService = new ToolService();
const auditSystem = getAuditSystem();

// ========== Dashboard ==========
router.get('/dashboard', ...adminOnly('admin_dashboard', 'view_dashboard', 'data_access'), async (_req, res) => {
  try {
    const [userStats, convStats, memStats, taskStats, toolStats, auditSummary] = await Promise.all([
      userService.countByRole(),
      conversationService.getConversationStats(),
      memoryService.getStats(),
      taskService.getStats(),
      toolService.getStats(),
      auditSystem.getSummaryDB()
    ]);
    res.json({
      users: userStats,
      conversations: convStats,
      memories: memStats,
      tasks: taskStats,
      tools: toolStats,
      audit: auditSummary,
      dbStatus: mongoose.connection.readyState === 1 ? 'connected' : mongoose.connection.readyState,
      generatedAt: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Dashboard query failed' });
  }
});

// ========== Users ==========
router.get('/users', ...adminOnly('user', 'list_users', 'data_access'), async (req, res) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page)) : 1;
    const pageSize = req.query.pageSize ? parseInt(String(req.query.pageSize)) : 20;
    const role = req.query.role as IUser['role'] | undefined;
    const search = req.query.search as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
    res.json(await userService.listUsers({ page, pageSize, role, search, sortBy, sortOrder }));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to list users' });
  }
});

router.get('/users/:id', ...adminOnly('user', 'view_user', 'data_access'), async (req, res) => {
  try {
    const user = await userService.getUserByIdAdmin(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to get user' });
  }
});

router.post('/users', ...adminOnly('user', 'create_user', 'data_modification'), async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'username, email, password required' });
    const user = await userService.createUserByAdmin({ username, email, password, role });
    res.status(201).json({ id: user._id, username: user.username, email: user.email, role: user.role });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to create user' });
  }
});

router.put('/users/:id', ...adminOnly('user', 'update_user', 'data_modification'), async (req, res) => {
  try {
    const user = await userService.updateUserByAdmin(req.params.id, req.body);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to update user' });
  }
});

router.delete('/users/:id', ...adminOnly('user', 'delete_user', 'data_modification'), async (req, res) => {
  try {
    // Prevent deleting last admin
    const target = await User.findById(req.params.id);
    if (target?.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', _id: { $ne: target._id } });
      if (adminCount === 0) {
        return res.status(400).json({ error: 'Cannot delete the last admin user' });
      }
    }
    const ok = await userService.deleteUserByAdmin(req.params.id);
    if (!ok) return res.status(404).json({ error: 'User not found' });
    await Promise.all([
      Conversation.deleteMany({ userId: req.params.id }),
      Memory.deleteMany({ userId: req.params.id }),
      Task.deleteMany({ userId: req.params.id })
    ]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to delete user' });
  }
});

// ========== Conversations ==========
router.get('/conversations', ...adminOnly('conversation', 'list_conversations', 'data_access'), async (req, res) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page)) : 1;
    const pageSize = req.query.pageSize ? parseInt(String(req.query.pageSize)) : 20;
    const userId = req.query.userId as string | undefined;
    const search = req.query.search as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
    res.json(await conversationService.listConversationsAdmin({ page, pageSize, userId, search, sortBy, sortOrder }));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to list conversations' });
  }
});

router.get('/conversations/:id', ...adminOnly('conversation', 'view_conversation', 'data_access'), async (req, res) => {
  try {
    const c = await conversationService.getConversationByIdAdmin(req.params.id);
    if (!c) return res.status(404).json({ error: 'Conversation not found' });
    res.json(c);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to get conversation' });
  }
});

router.put('/conversations/:id', ...adminOnly('conversation', 'update_conversation', 'data_modification'), async (req, res) => {
  try {
    const c = await conversationService.updateConversationAdmin(req.params.id, req.body);
    if (!c) return res.status(404).json({ error: 'Conversation not found' });
    res.json(c);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to update conversation' });
  }
});

router.delete('/conversations/:id', ...adminOnly('conversation', 'delete_conversation', 'data_modification'), async (req, res) => {
  try {
    const ok = await conversationService.deleteConversationAdmin(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to delete conversation' });
  }
});

router.post('/conversations/:id/clear', ...adminOnly('conversation', 'clear_conversation_messages', 'data_modification'), async (req, res) => {
  try {
    const c = await conversationService.clearMessagesByAdmin(req.params.id);
    if (!c) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to clear conversation' });
  }
});

// ========== Memories ==========
// 语义召回路由：必须注册在 /memories/:id 之前，否则 "search" 会被 :id 参数吞掉
router.get('/memories/search', ...adminOnly('memory', 'list_memories', 'data_access'), async (req: AuthenticatedRequest, res) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (!q) return res.status(400).json({ error: 'q (查询文本) required' });
    const userId = req.query.userId as string | undefined;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const topK = req.query.topK ? parseInt(String(req.query.topK)) : undefined;
    const threshold = req.query.threshold ? parseFloat(String(req.query.threshold)) : undefined;
    const result = await memoryService.semanticSearch(userId, q, { topK, threshold });
    res.json({ ...result, query: q });
  } catch (e) {
    // 向量化不可用（未配置密钥/依赖缺失/网络）时退化为关键词正则搜索
    const keyword = await memoryService.listMemories({ userId: req.query.userId as string, search: String(req.query.q ?? ''), pageSize: 10 });
    res.json({ ...keyword, semantic: false, notice: `语义召回不可用，已退化为关键词匹配：${e instanceof Error ? e.message : 'unknown'}` });
  }
});

router.get('/memories', ...adminOnly('memory', 'list_memories', 'data_access'), async (req, res) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page)) : 1;
    const pageSize = req.query.pageSize ? parseInt(String(req.query.pageSize)) : 20;
    const userId = req.query.userId as string | undefined;
    const type = req.query.type as 'short' | 'long' | 'skill' | undefined;
    const search = req.query.search as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
    res.json(await memoryService.listMemories({ page, pageSize, userId, type, search, sortBy, sortOrder }));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to list memories' });
  }
});

router.get('/memories/:id', ...adminOnly('memory', 'view_memory', 'data_access'), async (req, res) => {
  try {
    const m = await memoryService.getById(req.params.id);
    if (!m) return res.status(404).json({ error: 'Memory not found' });
    res.json(m);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to get memory' });
  }
});

router.post('/memories', ...adminOnly('memory', 'create_memory', 'data_modification'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, type, content, metadata } = req.body;
    if (!userId || !type || !content) return res.status(400).json({ error: 'userId, type, content required' });
    const m = await memoryService.create({ userId, type, content, metadata });
    res.status(201).json(m);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to create memory' });
  }
});

router.put('/memories/:id', ...adminOnly('memory', 'update_memory', 'data_modification'), async (req, res) => {
  try {
    const m = await memoryService.update(req.params.id, req.body);
    if (!m) return res.status(404).json({ error: 'Memory not found' });
    res.json(m);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to update memory' });
  }
});

router.delete('/memories/:id', ...adminOnly('memory', 'delete_memory', 'data_modification'), async (req, res) => {
  try {
    const ok = await memoryService.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Memory not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to delete memory' });
  }
});

// ========== Tasks ==========
router.get('/tasks', ...adminOnly('task', 'list_tasks', 'data_access'), async (req, res) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page)) : 1;
    const pageSize = req.query.pageSize ? parseInt(String(req.query.pageSize)) : 20;
    const userId = req.query.userId as string | undefined;
    const status = req.query.status as 'pending' | 'in_progress' | 'completed' | 'failed' | undefined;
    const priority = req.query.priority as 'low' | 'medium' | 'high' | undefined;
    const search = req.query.search as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
    res.json(await taskService.listTasks({ page, pageSize, userId, status, priority, search, sortBy, sortOrder }));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to list tasks' });
  }
});

router.get('/tasks/:id', ...adminOnly('task', 'view_task', 'data_access'), async (req, res) => {
  try {
    const t = await taskService.getById(req.params.id);
    if (!t) return res.status(404).json({ error: 'Task not found' });
    res.json(t);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to get task' });
  }
});

router.post('/tasks', ...adminOnly('task', 'create_task', 'data_modification'), async (req, res) => {
  try {
    const { userId, description, status, priority, subtasks } = req.body;
    if (!userId || !description) return res.status(400).json({ error: 'userId, description required' });
    const t = await taskService.create({ userId, description, status, priority, subtasks });
    res.status(201).json(t);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to create task' });
  }
});

router.put('/tasks/:id', ...adminOnly('task', 'update_task', 'data_modification'), async (req, res) => {
  try {
    const t = await taskService.update(req.params.id, req.body);
    if (!t) return res.status(404).json({ error: 'Task not found' });
    res.json(t);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to update task' });
  }
});

router.delete('/tasks/:id', ...adminOnly('task', 'delete_task', 'data_modification'), async (req, res) => {
  try {
    const ok = await taskService.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to delete task' });
  }
});

// ========== Tools ==========
router.get('/tools', ...adminOnly('tool', 'list_tools', 'data_access'), async (req, res) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page)) : 1;
    const pageSize = req.query.pageSize ? parseInt(String(req.query.pageSize)) : 20;
    const type = req.query.type as 'rest' | 'graphql' | 'websocket' | undefined;
    const search = req.query.search as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
    res.json(await toolService.listTools({ page, pageSize, type, search, sortBy, sortOrder }));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to list tools' });
  }
});

router.get('/tools/:id', ...adminOnly('tool', 'view_tool', 'data_access'), async (req, res) => {
  try {
    const t = await toolService.getById(req.params.id);
    if (!t) return res.status(404).json({ error: 'Tool not found' });
    res.json(t);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to get tool' });
  }
});

router.post('/tools', ...adminOnly('tool', 'create_tool', 'data_modification'), async (req, res) => {
  try {
    const { name, description, type, endpoint, toolSchema } = req.body;
    if (!name || !description || !type) return res.status(400).json({ error: 'name, description, type required' });
    const t = await toolService.create({ name, description, type, endpoint, toolSchema });
    res.status(201).json(t);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to create tool' });
  }
});

router.put('/tools/:id', ...adminOnly('tool', 'update_tool', 'data_modification'), async (req, res) => {
  try {
    const t = await toolService.update(req.params.id, req.body);
    if (!t) return res.status(404).json({ error: 'Tool not found' });
    res.json(t);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to update tool' });
  }
});

router.delete('/tools/:id', ...adminOnly('tool', 'delete_tool', 'data_modification'), async (req, res) => {
  try {
    const ok = await toolService.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Tool not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to delete tool' });
  }
});

// ========== Audit Logs ==========
router.get('/audit-logs', ...adminOnly('audit_log', 'list_audit_logs', 'data_access'), async (req, res) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page)) : 1;
    const pageSize = req.query.pageSize ? parseInt(String(req.query.pageSize)) : 50;
    const userId = req.query.userId as string | undefined;
    const action = req.query.action as string | undefined;
    const resource = req.query.resource as string | undefined;
    const result = req.query.result as 'success' | 'failure' | 'blocked' | undefined;
    const levels = req.query.levels ? String(req.query.levels).split(',') as AuditLevel[] : undefined;
    const categories = req.query.categories ? String(req.query.categories).split(',') as AuditCategory[] : undefined;
    const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
    const resultData = await auditSystem.queryDB({
      startDate, endDate, levels, categories, userId, action, resource, result,
      limit: pageSize, offset: (page - 1) * pageSize, sortBy, sortOrder
    });
    res.json(resultData);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to list audit logs' });
  }
});

router.get('/audit-logs/summary', ...adminOnly('audit_log', 'view_audit_summary', 'data_access'), async (_req, res) => {
  try {
    const summary = await auditSystem.getSummaryDB();
    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to get audit summary' });
  }
});

router.get('/audit-logs/user/:userId', ...adminOnly('audit_log', 'view_user_activity', 'data_access'), async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 50;
    const logs = await auditSystem.getUserActivityDB(req.params.userId, limit);
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to get user activity' });
  }
});

router.delete('/audit-logs/purge', ...adminOnly('audit_log', 'purge_audit_logs', 'data_modification'), async (req, res) => {
  try {
    const days = req.query.days ? parseInt(String(req.query.days)) : 30;
    if (!Number.isFinite(days) || days < 1) return res.status(400).json({ error: 'Invalid days parameter' });
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const deleted = await auditSystem.deleteAuditLogsOlderThan(cutoff);
    res.json({ success: true, deleted, cutoff: cutoff.toISOString() });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to purge audit logs' });
  }
});

// ========== Health check ==========
router.get('/health', ...adminOnly('admin', 'health_check', 'data_access'), async (_req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// ========== AI Security Analyst (DeepSeek) ==========
router.post('/security/analyze', ...adminOnly('security_analyst', 'ai_analyze', 'security'), async (req: AuthenticatedRequest, res) => {
  try {
    const apiKeyFromHeader = (req.headers['x-deepseek-key'] as string) || '';
    const apiKey = apiKeyFromHeader || process.env.DEEPSEEK_API_KEY || '';
    if (!apiKey) {
      return res.status(400).json({
        error: '未配置 DeepSeek API Key，请在后端 .env 设置 DEEPSEEK_API_KEY 或通过请求头 X-Deepseek-Key 传入'
      });
    }

    const dashboard = req.body?.dashboard || null;
    let customPrompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
    customPrompt = customPrompt.replace(/sk-[A-Za-z0-9_-]{16,}/g, '[MASKED_SK]');
    const model = typeof req.body?.model === 'string' && req.body.model ? req.body.model : 'deepseek-v4-pro';

    const systemPrompt = `你是【AI 系统安全分析师】，为企业 AI Agent 平台提供专业安全评估与可操作建议。
你的输出必须是一段结构清晰的中文 Markdown，要求：
1. 先给出一句话"综合评估结论"（总体风险等级：高危 / 中危 / 低危 / 优秀）。
2. 按四大维度逐项分析：【身份安全】【数据安全】【模型安全】【运维安全】。每项包含：现状评价 + 风险点 + 处置建议。
3. 给出"TOP 3 优先整改事项"，标清时限（7天内 / 30天内 / 季度内）。
4. 结尾给出"一句话行动倡议"。
语言风格：专业、严谨、简洁，像铁路安全分析师或 CISO 给管理层的汇报。不要用废话和客套话。`;

    const userPrompt = customPrompt
      ? customPrompt
      : `以下是当前 AI Agent 系统的 Dashboard 汇总数据（JSON）：
${JSON.stringify(dashboard || {}, null, 2)}

请基于以上数据，按照【身份安全 / 数据安全 / 模型安全 / 运维安全】四维度 + TOP3 整改 + 行动倡议 的结构，生成一份专业安全评估报告。
如果 dashboard 数据为空，请基于通用 AI Agent 平台最佳实践给出标准化评估建议。`;

    const llm = new LLMService({
      provider: 'deepseek',
      apiKey,
      model,
      maxTokens: 4096,
      temperature: 0.4
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const t0 = Date.now();
    const result = await llm.chat(messages);
    const elapsed = Date.now() - t0;

    try {
      const isHeavy = result.usage && result.usage.totalTokens > 6000;
      auditSystem.log({
        level: isHeavy ? 'warning' : 'info',
        category: 'security',
        action: 'security_ai_analyze',
        resource: '/api/admin/security/analyze',
        userId: req.user?.id,
        result: 'success',
        details: {
          summary: `${req.user?.username || 'unknown-admin'} 调用 DeepSeek 安全分析，生成 ${result.usage?.totalTokens || 0} tokens，耗时 ${elapsed}ms`
        },
        duration: elapsed,
        metadata: {
          model: result.model,
          provider: result.provider,
          tokens: result.usage,
          elapsedMs: elapsed,
          customPrompt: !!customPrompt,
          actorName: req.user?.username || 'unknown-admin'
        },
        ipAddress: (req as any).ip
      });
    } catch (_auditErr) { /* audit 失败不影响主流程 */ }

    let reportId: string | undefined;
    try {
      const saved = await securityReportService.create({
        userId: req.user!.id,
        modelName: result.model,
        provider: result.provider as any,
        prompt: systemPrompt,
        customPrompt,
        content: result.content,
        usage: result.usage,
        elapsedMs: elapsed,
        riskLevel: (req.body as any).riskLevel as RiskLevel | undefined,
      });
      reportId = (saved._id as mongoose.Types.ObjectId).toString();
      try {
        auditSystem.log({
          level: 'info',
          category: 'security',
          action: 'security_report_save',
          resource: '/api/admin/security/analyze',
          resourceId: reportId,
          userId: req.user?.id,
          result: 'success',
          details: {
            summary: `${req.user?.username || 'unknown-admin'} 安全分析报告已持久化，reportId=${reportId}`
          },
          duration: 0,
          metadata: {
            model: result.model,
            tokens: result.usage?.totalTokens ?? 0,
            actorName: req.user?.username || 'unknown-admin'
          },
          ipAddress: (req as any).ip
        });
      } catch (_auditErr2) { /* audit 失败不影响主流程 */ }
    } catch (e) {
      console.warn('[analyze] save report failed:', e instanceof Error ? e.stack : e);
    }

    res.json({
      success: true,
      content: result.content,
      model: result.model,
      provider: result.provider,
      usage: result.usage,
      elapsedMs: elapsed,
      generatedAt: new Date().toISOString(),
      reportId,
    });
  } catch (e: any) {
    console.error('[admin/security/analyze] DeepSeek 调用失败:', e?.message || String(e));
    const hint = e?.response?.data?.error?.message || e?.message || String(e);
    res.status(502).json({
      error: `DeepSeek API 调用失败：${hint}`,
      detail: process.env.NODE_ENV === 'development' ? (e?.stack || '') : undefined
    });
  }
});

// ========== Security Reports (持久化报告) ==========

// GET /api/admin/security/reports?page=&size=
router.get(
  '/security/reports',
  ...adminOnly('security_report', 'list_security_reports', 'data_access'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const size = Math.min(100, Math.max(1, parseInt(req.query.size as string) || 20));
      const list = await securityReportService.list(req.user!.id, page, size);
      try {
        auditSystem.log({
          level: 'info',
          category: 'data_access',
          action: 'security_report_list',
          resource: '/api/admin/security/reports',
          userId: req.user?.id,
          result: 'success',
          details: {
            summary: `${req.user?.username || 'unknown-admin'} 分页查询安全报告，page=${page},size=${size},total=${list.total}`
          },
          ipAddress: (req as any).ip
        });
      } catch (_auditErr) { /* audit 失败不影响主流程 */ }
      const compatItems = list.items.map((it) => ({ ...(it as any), model: (it as any).modelName }));
      res.json({ success: true, ...list, items: compatItems });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to list security reports' });
    }
  }
);

// GET /api/admin/security/reports/latest
router.get(
  '/security/reports/latest',
  ...adminOnly('security_report', 'get_latest_security_report', 'data_access'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const doc = await securityReportService.getLatest(req.user!.id);
      try {
        auditSystem.log({
          level: 'info',
          category: 'data_access',
          action: 'security_report_get_latest',
          resource: '/api/admin/security/reports/latest',
          userId: req.user?.id,
          result: 'success',
          details: {
            summary: `${req.user?.username || 'unknown-admin'} 获取最新安全报告，${doc ? '存在' : '无'}`
          },
          ipAddress: (req as any).ip
        });
      } catch (_auditErr) { /* audit 失败不影响主流程 */ }
      const compatDoc = doc ? ({ ...(doc as any), model: (doc as any).modelName }) : null;
      res.json({ success: true, data: compatDoc });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to get latest security report' });
    }
  }
);

// GET /api/admin/security/reports/:id
router.get(
  '/security/reports/:id',
  ...adminOnly('security_report', 'view_security_report', 'data_access'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const doc = await securityReportService.getById(req.params.id);
      if (!doc) return res.status(404).json({ error: '报告不存在' });
      if (doc.userId.toString() !== req.user!.id) {
        try {
          auditSystem.log({
            level: 'warning',
            category: 'authorization',
            action: 'security_report_view_forbidden',
            resource: '/api/admin/security/reports/:id',
            resourceId: req.params.id,
            userId: req.user?.id,
            result: 'blocked',
            details: {
              summary: `${req.user?.username || 'unknown-admin'} 试图查看非本人报告，owner=${doc.userId.toString()}`
            },
            ipAddress: (req as any).ip
          });
        } catch (_auditErr) { /* noop */ }
        return res.status(403).json({ error: '无权查看该报告' });
      }
      try {
        auditSystem.log({
          level: 'info',
          category: 'data_access',
          action: 'security_report_view',
          resource: '/api/admin/security/reports/:id',
          resourceId: req.params.id,
          userId: req.user?.id,
          result: 'success',
          details: {
            summary: `${req.user?.username || 'unknown-admin'} 查看安全报告，reportId=${req.params.id}`
          },
          ipAddress: (req as any).ip
        });
      } catch (_auditErr) { /* audit 失败不影响主流程 */ }
      res.json({ success: true, data: doc });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to get security report' });
    }
  }
);

// POST /api/admin/security/reports/:id/risk-level
router.post(
  '/security/reports/:id/risk-level',
  ...adminOnly('security_report', 'set_security_report_risk_level', 'data_modification'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const doc = await SecurityReport.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: '报告不存在' });
      if (doc.userId.toString() !== req.user!.id) {
        try {
          auditSystem.log({
            level: 'warning',
            category: 'authorization',
            action: 'security_report_set_risk_level_forbidden',
            resource: '/api/admin/security/reports/:id/risk-level',
            resourceId: req.params.id,
            userId: req.user?.id,
            result: 'blocked',
            details: {
              summary: `${req.user?.username || 'unknown-admin'} 试图修改非本人报告 riskLevel，owner=${doc.userId.toString()}`
            },
            ipAddress: (req as any).ip
          });
        } catch (_auditErr) { /* noop */ }
        return res.status(403).json({ error: '无权修改该报告' });
      }
      const { riskLevel } = (req.body || {}) as any;
      if (!riskLevel || !['high', 'mid', 'low', 'excellent'].includes(riskLevel)) {
        return res.status(400).json({ error: 'riskLevel 参数非法，可选值 high/mid/low/excellent' });
      }
      doc.riskLevel = riskLevel;
      await doc.save();
      try {
        auditSystem.log({
          level: 'info',
          category: 'security',
          action: 'security_report_set_risk_level',
          resource: '/api/admin/security/reports/:id/risk-level',
          resourceId: req.params.id,
          userId: req.user?.id,
          result: 'success',
          details: {
            summary: `${req.user?.username || 'unknown-admin'} 更新安全报告风险等级，reportId=${req.params.id}, riskLevel=${riskLevel}`
          },
          metadata: { riskLevel },
          ipAddress: (req as any).ip
        });
      } catch (_auditErr) { /* audit 失败不影响主流程 */ }
      const obj = doc.toObject() as any;
      obj.model = obj.modelName;
      res.json({ success: true, data: obj });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to set report risk level' });
    }
  }
);

export default router;
