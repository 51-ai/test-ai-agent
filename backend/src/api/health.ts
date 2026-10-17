import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { performanceMonitor } from '../core/system-monitoring/PerformanceMonitor';
import { isEphemeralDB } from '../utils/database';

const router = Router();

router.get('/health', async (req: Request, res: Response): Promise<void> => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      mongodb: 'unknown',
      redis: 'unknown'
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    },
    performance: performanceMonitor.getAllMetrics()
  };

  try {
    if (mongoose.connection.readyState === 1) {
      healthStatus.services.mongodb = isEphemeralDB() ? 'ephemeral' : 'connected';
    } else if (mongoose.connection.readyState === 2) {
      healthStatus.services.mongodb = 'connecting';
    } else if (mongoose.connection.readyState === 0) {
      healthStatus.services.mongodb = 'disconnected';
    }
  } catch (error) {
    healthStatus.services.mongodb = 'error';
  }

  try {
    const redisClient = req.app.get('redisClient');
    if (redisClient && redisClient.isOpen) {
      await redisClient.ping();
      healthStatus.services.redis = 'connected';
    } else {
      healthStatus.services.redis = 'disconnected';
    }
  } catch (error) {
    healthStatus.services.redis = 'error';
  }

  const allServicesHealthy = 
    healthStatus.services.mongodb === 'connected' ||
    healthStatus.services.mongodb === 'ephemeral';

  // 内存数据库降级为 degraded，K8s 不应把它当作健康
  if (healthStatus.services.mongodb === 'ephemeral') {
    healthStatus.status = 'degraded';
    res.status(503).json(healthStatus);
    return;
  }

  if (!allServicesHealthy) {
    healthStatus.status = 'degraded';
    res.status(503).json(healthStatus);
    return;
  }

  // 如果 Redis 未连接，标记为 degraded 但仍然返回 200
  if (healthStatus.services.redis !== 'connected') {
    healthStatus.status = 'degraded';
  }

  res.status(200).json(healthStatus);
});

router.get('/health/live', (req: Request, res: Response): void => {
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
});

router.get('/health/ready', async (req: Request, res: Response): Promise<void> => {
  try {
    const mongodbReady = mongoose.connection.readyState === 1;
    
    const redisClient = req.app.get('redisClient');
    const redisReady = redisClient && redisClient.isOpen;
    
    if (mongodbReady && redisReady) {
      res.status(200).json({ 
        status: 'ready', 
        timestamp: new Date().toISOString(),
        services: { mongodb: true, redis: true }
      });
    } else {
      res.status(503).json({ 
        status: 'not_ready', 
        timestamp: new Date().toISOString(),
        services: { mongodb: mongodbReady, redis: redisReady }
      });
    }
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;