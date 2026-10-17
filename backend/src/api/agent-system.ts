import { Router, Request, Response, NextFunction } from 'express';
import { getSharedAgent } from '../core/Agent';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middlewares/auth';

const router = Router();
// 单例：与所有入口共享同一个 Agent 实例
const agent = getSharedAgent();

// 🔒 安全修复：所有 agent-system 路由统一要求 JWT 认证 + admin 权限
router.use(authenticate as any);
router.use(requireAdmin as any);

router.get('/status', (req: Request, res: Response) => {
  try {
    const status = agent.getFullSystemStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// 向量化涉及真实的模型调用（异步），因此 RAG 相关端点均为 async
router.post('/rag/documents', async (req: Request, res: Response) => {
  try {
    const { title, content, source } = req.body;
    const rag = agent.getRAGSystem();

    if (!content || typeof content !== 'string') {
      res.status(400).json({ success: false, error: 'content 不能为空' });
      return;
    }

    const document = {
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: title || '未命名文档',
      content,
      source,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await rag.addDocument(document);
    res.json({ success: true, data: { documentId: document.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/rag/documents', (req: Request, res: Response) => {
  try {
    const rag = agent.getRAGSystem();
    const stats = rag.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/rag/search', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    const rag = agent.getRAGSystem();

    if (!query || typeof query !== 'string') {
      res.status(400).json({ success: false, error: 'query 不能为空' });
      return;
    }

    const results = await rag.search(query);
    const context = await rag.getContextForQuery(query);

    res.json({ success: true, data: { results, context } });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/monitoring/alerts', (req: Request, res: Response) => {
  try {
    const monitoring = agent.getMonitoringSystem();
    const activeAlerts = monitoring.getActiveAlerts();
    const allAlerts = monitoring.getAlerts();
    
    res.json({ success: true, data: { activeAlerts, allAlerts } });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/monitoring/performance', (req: Request, res: Response) => {
  try {
    const monitoring = agent.getMonitoringSystem();
    const performance = monitoring.getPerformanceMetrics();
    const behavior = monitoring.getBehaviorMetrics();
    
    res.json({ success: true, data: { performance, behavior } });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/feedback', (req: Request, res: Response) => {
  try {
    const { conversationId, userId, rating, comment, helpful, issues } = req.body;
    const iterationSystem = agent.getContinuousIterationSystem();
    
    const feedback = {
      id: `feedback_${Date.now()}`,
      conversationId,
      userId,
      rating,
      comment,
      helpful,
      issues,
      timestamp: new Date()
    };
    
    iterationSystem.addFeedback(feedback);
    res.json({ success: true, data: { feedbackId: feedback.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/feedback', (req: Request, res: Response) => {
  try {
    const iterationSystem = agent.getContinuousIterationSystem();
    const feedbacks = iterationSystem.getFeedback();
    const stats = iterationSystem.getFullReport();
    
    res.json({ success: true, data: { feedbacks, stats } });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/iteration/start', (req: Request, res: Response) => {
  try {
    const iterationSystem = agent.getContinuousIterationSystem();
    const cycle = iterationSystem.startIterationCycle();
    
    res.json({ success: true, data: { cycleId: cycle.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/iteration/cycles', (req: Request, res: Response) => {
  try {
    const iterationSystem = agent.getContinuousIterationSystem();
    const cycles = iterationSystem.getIterationCycles();
    const current = iterationSystem.getCurrentCycle();
    
    res.json({ success: true, data: { cycles, current } });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/models/versions', (req: Request, res: Response) => {
  try {
    const iterationSystem = agent.getContinuousIterationSystem();
    const versions = iterationSystem.getModelVersions();
    const active = iterationSystem.getActiveModel();
    
    res.json({ success: true, data: { versions, active } });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/data-governance/stats', (req: Request, res: Response) => {
  try {
    const dataGov = agent.getDataGovernanceSystem();
    const stats = dataGov.getStats();
    
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/rl/stats', (req: Request, res: Response) => {
  try {
    const rl = agent.getRLModule();
    const stats = rl.getTrainingStats();
    
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/evaluation/report', (req: Request, res: Response) => {
  try {
    const evaluation = agent.getEvaluationSystem();
    const report = evaluation.generateReport();
    
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
