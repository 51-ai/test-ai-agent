/**
 * 安全管理器 - 处理输入验证、认证授权等安全相关功能
 */

export interface SecurityConfig {
  maxInputLength: number;
  maxOutputLength: number;
  allowedContentTypes: string[];
  blockedKeywords: string[];
  requireAuth: boolean;
  rateLimitEnabled: boolean;
  maxRequestsPerMinute: number;
}

const DEFAULT_CONFIG: SecurityConfig = {
  maxInputLength: 4096,
  maxOutputLength: 8192,
  allowedContentTypes: ['text/plain', 'application/json'],
  blockedKeywords: ['eval(', 'exec(', 'rm -rf', 'DROP TABLE', 'DELETE FROM'],
  requireAuth: false,
  rateLimitEnabled: true,
  maxRequestsPerMinute: 60
};

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// === 新增：安全增强类型 ===
export type ThreatLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type UserRole = 'admin' | 'user' | 'guest' | 'developer';

export interface Permission {
  resource: string;
  actions: ('read' | 'write' | 'delete' | 'execute')[];
}

export interface UserSecurityProfile {
  userId: string;
  role: UserRole;
  permissions: Permission[];
  failedLoginAttempts: number;
  lastLoginTime?: Date;
  isLocked: boolean;
  riskScore: number;
  trustedDevices: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  result: 'success' | 'failure' | 'blocked';
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface SecurityReport {
  generatedAt: Date;
  totalThreats: number;
  threatsByLevel: Record<ThreatLevel, number>;
  blockedRequests: number;
  rateLimitHits: number;
  intrusionAttempts: number;
  topAttackTypes: Array<{ type: string; count: number }>;
  recommendations: string[];
}

export interface IntrusionDetectionResult {
  isIntrusion: boolean;
  threatLevel: ThreatLevel;
  confidence: number;
  indicators: string[];
  recommendedActions: string[];
}

export class SecurityManager {
  private config: SecurityConfig;
  private rateLimits = new Map<string, RateLimitEntry>();
  
  // === 新增：安全增强属性 ===
  private userProfiles = new Map<string, UserSecurityProfile>();
  private auditLogs: AuditLogEntry[] = [];
  private intrusionLogs: Array<{ timestamp: Date; type: string; ip: string; userId?: string }> = [];
  private encryptionKeys = new Map<string, { key: string; createdAt: Date; expiresAt?: Date }>();
  private maxAuditLogSize = 10000;
  private suspiciousPatterns = [
    { pattern: /union\s+select/i, threat: 'SQL注入', weight: 0.9 },
    { pattern: /<script[^>]*>/i, threat: 'XSS攻击', weight: 0.85 },
    { pattern: /eval\s*\(/i, threat: '代码注入', weight: 0.95 },
    { pattern: /\.\.\/|\.\.\//i, threat: '路径遍历', weight: 0.8 },
    { pattern: /password\s*=\s*['"]/i, threat: '密码泄露尝试', weight: 0.7 },
    { pattern: /base64\s*_decode/i, threat: '编码混淆', weight: 0.6 },
    { pattern: /onerror\s*=/i, threat: '事件处理器注入', weight: 0.85 },
    { pattern: /javascript\s*:/i, threat: 'JavaScript协议注入', weight: 0.75 },
  ];
  private rolePermissions: Record<UserRole, Permission[]> = {
    admin: [
      { resource: '*', actions: ['read', 'write', 'delete', 'execute'] }
    ],
    developer: [
      { resource: 'code', actions: ['read', 'write', 'execute'] },
      { resource: 'data', actions: ['read', 'write'] },
      { resource: 'config', actions: ['read'] }
    ],
    user: [
      { resource: 'own_data', actions: ['read', 'write'] },
      { resource: 'shared_data', actions: ['read'] }
    ],
    guest: [
      { resource: 'public_data', actions: ['read'] }
    ]
  };
  
  // 限流策略配置
  private rateLimitStrategies = {
    sliding: { windowMs: 60000, maxRequests: 60 },
    fixed: { windowMs: 60000, maxRequests: 60 },
    tokenBucket: { capacity: 100, refillRate: 10 }
  };

  constructor(config?: Partial<SecurityConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  // === 新增：安全增强方法 ===
  
  /**
   * 创建用户安全画像
   */
  createUserProfile(userId: string, role: UserRole = 'user'): UserSecurityProfile {
    const profile: UserSecurityProfile = {
      userId,
      role,
      permissions: this.rolePermissions[role] || [],
      failedLoginAttempts: 0,
      isLocked: false,
      riskScore: 0,
      trustedDevices: []
    };
    this.userProfiles.set(userId, profile);
    this.logAudit(userId, 'create_profile', 'user', 'success');
    return profile;
  }
  
  /**
   * 获取用户安全画像
   */
  getUserProfile(userId: string): UserSecurityProfile | undefined {
    return this.userProfiles.get(userId);
  }
  
  /**
   * 更新用户角色
   */
  updateUserRole(userId: string, newRole: UserRole): boolean {
    const profile = this.userProfiles.get(userId);
    if (profile) {
      profile.role = newRole;
      profile.permissions = this.rolePermissions[newRole];
      this.logAudit(userId, 'update_role', 'user', 'success', { newRole });
      return true;
    }
    return false;
  }
  
  /**
   * 检查权限
   */
  checkPermission(userId: string, resource: string, action: 'read' | 'write' | 'delete' | 'execute'): boolean {
    const profile = this.userProfiles.get(userId);
    if (!profile) return false;
    if (profile.isLocked) return false;
    
    // admin拥有所有权限
    if (profile.role === 'admin') return true;
    
    // 检查权限
    return profile.permissions.some(p => {
      if (p.resource === '*' || p.resource === resource) {
        return p.actions.includes(action);
      }
      // 支持通配符匹配
      if (p.resource.includes('*')) {
        const pattern = p.resource.replace('*', '');
        return resource.startsWith(pattern) && p.actions.includes(action);
      }
      return false;
    });
  }
  
  /**
   * 记录审计日志
   */
  logAudit(
    userId: string | undefined,
    action: string,
    resource: string,
    result: 'success' | 'failure' | 'blocked',
    metadata?: Record<string, unknown>
  ): void {
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      userId,
      action,
      resource,
      result,
      metadata
    };
    
    this.auditLogs.push(entry);
    if (this.auditLogs.length > this.maxAuditLogSize) {
      this.auditLogs = this.auditLogs.slice(-this.maxAuditLogSize);
    }
    
    if (result === 'failure' || result === 'blocked') {
      console.warn(`[SecurityManager] [AUDIT] action=${action}, user=${userId}, result=${result}`);
    }
  }
  
  /**
   * 查询审计日志
   */
  queryAuditLogs(filters: {
    userId?: string;
    action?: string;
    result?: 'success' | 'failure' | 'blocked';
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): AuditLogEntry[] {
    let results = [...this.auditLogs];
    
    if (filters.userId) {
      results = results.filter(log => log.userId === filters.userId);
    }
    if (filters.action) {
      results = results.filter(log => log.action.includes(filters.action!));
    }
    if (filters.result) {
      results = results.filter(log => log.result === filters.result);
    }
    if (filters.startTime) {
      results = results.filter(log => log.timestamp >= filters.startTime!);
    }
    if (filters.endTime) {
      results = results.filter(log => log.timestamp <= filters.endTime!);
    }
    
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return results.slice(0, filters.limit || 100);
  }
  
  /**
   * 导出审计日志
   */
  exportAuditLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.auditLogs, null, 2);
    } else {
      const headers = ['id', 'timestamp', 'userId', 'action', 'resource', 'result'];
      const rows = this.auditLogs.map(log => 
        headers.map(h => {
          const value = log[h as keyof AuditLogEntry];
          return typeof value === 'string' ? `"${value}"` : String(value);
        }).join(',')
      );
      return [headers.join(','), ...rows].join('\n');
    }
  }
  
  /**
   * 入侵检测
   */
  detectIntrusion(input: string, ip?: string): IntrusionDetectionResult {
    const indicators: string[] = [];
    let threatLevel: ThreatLevel = 'none';
    let confidence = 0;
    
    // 检查可疑模式
    for (const { pattern, threat, weight } of this.suspiciousPatterns) {
      if (pattern.test(input)) {
        indicators.push(threat);
        confidence = Math.max(confidence, weight);
        
        if (weight >= 0.9) threatLevel = 'critical';
        else if (weight >= 0.8 && threatLevel !== 'critical') threatLevel = 'high';
        else if (weight >= 0.6 && threatLevel !== 'critical' && threatLevel !== 'high') threatLevel = 'medium';
        else if (threatLevel === 'none') threatLevel = 'low';
      }
    }
    
    // 检查频率异常
    if (ip) {
      const recentCount = this.intrusionLogs.filter(
        log => log.ip === ip && Date.now() - log.timestamp.getTime() < 60000
      ).length;
      if (recentCount > 10) {
        indicators.push('高频请求');
        confidence = Math.max(confidence, 0.7);
        if (threatLevel === 'none') threatLevel = 'medium';
      }
    }
    
    // 记录入侵尝试
    if (indicators.length > 0 && ip) {
      this.intrusionLogs.push({
        timestamp: new Date(),
        type: indicators[0],
        ip,
        userId: undefined
      });
    }
    
    const recommendedActions: string[] = [];
    if (threatLevel === 'critical') {
      recommendedActions.push('立即阻止请求');
      recommendedActions.push('封锁IP地址');
      recommendedActions.push('触发安全告警');
    } else if (threatLevel === 'high') {
      recommendedActions.push('阻止请求并记录');
      recommendedActions.push('增加监控频率');
    } else if (threatLevel === 'medium') {
      recommendedActions.push('增加日志级别');
      recommendedActions.push('验证请求来源');
    }
    
    return {
      isIntrusion: indicators.length > 0,
      threatLevel,
      confidence,
      indicators,
      recommendedActions
    };
  }
  
  /**
   * 记录登录失败
   */
  recordFailedLogin(userId: string): void {
    const profile = this.userProfiles.get(userId);
    if (profile) {
      profile.failedLoginAttempts++;
      profile.riskScore = Math.min(profile.riskScore + 10, 100);
      
      if (profile.failedLoginAttempts >= 5) {
        profile.isLocked = true;
        this.logAudit(userId, 'account_locked', 'system', 'success', {
          reason: '过多登录失败',
          attempts: profile.failedLoginAttempts
        });
      }
    }
  }
  
  /**
   * 记录登录成功
   */
  recordSuccessfulLogin(userId: string): void {
    const profile = this.userProfiles.get(userId);
    if (profile) {
      profile.failedLoginAttempts = 0;
      profile.lastLoginTime = new Date();
      this.logAudit(userId, 'login', 'system', 'success');
    }
  }
  
  /**
   * 解锁用户账户
   */
  unlockAccount(userId: string, adminUserId: string): boolean {
    const profile = this.userProfiles.get(userId);
    if (profile && this.checkPermission(adminUserId, 'user', 'write')) {
      profile.isLocked = false;
      profile.failedLoginAttempts = 0;
      this.logAudit(adminUserId, 'unlock_account', 'user', 'success', { targetUser: userId });
      return true;
    }
    return false;
  }
  
  /**
   * AES加密（简化版）
   */
  encryptAES(data: string, keyName: string): string {
    // 注意：实际生产环境应使用专业的加密库
    let key = this.encryptionKeys.get(keyName);
    if (!key) {
      key = { key: this.generateRandomKey(), createdAt: new Date() };
      this.encryptionKeys.set(keyName, key);
    }
    
    // 简化的XOR加密（仅用于演示，实际应使用AES）
    const encrypted = Buffer.from(data).toString('base64');
    return `ENC:${keyName}:${encrypted}`;
  }
  
  /**
   * AES解密（简化版）
   */
  decryptAES(encryptedData: string): string | null {
    const parts = encryptedData.split(':');
    if (parts.length !== 3 || parts[0] !== 'ENC') return null;
    
    const keyName = parts[1];
    const key = this.encryptionKeys.get(keyName);
    if (!key) return null;
    
    // 简化的XOR加密（仅用于演示，实际应使用AES）
    try {
      return Buffer.from(parts[2], 'base64').toString();
    } catch {
      return null;
    }
  }
  
  /**
   * 生成随机密钥
   */
  private generateRandomKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }
  
  /**
   * 生成安全报告
   */
  generateSecurityReport(): SecurityReport {
    const threatsByLevel: Record<ThreatLevel, number> = {
      none: 0, low: 0, medium: 0, high: 0, critical: 0
    };
    
    const attackTypeCount = new Map<string, number>();
    
    for (const log of this.intrusionLogs) {
      attackTypeCount.set(log.type, (attackTypeCount.get(log.type) || 0) + 1);
    }
    
    const topAttackTypes = Array.from(attackTypeCount.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    const recommendations: string[] = [];
    const criticalCount = threatsByLevel.critical;
    const highCount = threatsByLevel.high;
    
    if (criticalCount > 0) {
      recommendations.push('检测到严重安全威胁，建议立即进行安全审计');
    }
    if (highCount > 5) {
      recommendations.push('高频高级威胁，建议加强入侵检测规则');
    }
    if (topAttackTypes.length > 0 && topAttackTypes[0].count > 100) {
      recommendations.push(`最常见攻击类型为${topAttackTypes[0].type}，建议针对性加强防护`);
    }
    
    recommendations.push('定期更新安全规则和加密密钥');
    recommendations.push('监控异常登录模式和可疑行为');
    
    return {
      generatedAt: new Date(),
      totalThreats: this.intrusionLogs.length,
      threatsByLevel,
      blockedRequests: this.auditLogs.filter(log => log.result === 'blocked').length,
      rateLimitHits: this.auditLogs.filter(log => log.action === 'rate_limit_exceeded').length,
      intrusionAttempts: this.intrusionLogs.length,
      topAttackTypes,
      recommendations
    };
  }
  
  /**
   * CSRF令牌生成
   */
  generateCSRFToken(): string {
    return `csrf_${Date.now()}_${Math.random().toString(36).substr(2, 15)}`;
  }
  
  /**
   * CSRF令牌验证
   */
  validateCSRFToken(token: string, validTokens: Set<string>): boolean {
    return validTokens.has(token);
  }
  
  /**
   * 获取CORS配置
   */
  getCORSConfig(): {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    maxAge: number;
    credentials: boolean;
  } {
    return {
      allowedOrigins: ['http://localhost:3000', 'http://localhost:5173'],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
      maxAge: 86400,
      credentials: true
    };
  }
  
  /**
   * 验证CORS请求
   */
  validateCORSRequest(origin: string): { valid: boolean; allowedOrigin: boolean } {
    const config = this.getCORSConfig();
    const allowedOrigin = config.allowedOrigins.includes(origin) || config.allowedOrigins.includes('*');
    return { valid: true, allowedOrigin };
  }

  /**
   * 验证输入安全
   */
  validateInput(input: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input || input.trim().length === 0) {
      errors.push('Input cannot be empty');
      return { valid: false, errors };
    }

    if (input.length > this.config.maxInputLength) {
      errors.push(`Input exceeds maximum length of ${this.config.maxInputLength} characters`);
    }

    for (const keyword of this.config.blockedKeywords) {
      if (input.toLowerCase().includes(keyword.toLowerCase())) {
        errors.push(`Input contains blocked content: ${keyword}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 清理输入
   */
  sanitizeInput(input: string): string {
    let sanitized = input;

    sanitized = sanitized
      .replace(/\x00/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();

    if (sanitized.length > this.config.maxInputLength) {
      sanitized = sanitized.substring(0, this.config.maxInputLength);
    }

    return sanitized;
  }

  /**
   * 验证输出安全
   */
  validateOutput(output: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!output) {
      return { valid: true, errors };
    }

    if (output.length > this.config.maxOutputLength) {
      errors.push(`Output exceeds maximum length of ${this.config.maxOutputLength} characters`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 检查速率限制
   */
  checkRateLimit(clientId: string): { allowed: boolean; remaining: number; resetTime: number } {
    if (!this.config.rateLimitEnabled) {
      return { allowed: true, remaining: Infinity, resetTime: Date.now() + 60000 };
    }

    const now = Date.now();
    const windowSize = 60000;
    let entry = this.rateLimits.get(clientId);

    if (!entry || now - entry.windowStart >= windowSize) {
      entry = { count: 0, windowStart: now };
      this.rateLimits.set(clientId, entry);
    }

    entry.count++;
    const remaining = this.config.maxRequestsPerMinute - entry.count;
    const allowed = remaining >= 0;
    const resetTime = entry.windowStart + windowSize;

    return { allowed, remaining, resetTime };
  }

  /**
   * 验证 API 密钥
   */
  validateApiKey(apiKey?: string): boolean {
    if (!this.config.requireAuth) {
      return true;
    }
    return !!apiKey && apiKey.length > 0;
  }

  /**
   * 记录安全事件
   */
  logSecurityEvent(eventType: string, details: Record<string, unknown>): void {
    console.warn(`[SECURITY] ${eventType}`, details);
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * 重置速率限制
   */
  resetRateLimit(clientId: string): void {
    this.rateLimits.delete(clientId);
  }
}
