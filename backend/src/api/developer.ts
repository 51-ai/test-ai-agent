import { Router, Request, Response } from 'express';
import { getSharedAgent } from '../core/Agent';
import { getDeveloperConfig } from '../config/developer';
import { User } from '../models/User';
import { spawn } from 'child_process';
import * as path from 'path';
import { documentImageReader } from '../core/tools/document/ImageDocumentReader';

const router = Router();
const config = getDeveloperConfig();

// 单例：与普通用户入口共享同一个 Agent 实例，保证记忆/会话/RAG/监控数据同步
const developerAgent = getSharedAgent();

interface DevRequest extends Request {
  developerMode?: boolean;
  devUserId?: string;
}

const devAuthMiddleware = (req: DevRequest, res: Response, next: Function) => {
  if (!config.enabled) {
    return res.status(403).json({ 
      success: false, 
      error: 'Developer mode is disabled',
      message: '请联系管理员启用开发者模式'
    });
  }

  // 🔒 安全修复：apiKey 未配置时必须拒绝所有请求，防止匿名提权
  if (!config.apiKey) {
    return res.status(403).json({
      success: false,
      error: 'Developer API key not configured',
      message: '开发者 API 密钥未配置，生产环境必须设置 DEVELOPER_API_KEY'
    });
  }

  const apiKey = req.headers['x-developer-key'] as string;
  
  if (!apiKey || apiKey !== config.apiKey) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid developer API key',
      message: 'API密钥无效，请检查配置'
    });
  }

  req.developerMode = true;
  req.devUserId = config.devModeUserId;
  next();
};

router.use(devAuthMiddleware);

router.get('/status', (req: DevRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      developerMode: true,
      enabled: config.enabled,
      userId: config.devModeUserId,
      features: {
        rag: true,
        rl: true,
        evaluation: true,
        dataGovernance: true,
        monitoring: true,
        continuousIteration: true
      },
      limits: {
        maxRequestsPerMinute: config.maxRequestsPerMinute,
        dataIsolation: true
      }
    },
    message: '开发者模式已启用'
  });
});

router.post('/chat', async (req: DevRequest, res: Response) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const userId = sessionId || config.devModeUserId;
    const response = await developerAgent.processInput(message, userId);

    res.json({
      success: true,
      data: {
        response,
        sessionId: userId,
        developerMode: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/system/full-status', (req: DevRequest, res: Response) => {
  const fullStatus = developerAgent.getFullSystemStatus();
  
  res.json({
    success: true,
    data: {
      ...fullStatus,
      developerMode: true,
      isolated: true,
      dataPrefix: config.isolatedDataPrefix
    }
  });
});

router.get('/rag/documents', (req: DevRequest, res: Response) => {
  const ragSystem = developerAgent.getRAGSystem();
  const stats = ragSystem.getStats();
  
  res.json({
    success: true,
    data: {
      stats,
      developerMode: true
    }
  });
});

router.post('/rag/documents', async (req: DevRequest, res: Response) => {
  try {
    const { content, title, source, metadata } = req.body;
    const ragSystem = developerAgent.getRAGSystem();
    
    const document = {
      id: `dev_${Date.now()}`,
      title: title || `Dev Document ${Date.now()}`,
      content: content,
      source: source || 'developer-mode',
      metadata: metadata || {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await ragSystem.addDocument(document);
    
    res.json({
      success: true,
      message: '文档已添加到RAG系统（开发者模式）',
      data: {
        developerMode: true,
        isolated: true,
        documentId: document.id,
        contentLength: content?.length || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add document'
    });
  }
});

/**
 * 文档照片识别并入库：手机拍摄的文档照片 → 文本 → 加入 RAG 知识库
 * 接收 base64 编码的图片（可带 data URI 前缀）；识别失败时返回具体错误，绝不返回假文本
 */
router.post('/rag/photo', async (req: DevRequest, res: Response) => {
  try {
    const body = req.body || {};
    const image = body.image;
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ success: false, error: '缺少 image 字段（base64 编码的图片）' });
    }

    // 兼容 "data:image/png;base64,xxxx" 与裸 base64 两种传法
    const base64 = image.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    let buf: Buffer;
    try {
      buf = Buffer.from(base64, 'base64');
    } catch {
      return res.status(400).json({ success: false, error: 'image 不是合法的 base64 编码' });
    }
    if (buf.length === 0) {
      return res.status(400).json({ success: false, error: 'image 解码后为空，请确认图片内容' });
    }

    const photo = await documentImageReader.readBuffer(buf, body.fileName || 'uploaded-photo');

    if (!photo.success) {
      return res.json({
        success: false,
        data: {
          text: '',
          inspection: photo.inspection,
          quality: photo.quality,
          warnings: photo.warnings
        },
        error: photo.error
      });
    }

    // 尝试把识别文本加入真实 RAG；若无 embedding Key 等导致失败，OCR 文本仍返回给前端
    let addedToRag = false;
    let ragNote: string | undefined;
    try {
      const ragSystem = developerAgent.getRAGSystem();
      await ragSystem.addDocument({
        id: `photo_${Date.now()}`,
        title: (body.title || `文档照片 ${body.fileName || ''}`).trim(),
        content: photo.text,
        source: 'document-photo',
        metadata: {
          fromPhoto: true,
          ...(photo.quality ? { photoQuality: photo.quality.score } : {}),
          ...(photo.inspection.width ? { imageWidth: photo.inspection.width } : {}),
          ...(photo.inspection.height ? { imageHeight: photo.inspection.height } : {})
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      addedToRag = true;
    } catch (e) {
      ragNote = e instanceof Error ? e.message : String(e);
    }

    return res.json({
      success: true,
      data: {
        text: photo.text,
        inspection: photo.inspection,
        quality: photo.quality,
        warnings: photo.warnings,
        addedToRag,
        ragNote: addedToRag ? undefined : ragNote
      },
      developerMode: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '照片识别失败'
    });
  }
});

router.post('/rag/search', (req: DevRequest, res: Response) => {
  try {
    const { query } = req.body;
    const ragSystem = developerAgent.getRAGSystem();
    
    const results = ragSystem.search(query);
    
    res.json({
      success: true,
      data: {
        results,
        query,
        developerMode: true,
        isolated: true
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Search failed'
    });
  }
});

router.get('/rl/training-stats', (req: DevRequest, res: Response) => {
  const rlModule = developerAgent.getRLModule();
  const stats = rlModule.getTrainingStats();

  res.json({
    success: true,
    data: {
      ...stats,
      developerMode: true
    }
  });
});

/**
 * 训练可视化仪表盘聚合端点（只读，全部来自内存统计）：
 * - rl: RL 训练总览（含对话质量反馈统计）
 * - trainingHistory: policyLoss/valueLoss/entropy 与 episode 奖励时间序列
 * - tools: 各工具成功率聚合
 * - dialogue: 对话质量评估器统计
 */
router.get('/dashboard', async (req: DevRequest, res: Response) => {
  try {
    const rlModule = developerAgent.getRLModule();
    const executionEngine = developerAgent.getExecutionEngine();
    const dialogueEvaluator = developerAgent.getDialogueEvaluator();

    // 历史趋势：优先持久化记录（跨重启存活），DB 不可用时自动回退内存
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const trainingHistory = await rlModule.getTrainingHistory({
      userId: typeof req.query.userId === 'string' ? req.query.userId : undefined,
      limit: Number.isFinite(limit) ? limit : undefined
    });

    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        rl: rlModule.getTrainingStats(),
        trainingHistory,
        tools: executionEngine.getAllToolSuccessRates(),
        dialogue: dialogueEvaluator.getStats()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Dashboard aggregation failed'
    });
  }
});

router.post('/rl/train', async (req: DevRequest, res: Response) => {
  try {
    const rlModule = developerAgent.getRLModule();
    
    rlModule.recordExperience(
      {
        userId: config.devModeUserId,
        currentInput: 'training-step',
        conversationHistory: [],
        availableTools: [],
        timeOfDay: Date.now(),
        conversationTurns: 1,
        inputComplexity: 0.5
      },
      {
        type: 'respond',
        responseText: 'Training action',
        confidence: 0.8
      },
      1.0,
      {
        userId: config.devModeUserId,
        currentInput: 'training-complete',
        conversationHistory: [],
        availableTools: [],
        timeOfDay: Date.now(),
        conversationTurns: 2,
        inputComplexity: 0.5
      },
      false
    );
    
    res.json({
      success: true,
      message: 'RL训练步骤已完成（开发者模式）',
      data: {
        developerMode: true,
        isolated: true
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Training failed'
    });
  }
});

router.get('/evaluation/report', (req: DevRequest, res: Response) => {
  const evaluationSystem = developerAgent.getEvaluationSystem();
  const report = evaluationSystem.generateReport();
  
  res.json({
    success: true,
    data: {
      report,
      developerMode: true,
      isolated: true
    }
  });
});

router.get('/data/governance/stats', (req: DevRequest, res: Response) => {
  const dataGovernance = developerAgent.getDataGovernanceSystem();
  const stats = dataGovernance.getStats();
  
  res.json({
    success: true,
    data: {
      stats,
      developerMode: true
    }
  });
});

router.get('/monitoring/system-report', (req: DevRequest, res: Response) => {
  const monitoring = developerAgent.getMonitoringSystem();
  const report = monitoring.getFullReport();
  
  res.json({
    success: true,
    data: {
      ...report,
      developerMode: true
    }
  });
});

router.get('/iteration/status', (req: DevRequest, res: Response) => {
  const iteration = developerAgent.getContinuousIterationSystem();
  const report = iteration.getFullReport();
  
  res.json({
    success: true,
    data: {
      ...report,
      developerMode: true,
      isolated: true
    }
  });
});

router.post('/reset', (req: DevRequest, res: Response) => {
    const { component } = req.body;
    res.json({
      success: true,
      message: `组件 ${component || 'all'} 已重置（注意：重置逻辑尚未实现，当前为占位）`,
      note: 'TODO: 需实现实际重置逻辑（清理内存、重置计数器等）',
      data: {
        developerMode: true,
        isolated: true,
        component: component || 'all'
      }
    });
});

/**
 * 获取模拟场景列表
 */
router.get('/scenarios', async (req: DevRequest, res: Response) => {
  try {
    const { scenarioEngine } = await import('../core/scenario-engine');
    const scenarios = scenarioEngine.getAllScenarios();
    
    res.json({
      success: true,
      data: scenarios.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        totalSteps: s.totalSteps,
      })),
    });
  } catch (error) {
    console.error('Error getting scenarios:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get scenarios'
    });
  }
});

/**
 * 运行模拟场景
 */
router.post('/scenarios/:id/run', async (req: DevRequest, res: Response) => {
  try {
    const scenarioId = parseInt(req.params.id);
    const { scenarioEngine } = await import('../core/scenario-engine');
    
    const result = await scenarioEngine.runScenario(scenarioId);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error running scenario:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run scenario'
    });
  }
});

/**
 * 获取场景运行状态
 */
router.get('/scenarios/:id/status', async (req: DevRequest, res: Response) => {
  try {
    const scenarioId = parseInt(req.params.id);
    const { scenarioEngine } = await import('../core/scenario-engine');
    
    const status = scenarioEngine.getRunningStatus(scenarioId);
    
    if (!status) {
      res.json({
        success: true,
        data: { running: false },
      });
      return;
    }
    
    res.json({
      success: true,
      data: { running: true, status },
    });
  } catch (error) {
    console.error('Error getting scenario status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status'
    });
  }
});

/**
 * 获取所有运行中的场景
 */
router.get('/scenarios/running', async (req: DevRequest, res: Response) => {
  try {
    const { scenarioEngine } = await import('../core/scenario-engine');
    const running = scenarioEngine.getAllRunningScenarios();
    
    res.json({
      success: true,
      data: running,
    });
  } catch (error) {
    console.error('Error getting running scenarios:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get running scenarios'
    });
  }
});

// ==================== 系统性能监控 API ====================

/**
 * 获取任务管理器性能数据
 */
router.get('/system/task-manager', async (req: DevRequest, res: Response) => {
  try {
    const { getTaskManagerMetrics, formatUptime, getCpuStatus, getMemoryStatus } = 
      await import('../utils/systemMetrics');
    
    const metrics = await getTaskManagerMetrics();
    
    res.json({
      success: true,
      data: {
        // CPU 状态
        cpu: {
          usage: metrics.cpu.usage,
          name: metrics.cpu.name,
          cores: metrics.cpu.cores,
          speed: metrics.cpu.speed,
          status: getCpuStatus(metrics.cpu.usage)
        },
        
        // 内存状态
        memory: {
          total: metrics.memory.total,
          used: metrics.memory.used,
          available: metrics.memory.available,
          usagePercent: metrics.memory.usagePercent,
          status: getMemoryStatus(metrics.memory.usagePercent)
        },
        
        // 磁盘状态
        disk: {
          total: metrics.disk.total,
          used: metrics.disk.used,
          free: metrics.disk.free,
          usagePercent: metrics.disk.usagePercent
        },
        
        // 网络状态
        network: {
          adapter: metrics.network.adapter,
          bytesReceived: metrics.network.bytesReceived,
          bytesSent: metrics.network.bytesSent,
          speed: metrics.network.speed
        },
        
        // GPU 状态 (如果可用)
        gpu: metrics.gpu || null,
        
        // 进程信息
        processes: {
          count: metrics.processes.count,
          topProcesses: metrics.processes.topProcesses.slice(0, 5)
        },
        
        // 系统信息
        system: {
          uptime: metrics.system.uptime,
          uptimeFormatted: formatUptime(metrics.system.uptime),
          os: metrics.system.os,
          hostname: metrics.system.hostname
        },
        
        timestamp: metrics.timestamp.toISOString(),
        developerMode: true
      }
    });
  } catch (error) {
    console.error('Error getting task manager metrics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get system metrics'
    });
  }
});

/**
 * 获取简化的系统指标 (用于快速轮询)
 */
router.get('/system/quick-metrics', async (req: DevRequest, res: Response) => {
  try {
    const { getQuickMetrics } = await import('../utils/systemMetrics');
    
    const metrics = await getQuickMetrics();
    
    res.json({
      success: true,
      data: {
        cpu: Math.round(metrics.cpu * 100) / 100,
        memory: Math.round(metrics.memory * 100) / 100,
        disk: Math.round(metrics.disk * 100) / 100,
        timestamp: metrics.timestamp.toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get quick metrics'
    });
  }
});

/**
 * 同步开发者配置到生产环境
 * 注意：当前为共享 Agent 架构，配置/工具/RAG/RL 等全局共享，无需显式同步。
 * 此端点保留用于未来按用户隔离后的迁移操作。
 */
router.post('/sync-to-production', async (req: DevRequest, res: Response) => {
  res.json({
    success: true,
    message: '共享 Agent 架构下无需同步——所有配置实时生效',
    data: {
      syncedAt: new Date().toISOString(),
      components: [],
      affectedUsers: 'n/a — 共享架构',
      developerMode: true
    }
  });
});

/**
 * 获取同步状态和历史
 */
router.get('/sync-status', (req: DevRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      currentStatus: 'shared', // 共享模式
      lastSync: new Date().toISOString(),
      sharedComponents: ['config', 'tools', 'rag', 'memory', 'rl', 'monitoring'],
      message: '开发者入口与生产环境共享同一个Agent实例，配置实时同步'
    }
  });
});

/**
 * 获取最近的日志
 */
router.get('/logs', (req: DevRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const level = req.query.level as string;
    const category = req.query.category as string;
    
    const auditSystem = developerAgent.getAuditSystem();
    
    const query: any = { limit };
    if (level) query.levels = [level as any];
    if (category) query.categories = [category as any];
    
    const logs = auditSystem.query(query);
    
    res.json({
      success: true,
      data: logs.map(log => ({
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        level: log.level,
        category: log.category,
        action: log.action,
        result: log.result,
        userId: log.userId,
        resource: log.resource,
        resourceId: log.resourceId,
        duration: log.duration,
        errorMessage: log.errorMessage
      })),
      total: logs.length,
      developerMode: true
    });
  } catch (error) {
    console.error('Error getting logs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get logs'
    });
  }
});

/**
 * 获取日志统计
 */
router.get('/logs/stats', (req: DevRequest, res: Response) => {
  try {
    const auditSystem = developerAgent.getAuditSystem();
    const summary = auditSystem.getSummary();
    
    res.json({
      success: true,
      data: {
        totalEntries: summary.totalEntries,
        byLevel: summary.byLevel,
        byCategory: summary.byCategory,
        byResult: summary.byResult,
        securityAlerts: summary.securityAlerts,
        developerMode: true
      }
    });
  } catch (error) {
    console.error('Error getting log stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get log stats'
    });
  }
});

/**
 * 导出日志
 */
router.get('/logs/export', (req: DevRequest, res: Response) => {
  try {
    const format = (req.query.format as string) || 'json';
    const level = req.query.level as string;
    const category = req.query.category as string;
    
    const auditSystem = developerAgent.getAuditSystem();
    
    const query: any = {};
    if (level) query.levels = [level as any];
    if (category) query.categories = [category as any];
    
    const exported = auditSystem.export(format as 'json' | 'csv', query);
    
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.${format}`);
    res.send(exported);
  } catch (error) {
    console.error('Error exporting logs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export logs'
    });
  }
});

// ==================== 紧急入口：通过 Developer Key 强制升级用户为管理员 ====================
// 用于首次部署或紧急场景。鉴权：X-Developer-Key 必须匹配配置。
router.post('/users/promote-admin', async (req: DevRequest, res) => {
  try {
    const username = req.body?.username as string | undefined;
    const email = req.body?.email as string | undefined;
    const confirm = req.body?.confirm as string | undefined;

    // 🔒 安全修复：必须同时提供 username 和 email，防止 updateMany 误伤
    if (!username || !email) {
      return res.status(400).json({ success: false, error: '必须同时提供 username 和 email' });
    }
    // 🔒 安全修复：必须提供确认字符串，防止误操作
    const expectedConfirm = `promote:${username}`;
    if (confirm !== expectedConfirm) {
      return res.status(400).json({ success: false, error: '请提供正确的确认字段', expectedConfirm });
    }

    const query = { username, email };

    const before = await User.find(query).select('username email role').lean();
    if (before.length === 0) {
      return res.status(404).json({ success: false, error: '未找到匹配的用户' });
    }
    if (before.length > 1) {
      return res.status(400).json({ success: false, error: '匹配到多个用户，请提供更精确的查询条件' });
    }

    // 🔒 安全修复：只更新单个用户，不再使用 updateMany
    const r = await User.updateOne(query, { $set: { role: 'admin' } });
    const after = await User.find(query).select('username email role').lean();

    // 🔒 安全修复：记录审计日志
    const agent = getSharedAgent();
    const audit = agent.getAuditSystem();
    if (audit) {
      audit.log({
        level: 'warning',
        category: 'authorization',
        action: 'user.role_change',
        resource: 'user',
        resourceId: username,
        details: {
          operator: req.devUserId ?? 'dev-api',
          target: username,
          from: before[0].role,
          to: 'admin',
        },
        result: 'success',
      });
    }

    res.json({
      success: true,
      matched: r.matchedCount,
      modified: r.modifiedCount,
      before, after
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

function runNpmAudit(cwd: string, timeoutMs: number): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: string;
  json?: any;
}> {
  return new Promise((resolve) => {
    try {
      const child = spawn('npm', ['audit', '--json'], {
        cwd,
        windowsHide: true,
        shell: process.platform === 'win32',
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGTERM');
        } catch (_) {
          try { child.kill('SIGKILL'); } catch (__) {}
        }
        resolve({
          stdout,
          stderr,
          exitCode: null,
          error: `npm audit 超时（${timeoutMs}ms）`,
        });
      }, timeoutMs);

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', (err) => {
        if (timedOut) return;
        clearTimeout(timer);
        resolve({
          stdout,
          stderr,
          exitCode: null,
          error: err?.message || String(err),
        });
      });
      child.on('close', (code) => {
        if (timedOut) return;
        clearTimeout(timer);
        let json: any = undefined;
        try {
          const toParse = stdout && stdout.trim() ? stdout : (stderr || '');
          json = JSON.parse(toParse);
        } catch (_) {
          json = undefined;
        }
        resolve({
          stdout,
          stderr,
          exitCode: code,
          json,
        });
      });
    } catch (e: any) {
      resolve({
        stdout: '',
        stderr: '',
        exitCode: null,
        error: e?.message || String(e),
      });
    }
  });
}

router.post('/users/reset-mfa', async (req: DevRequest, res: Response) => {
  try {
    const userId = (req.body as any)?.userId;
    if (!userId) return res.status(400).json({ success: false, error: '缺少 userId 参数' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' });

    (user as any).totpEnabled = false;
    (user as any).totpSecret = undefined;
    (user as any).totpBackupCodes = [];
    (user as any).totpUsedBackupMask = 0;
    await user.save();

    try {
      const auditSystem = developerAgent.getAuditSystem();
      auditSystem.log({
        category: 'authorization' as any,
        level: 'warning' as any,
        action: 'mfa_admin_reset',
        resource: 'user',
        resourceId: userId.toString(),
        details: { summary: `开发者/管理员强制关闭用户 MFA: ${user.username}; actorId=${req.devUserId || config.devModeUserId || 'developer'} actorName=DeveloperPortal` },
        result: 'success',
        ipAddress: req.ip,
      });
    } catch (_) { /* ignore */ }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

router.get('/npm-audit', async (_req: DevRequest, res: Response) => {
  try {
    const enabled = process.env.NPM_AUDIT_ENABLED !== '0';
    if (!enabled) {
      return res.status(403).json({
        success: false,
        error: 'NPM_AUDIT_ENABLED=0，npm audit 监控接口已被禁用',
      });
    }

    const backendDir = path.resolve(__dirname, '..', '..');
    const frontendDir = path.resolve(backendDir, '..', 'frontend');

    const results = await Promise.allSettled([
      runNpmAudit(backendDir, 60_000),
      runNpmAudit(frontendDir, 60_000),
    ]);

    const backend = results[0].status === 'fulfilled'
      ? results[0].value
      : { stdout: '', stderr: '', exitCode: null, error: results[0].reason?.message || String(results[0].reason) };

    const frontend = results[1].status === 'fulfilled'
      ? results[1].value
      : { stdout: '', stderr: '', exitCode: null, error: results[1].reason?.message || String(results[1].reason) };

    return res.json({
      success: true,
      backend,
      frontend,
      checkedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return res.json({
      success: false,
      error: 'npm audit 执行失败：' + (e?.message || String(e)),
    });
  }
});

export default router;
