import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { connectDB } from './utils/database';
import authRoutes from './api/auth';
import conversationRoutes from './api/conversation';
import agentRoutes from './api/agent';
import monitoringRoutes from './api/monitoring';
import healthRoutes from './api/health';
import agentSystemRoutes from './api/agent-system';
import developerRoutes from './api/developer';
import adminRoutes from './api/admin';
import mfaRoutes from './api/mfa';
import { inputGuard, outputGuard } from './middlewares/ioGuard';

// Trigger restart
const app = express();

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
      : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin || true);
    } else if (process.env.NODE_ENV !== 'production' &&
               (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
      // 开发环境宽松兜底
      callback(null, origin);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: process.env.NODE_ENV !== 'production',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 全局限流
const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// 对登录/聊天的严格限流：防止暴力破解与 LLM 费用滥用
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/mfa/login', authLimiter);

const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many LLM requests, please slow down.' },
});
app.use('/api/agent/chat', llmLimiter);
app.use('/api/agent/summarize', llmLimiter);

// 开发者端点限流：防资源耗尽（npm-audit 启动子进程，scenarios 批量执行）
const devLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many developer requests, please slow down.' },
});
app.use('/api/dev/scenarios', devLimiter);
app.use('/api/dev/npm-audit', devLimiter);

if (process.env.I_O_GUARD !== '0') {
  app.use(inputGuard);
  app.use(outputGuard);
}

app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api', healthRoutes);
app.use('/api/agent-system', agentSystemRoutes);
app.use('/api/dev', developerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/mfa', mfaRoutes);

// 训练可视化仪表盘等本地静态页面（无构建依赖，直接伺服 public/）
// 路径解析：优先编译产物内的 dist/public（build 时拷贝），回退源码目录 public（ts-node/tsx 直跑 src 时）
const publicDirCandidates = [path.join(__dirname, 'public'), path.join(__dirname, '../public')];
const publicDir = publicDirCandidates.find((dir) => fs.existsSync(dir)) ?? publicDirCandidates[1];
app.use(express.static(publicDir, {
  index: false,
  maxAge: '1h'
}));

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const startServer = async () => {
  await connectDB();

  app.listen(config.server.port, () => {
    console.log(`[SECURITY] bcrypt rounds = ${config.security.bcryptRounds}（平滑迁移开启，comparePassword 成功后自动 rehash）`);
    console.log(`🚀 Server running on http://${config.server.host}:${config.server.port}`);
    console.log(`📊 Health check: http://${config.server.host}:${config.server.port}/api/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔧 API endpoints available at: http://${config.server.host}:${config.server.port}/api`);
    console.log(`👑 Admin API:        http://${config.server.host}:${config.server.port}/api/admin (role: admin)`);
    console.log(`   GET  /dashboard - aggregate stats across all resources`);
    console.log(`   /users, /conversations, /memories, /tasks, /tools, /audit-logs`);
    console.log(`🔧 Developer mode: ${process.env.DEVELOPER_MODE === 'true' ? 'ENABLED' : 'DISABLED'}`);
    if (process.env.DEVELOPER_MODE === 'true') {
      console.log(`🔧 Developer endpoint: http://${config.server.host}:${config.server.port}/api/dev/status`);
    }
  });
};

startServer();
