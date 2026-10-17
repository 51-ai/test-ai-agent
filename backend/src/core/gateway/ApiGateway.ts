/**
 * API网关 - 路由/限流/认证/熔断/版本管理
 */

import { v4 as uuidv4 } from 'uuid';

export type RouteStatus = 'active' | 'inactive' | 'deprecated' | 'maintenance';
export type AuthType = 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth2' | 'jwt';
export type LoadBalanceStrategy = 'round_robin' | 'weighted' | 'least_connections' | 'ip_hash' | 'random';
export type CircuitState = 'closed' | 'open' | 'half_open';

export interface Route {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD' | 'ANY';
  target: string;
  status: RouteStatus;
  version: string;
  auth: { type: AuthType; required: boolean; scopes?: string[] };
  rateLimit?: { requests: number; windowMs: number; strategy: 'fixed' | 'sliding' | 'token' };
  timeout: number;
  retries: number;
  circuitBreaker?: { failureThreshold: number; resetTimeoutMs: number; halfOpenRequests: number };
  headers?: Record<string, string>;
  middlewares: string[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface Service {
  id: string;
  name: string;
  url: string;
  health: 'healthy' | 'unhealthy' | 'unknown';
  weight: number;
  activeConnections: number;
  totalRequests: number;
  failedRequests: number;
  averageLatency: number;
  lastHealthCheck?: Date;
  metadata?: Record<string, unknown>;
}

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  userId: string;
  scopes: string[];
  rateLimit: { requests: number; windowMs: number };
  status: 'active' | 'revoked' | 'expired';
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
  requestCount: number;
}

export interface GatewayRequest {
  id: string;
  routeId: string;
  method: string;
  path: string;
  userId?: string;
  apiKeyId?: string;
  statusCode: number;
  latencyMs: number;
  success: boolean;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
  error?: string;
}

export interface CircuitBreaker {
  id: string;
  routeId: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  consecutiveFailures: number;
  openedAt?: Date;
  lastFailureAt?: Date;
  nextAttemptAt?: Date;
}

export interface GatewayStats {
  totalRoutes: number;
  totalServices: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  byStatus: Record<number, number>;
  topRoutes: Array<{ path: string; requests: number; avgLatency: number; errorRate: number }>;
  openCircuits: number;
}

export class ApiGateway {
  private routes: Map<string, Route> = new Map();
  private services: Map<string, Service> = new Map();
  private apiKeys: Map<string, ApiKey> = new Map();
  private requests: GatewayRequest[] = [];
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private rateLimitBuckets: Map<string, { count: number; resetAt: Date }> = new Map();
  private roundRobinCounters: Map<string, number> = new Map();
  private stats: GatewayStats = {
    totalRoutes: 0,
    totalServices: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
    byStatus: {},
    topRoutes: [],
    openCircuits: 0
  };
  private totalLatency = 0;

  registerRoute(config: Omit<Route, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = uuidv4();
    const route: Route = {
      ...config,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.routes.set(id, route);
    this.stats.totalRoutes++;
    if (route.circuitBreaker) {
      this.circuitBreakers.set(id, {
        id: uuidv4(),
        routeId: id,
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        consecutiveFailures: 0
      });
    }
    return id;
  }

  registerService(name: string, url: string, weight: number = 1): string {
    const id = uuidv4();
    this.services.set(id, {
      id, name, url, health: 'unknown', weight, activeConnections: 0, totalRequests: 0, failedRequests: 0, averageLatency: 0
    });
    this.stats.totalServices++;
    return id;
  }

  createApiKey(name: string, userId: string, scopes: string[] = [], expiresAt?: Date, rateLimit: { requests: number; windowMs: number } = { requests: 1000, windowMs: 60000 }): string {
    const id = uuidv4();
    const key = `ak_${uuidv4().replace(/-/g, '')}`;
    this.apiKeys.set(key, {
      id, key, name, userId, scopes, rateLimit, status: 'active', createdAt: new Date(), expiresAt, requestCount: 0
    });
    return key;
  }

  revokeApiKey(key: string): boolean {
    const apiKey = this.apiKeys.get(key);
    if (!apiKey) return false;
    apiKey.status = 'revoked';
    return true;
  }

  matchRoute(method: string, path: string): Route | null {
    for (const route of this.routes.values()) {
      if (route.status !== 'active') continue;
      if (route.method !== 'ANY' && route.method !== method.toUpperCase()) continue;
      if (this.matchPath(route.path, path)) return route;
    }
    return null;
  }

  private matchPath(pattern: string, path: string): boolean {
    if (pattern === path) return true;
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    if (patternParts.length !== pathParts.length) return false;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) continue;
      if (patternParts[i] !== pathParts[i]) return false;
    }
    return true;
  }

  authenticate(request: { apiKey?: string; token?: string; authHeader?: string }, requiredAuth: Route['auth']): { success: boolean; userId?: string; scopes?: string[]; reason?: string } {
    if (requiredAuth.type === 'none' || !requiredAuth.required) return { success: true };

    if (requiredAuth.type === 'api_key' && request.apiKey) {
      const apiKey = this.apiKeys.get(request.apiKey);
      if (!apiKey) return { success: false, reason: 'Invalid API key' };
      if (apiKey.status !== 'active') return { success: false, reason: 'API key not active' };
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return { success: false, reason: 'API key expired' };
      apiKey.lastUsedAt = new Date();
      apiKey.requestCount++;
      return { success: true, userId: apiKey.userId, scopes: apiKey.scopes };
    }

    if (requiredAuth.type === 'bearer' || requiredAuth.type === 'jwt') {
      const token = request.token || request.authHeader?.replace(/^Bearer\s+/i, '');
      if (!token) return { success: false, reason: 'Missing token' };
      // 简化的 token 验证
      if (token.length < 10) return { success: false, reason: 'Invalid token' };
      return { success: true, userId: 'token_user' };
    }

    return { success: true };
  }

  checkRateLimit(identifier: string, limit: { requests: number; windowMs: number }): { allowed: boolean; remaining: number; resetAt: Date } {
    const now = new Date();
    let bucket = this.rateLimitBuckets.get(identifier);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: new Date(now.getTime() + limit.windowMs) };
      this.rateLimitBuckets.set(identifier, bucket);
    }
    bucket.count++;
    const allowed = bucket.count <= limit.requests;
    return { allowed, remaining: Math.max(0, limit.requests - bucket.count), resetAt: bucket.resetAt };
  }

  selectService(route: Route, identifier?: string): Service | null {
    const candidates = Array.from(this.services.values()).filter(s => s.url.startsWith(route.target.split('/')[0]) || s.url.includes(route.target));
    if (candidates.length === 0) return null;
    const healthy = candidates.filter(s => s.health === 'healthy');
    const pool = healthy.length > 0 ? healthy : candidates;

    const counter = this.roundRobinCounters.get(route.id) || 0;
    this.roundRobinCounters.set(route.id, counter + 1);
    return pool[counter % pool.length];
  }

  recordCircuitSuccess(routeId: string): void {
    const cb = this.circuitBreakers.get(routeId);
    if (!cb) return;
    cb.successCount++;
    cb.consecutiveFailures = 0;
    if (cb.state === 'half_open' && cb.successCount >= 3) {
      cb.state = 'closed';
      cb.failureCount = 0;
    }
  }

  recordCircuitFailure(routeId: string): void {
    const cb = this.circuitBreakers.get(routeId);
    if (!cb) return;
    cb.failureCount++;
    cb.consecutiveFailures++;
    cb.lastFailureAt = new Date();
    if (cb.routeId) {
      const route = this.routes.get(cb.routeId);
      if (route?.circuitBreaker && cb.consecutiveFailures >= route.circuitBreaker.failureThreshold) {
        cb.state = 'open';
        cb.openedAt = new Date();
        cb.nextAttemptAt = new Date(Date.now() + route.circuitBreaker.resetTimeoutMs);
        this.stats.openCircuits++;
      }
    }
  }

  canPassCircuit(routeId: string): boolean {
    const cb = this.circuitBreakers.get(routeId);
    if (!cb) return true;
    if (cb.state === 'closed') return true;
    if (cb.state === 'open') {
      if (cb.nextAttemptAt && cb.nextAttemptAt <= new Date()) {
        cb.state = 'half_open';
        return true;
      }
      return false;
    }
    return true;
  }

  async handle(request: { method: string; path: string; apiKey?: string; token?: string; authHeader?: string; ip?: string; userAgent?: string }): Promise<{ statusCode: number; body: unknown; latencyMs: number }> {
    const start = Date.now();
    const route = this.matchRoute(request.method, request.path);
    if (!route) {
      return { statusCode: 404, body: { error: 'Route not found' }, latencyMs: Date.now() - start };
    }

    if (route.status === 'maintenance') {
      return { statusCode: 503, body: { error: 'Service under maintenance' }, latencyMs: Date.now() - start };
    }

    const auth = this.authenticate(request, route.auth);
    if (!auth.success) {
      return { statusCode: 401, body: { error: auth.reason }, latencyMs: Date.now() - start };
    }

    if (route.rateLimit) {
      const identifier = request.apiKey || request.ip || 'anonymous';
      const rateCheck = this.checkRateLimit(identifier, route.rateLimit);
      if (!rateCheck.allowed) {
        return { statusCode: 429, body: { error: 'Rate limit exceeded' }, latencyMs: Date.now() - start };
      }
    }

    if (!this.canPassCircuit(route.id)) {
      return { statusCode: 503, body: { error: 'Circuit breaker open' }, latencyMs: Date.now() - start };
    }

    // 模拟转发
    const service = this.selectService(route);
    const latency = Date.now() - start + Math.floor(Math.random() * 50);
    const success = Math.random() > 0.05;
    const statusCode = success ? 200 : 500;

    if (success) this.recordCircuitSuccess(route.id);
    else this.recordCircuitFailure(route.id);

    const gwRequest: GatewayRequest = {
      id: uuidv4(),
      routeId: route.id,
      method: request.method,
      path: request.path,
      userId: auth.userId,
      apiKeyId: request.apiKey,
      statusCode,
      latencyMs: latency,
      success,
      timestamp: new Date(),
      ip: request.ip,
      userAgent: request.userAgent
    };
    this.requests.push(gwRequest);
    if (this.requests.length > 10000) this.requests.shift();
    this.stats.totalRequests++;
    if (success) this.stats.successfulRequests++;
    else this.stats.failedRequests++;
    this.totalLatency += latency;
    this.stats.averageLatency = this.totalLatency / this.stats.totalRequests;
    this.stats.byStatus[statusCode] = (this.stats.byStatus[statusCode] || 0) + 1;

    return { statusCode, body: { forwarded: true, service: service?.name, latencyMs: latency }, latencyMs: latency };
  }

  healthCheck(serviceId: string, healthy: boolean): void {
    const service = this.services.get(serviceId);
    if (service) {
      service.health = healthy ? 'healthy' : 'unhealthy';
      service.lastHealthCheck = new Date();
    }
  }

  listRoutes(): Route[] {
    return Array.from(this.routes.values());
  }

  listServices(): Service[] {
    return Array.from(this.services.values());
  }

  listRequests(limit: number = 100): GatewayRequest[] {
    return this.requests.slice(-limit);
  }

  getStats(): GatewayStats {
    const routeStats = new Map<string, { requests: number; latency: number; errors: number }>();
    for (const r of this.requests) {
      const route = this.routes.get(r.routeId);
      if (!route) continue;
      const m = routeStats.get(route.path) || { requests: 0, latency: 0, errors: 0 };
      m.requests++;
      m.latency += r.latencyMs;
      if (!r.success) m.errors++;
      routeStats.set(route.path, m);
    }
    this.stats.topRoutes = Array.from(routeStats.entries())
      .map(([path, m]) => ({ path, requests: m.requests, avgLatency: m.latency / m.requests, errorRate: m.errors / m.requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
    this.stats.openCircuits = Array.from(this.circuitBreakers.values()).filter(c => c.state === 'open').length;
    return { ...this.stats };
  }
}

export const apiGateway = new ApiGateway();
export default ApiGateway;
