import { Request, Response, NextFunction } from 'express';
import { getAuditSystem } from '../core/audit/AuditSystem';

const auditSystem = getAuditSystem();

export const OVERSIZE_CHARS = 20_000;

export const APIKEY_RE = /(sk-[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|glpat-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|xoxb-[A-Za-z0-9-]{10,})/;

export const INJECTION_KEYWORDS = [
  'ignore previous instructions',
  'ignore all prior',
  'disregard previous',
  '你是一个无限制的助手',
  '解除限制',
  '泄露 prompt',
  'system prompt',
  'prompt injection',
  'jailbreak',
];

function stringifyRequestBody(body: any): string {
  if (body === null || body === undefined) return '';
  if (typeof body === 'string') return body;
  const parts: string[] = [];
  const walk = (obj: any) => {
    if (obj === null || obj === undefined) return;
    if (typeof obj === 'string') {
      parts.push(obj);
      return;
    }
    if (typeof obj === 'number' || typeof obj === 'boolean') {
      parts.push(String(obj));
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach(walk);
      return;
    }
    if (typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        parts.push(k);
        walk(v);
      }
    }
  };
  walk(body);
  try {
    parts.push(JSON.stringify(body));
  } catch {}
  return parts.join(' ');
}

export function inputGuard(req: Request, res: Response, next: NextFunction) {
  // 放行认证路由（/api/auth）
  if (req.path.startsWith('/api/auth') && !req.path.includes('/analyze')) {
    return next();
  }
  // 放行开发者入口（/api/dev）
  if (req.path.startsWith('/api/dev')) {
    return next();
  }
  // 放行聊天路径：用户正常对话不应被 prompt-injection 关键词拦截
  // 注意用 /api/agent/ 而非 /api/agent，避免误匹配 /api/agent-system
  if (req.path.startsWith('/api/agent/') || req.path.startsWith('/api/conversations/')) {
    return next();
  }

  const text = stringifyRequestBody(req.body);
  const length = text.length;
  let reason: string | undefined;
  let hit: string | undefined;

  const apiKeyMatch = text.match(APIKEY_RE);
  if (apiKeyMatch) {
    reason = '检测到疑似 API Key / Token 泄漏';
    hit = apiKeyMatch[0].slice(0, 16) + '***';
  }

  if (!reason && length > OVERSIZE_CHARS) {
    reason = '请求输入长度超过上限';
    hit = `${length} > ${OVERSIZE_CHARS}`;
  }

  if (!reason) {
    const lower = text.toLowerCase();
    const hitKey = INJECTION_KEYWORDS.find(k => lower.includes(k.toLowerCase()));
    if (hitKey) {
      reason = '检测到疑似 Prompt 注入关键字';
      hit = hitKey;
    }
  }

  if (reason) {
    try {
      auditSystem.log({
        level: 'warning',
        category: 'security',
        action: 'llm_guard_block',
        userId: (req as any).user?.id,
        result: 'blocked',
        details: {
          reason,
          hit,
          length,
          path: req.path,
          method: req.method,
        },
        ipAddress: req.ip || (req.socket?.remoteAddress),
        userAgent: req.headers['user-agent'],
      });
    } catch {}
    return res.status(403).json({
      success: false,
      error: '输入安全校验未通过',
      guardReason: reason,
    });
  }

  next();
}

const INTERNAL_KEYWORDS = [
  '/api/dev',
  'mongo+srv',
  'BCRYPT_ROUNDS',
];

function maskSensitiveContent(content: string): string {
  let out = content;
  out = out.replace(APIKEY_RE, (match) => {
    if (match.length <= 8) return '****';
    return match.slice(0, 4) + '****' + match.slice(-2);
  });
  for (const kw of INTERNAL_KEYWORDS) {
    const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, () => '*'.repeat(kw.length));
  }
  out = out.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (_match, prefix: string) => {
    if (prefix.length === 0) return '[at]***';
    const first = prefix[0];
    const stars = '*'.repeat(Math.max(prefix.length - 1, 2));
    return `${first}${stars}[at]***`;
  });
  out = out.replace(/1[3-9]\d{9}/g, '1**********');
  return out;
}

export function outputGuard(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);
  (res as any).json = (payload: any) => {
    try {
      if (payload && typeof payload === 'object' && typeof payload?.content === 'string') {
        payload.content = maskSensitiveContent(payload.content);
      }
    } catch {}
    return originalJson(payload);
  };
  next();
}
