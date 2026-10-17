import { Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from './auth';
import { getAuditSystem } from '../core/audit/AuditSystem';

const audit = getAuditSystem();

/**
 * 审计日志中间件：对需要审计的路由，自动记录操作
 * 需要先经过 authenticate 中间件
 */
export const auditAction = (resource: string, action: string, category: 'authorization' | 'data_access' | 'data_modification' | 'security' = 'data_modification') => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const resultPromise = new Promise<void>((resolve) => {
      const originalSend = _res.json.bind(_res);
      _res.json = ((body: unknown) => {
        const result: 'success' | 'failure' =
          _res.statusCode < 400 ? 'success' : 'failure';
        const errorMessage =
          result === 'failure' && body && typeof body === 'object' && 'error' in body
            ? String((body as { error?: unknown }).error)
            : undefined;

        audit.log({
          level: result === 'success' ? 'info' : 'warning',
          category,
          userId: req.user?.id,
          action,
          resource,
          resourceId: req.params?.id,
          details: {
            method: req.method,
            path: req.path,
            query: req.query,
            body: sanitizeBody(req.body),
            statusCode: _res.statusCode
          },
          ipAddress: req.ip || (req.socket?.remoteAddress),
          userAgent: req.headers['user-agent'],
          result,
          errorMessage
        });
        resolve();
        return originalSend(body);
      }) as typeof _res.json;
      next();
    });
    resultPromise.catch(() => { /* noop */ });
  };
};

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const obj = body as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const sensitive = ['password', 'token', 'secret', 'apiKey', 'authorization'];
  for (const [k, v] of Object.entries(obj)) {
    if (sensitive.some(s => k.toLowerCase().includes(s))) {
      result[k] = '***REDACTED***';
    } else {
      result[k] = v;
    }
  }
  return result;
}

/** 中间件链：先 authenticate，再 requireAdmin，再记录审计 */
export const adminOnly = (resource: string, action: string, category: 'authorization' | 'data_access' | 'data_modification' | 'security' = 'data_modification') => [
  authenticate,
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'admin') {
      audit.log({
        level: 'warning',
        category: 'authorization',
        userId: req.user?.id,
        action,
        resource,
        resourceId: req.params?.id,
        details: { method: req.method, path: req.path },
        ipAddress: req.ip || (req.socket?.remoteAddress),
        userAgent: req.headers['user-agent'],
        result: 'blocked',
        errorMessage: 'Admin role required'
      });
      return res.status(403).json({ error: 'Forbidden: admin role required' });
    }
    next();
  },
  auditAction(resource, action, category)
];
