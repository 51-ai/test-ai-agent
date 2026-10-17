import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

app.use(helmet());
// 🔒 安全修复：开发服务器仅在 NODE_ENV !== 'production' 时可用
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: false,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 🔒 安全修复：生产环境启动时立即退出
if (process.env.NODE_ENV === 'production') {
  console.error('[dev-server] 生产环境禁止启动开发服务器，已退出');
  process.exit(1);
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

const conversations = new Map<string, Conversation>();
const users = new Map<string, any>();

app.use((req: any, res: any, next: any) => {
  req.users = users;
  req.conversations = conversations;
  next();
});

import authRoutes from './api/auth';
import conversationRoutes from './api/conversation';
import agentRoutes from './api/agent';
import monitoringRoutes from './api/monitoring';
import healthRoutes from './api/health';

app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api', healthRoutes);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;