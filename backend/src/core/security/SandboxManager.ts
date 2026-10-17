import { v4 as uuidv4 } from 'uuid';
import { execSync, spawn } from 'child_process';

const LOG_PREFIX = '[SandboxManager]';

// === 沙箱相关类型 ===
export type SandboxLanguage = 'python' | 'javascript' | 'typescript';

export interface SandboxConfig {
  maxExecutionTimeMs: number;
  maxMemoryMB: number;
  maxCpuPercent: number;
  allowedLanguages: SandboxLanguage[];
  networkEnabled: boolean;
  fileSystemEnabled: boolean;
  maxOutputSizeBytes: number;
  environment: 'docker' | 'subprocess' | 'disabled';
}

export interface SandboxExecutionRequest {
  language: SandboxLanguage;
  code: string;
  timeout?: number;
  stdin?: string;
  environment?: Record<string, string>;
}

export interface SandboxExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  peakMemoryMB?: number;
  truncated: boolean;
  error?: string;
}

export interface SandboxAuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  language: SandboxLanguage;
  codeHash: string;
  codeLength: number;
  executionTimeMs: number;
  success: boolean;
  error?: string;
  blocked: boolean;
  blockReason?: string;
}

const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  maxExecutionTimeMs: 30000,     // 30秒
  maxMemoryMB: 512,
  maxCpuPercent: 50,
  allowedLanguages: ['python', 'javascript'],
  networkEnabled: false,
  fileSystemEnabled: false,
  maxOutputSizeBytes: 1024 * 1024, // 1MB
  environment: 'subprocess'
};

// 危险代码模式
const DANGEROUS_PATTERNS: Record<SandboxLanguage, RegExp[]> = {
  python: [
    // [\s\S]*? 而非 .*：代码里的 import 与调用常常分处不同行，'.' 不匹配换行会导致漏检
    /import\s+os\b[\s\S]*?\bsystem\b/i,
    /import\s+subprocess\b/i,
    /import\s+shutil\b/i,
    /__import__\s*\(\s*['"]os['"]\s*\)/i,
    /eval\s*\(/i,
    /exec\s*\(/i,
    /open\s*\([^)]*['"]w/i,       // 写入文件
    /os\.remove\b|os\.unlink\b|os\.rmdir\b/i,
    /shutil\.rmtree\b/i,
    /socket\./i,
    /urllib\./i,
    /requests\.(?:post|put|delete)\b/i,
    /ctypes\./i,
    /\bexit\s*\(/i,
    /\bquit\s*\(/i,
    /while\s+True\s*:/i,          // 潜在无限循环
    /multiprocessing\b/i,
    /threading\.Thread\b/i,
  ],
  javascript: [
    /require\s*\(\s*['"]child_process['"]\s*\)/i,
    /require\s*\(\s*['"]fs['"]\s*\)/i,
    /require\s*\(\s*['"]net['"]\s*\)/i,
    /require\s*\(\s*['"]http['"]\s*\)/i,
    /require\s*\(\s*['"]https['"]\s*\)/i,
    /require\s*\(\s*['"]os['"]\s*\)/i,
    /process\.exit\b/i,
    /process\.kill\b/i,
    /eval\s*\(/i,
    /Function\s*\(/i,
    /setTimeout\s*\(\s*.*\b999999/i, // 超长时间定时器
    /while\s*\(\s*true\s*\)/i,       // 无限循环
    /WebAssembly\./i,
    /constructor\s*\(/i,             // 原型链攻击
  ],
  typescript: [
    /require\s*\(\s*['"]child_process['"]\s*\)/i,
    /require\s*\(\s*['"]fs['"]\s*\)/i,
    /process\.exit\b/i,
    /eval\s*\(/i,
  ]
};

/**
 * 安全沙箱管理器
 * 职责：代码执行隔离、恶意操作拦截、资源限制、操作审计
 */
export class SandboxManager {
  private config: SandboxConfig;
  private auditLog: SandboxAuditEntry[] = [];
  private readonly maxAuditEntries = 10000;

  constructor(config?: Partial<SandboxConfig>) {
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
  }

  /**
   * 在沙箱中执行代码
   */
  async executeCode(
    request: SandboxExecutionRequest,
    userId: string = 'anonymous'
  ): Promise<SandboxExecutionResult> {
    const startTime = Date.now();

    // 1. 输入验证
    const validationError = this.validateRequest(request);
    if (validationError) {
      const result: SandboxExecutionResult = {
        success: false,
        stdout: '',
        stderr: validationError,
        exitCode: -1,
        executionTimeMs: Date.now() - startTime,
        truncated: false,
        error: 'VALIDATION_ERROR'
      };
      this.auditExecution(userId, request, result, true, validationError);
      return result;
    }

    // 2. 安全检查
    const dangerousMatch = this.scanDangerousCode(request.language, request.code);
    if (dangerousMatch) {
      const result: SandboxExecutionResult = {
        success: false,
        stdout: '',
        stderr: `代码包含危险操作: ${dangerousMatch}`,
        exitCode: -1,
        executionTimeMs: Date.now() - startTime,
        truncated: false,
        error: 'SECURITY_BLOCKED'
      };
      this.auditExecution(userId, request, result, true, dangerousMatch);
      return result;
    }

    // 3. 资源限制检查
    if (request.code.length > 10000) {
      const result: SandboxExecutionResult = {
        success: false,
        stdout: '',
        stderr: `代码长度 ${request.code.length} 超过限制 10000`,
        exitCode: -1,
        executionTimeMs: Date.now() - startTime,
        truncated: false,
        error: 'SIZE_LIMIT_EXCEEDED'
      };
      this.auditExecution(userId, request, result, true, 'CODE_SIZE_EXCEEDED');
      return result;
    }

    // 4. 在隔离环境执行
    const result = await this.executeInIsolation(request);
    result.executionTimeMs = Date.now() - startTime;

    // 5. 审计记录
    this.auditExecution(userId, request, result, false);

    return result;
  }

  /**
   * 验证执行请求
   */
  private validateRequest(request: SandboxExecutionRequest): string | null {
    if (!request.code || typeof request.code !== 'string') {
      return '代码不能为空';
    }
    if (!this.config.allowedLanguages.includes(request.language)) {
      return `不支持的语言: ${request.language}`;
    }
    if (request.timeout && request.timeout > this.config.maxExecutionTimeMs) {
      return `超时时间 ${request.timeout}ms 超过限制 ${this.config.maxExecutionTimeMs}ms`;
    }
    return null;
  }

  /**
   * 扫描危险代码模式
   */
  private scanDangerousCode(language: SandboxLanguage, code: string): string | null {
    const patterns = DANGEROUS_PATTERNS[language] || [];
    for (const pattern of patterns) {
      const match = code.match(pattern);
      if (match) {
        console.warn(`${LOG_PREFIX} [DANGEROUS_PATTERN] lang=${language}, pattern=${pattern.source}, match=${match[0]}`);
        return `禁止的操作: ${match[0]}`;
      }
    }

    // 额外检查：代码中不能包含URL（防止数据外泄）
    if (!this.config.networkEnabled) {
      const urlPattern = /https?:\/\/[^\s"']+/gi;
      const urls = code.match(urlPattern);
      if (urls) {
        return `网络访问被禁用，代码中包含URL: ${urls[0]}`;
      }
    }

    return null;
  }

  /**
   * 在隔离环境中执行
   */
  private async executeInIsolation(
    request: SandboxExecutionRequest
  ): Promise<SandboxExecutionResult> {
    const timeout = Math.min(
      request.timeout || this.config.maxExecutionTimeMs,
      this.config.maxExecutionTimeMs
    );

    try {
      if (this.config.environment === 'subprocess') {
        return await this.executeInSubprocess(request, timeout);
      } else if (this.config.environment === 'docker') {
        return await this.executeInDocker(request, timeout);
      } else {
        return {
          success: false,
          stdout: '',
          stderr: '沙箱环境未启用',
          exitCode: -1,
          executionTimeMs: 0,
          truncated: false,
          error: 'SANDBOX_DISABLED'
        };
      }
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: -1,
        executionTimeMs: 0,
        truncated: false,
        error: 'EXECUTION_ERROR'
      };
    }
  }

  /**
   * 子进程隔离执行
   */
  private async executeInSubprocess(
    request: SandboxExecutionRequest,
    timeoutMs: number
  ): Promise<SandboxExecutionResult> {
    return new Promise((resolve) => {
      const isPython = request.language === 'python';
      const command = isPython ? 'python' : 'node';
      const args = isPython
        ? ['-c', request.code]
        : ['--permission', '-e', request.code];

      const child = spawn(command, args, {
        timeout: timeoutMs,
        // 关键：不继承 process.env，防止 DEEPSEEK_API_KEY / JWT_SECRET 等泄露
        env: {
          NODE_ENV: 'production',
          PATH: process.env.PATH || '/usr/bin:/bin:/usr/local/bin',
          HOME: '/tmp/sandbox',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false, // 杜绝 shell 注入
      });

      let stdout = '';
      let stderr = '';
      const maxSize = this.config.maxOutputSizeBytes;

      child.stdout.on('data', (d: Buffer) => {
        stdout += d.toString();
        if (stdout.length > maxSize) {
          child.kill('SIGKILL'); // 输出超标用 SIGKILL，不可捕获
        }
      });
      child.stderr.on('data', (d: Buffer) => {
        stderr += d.toString();
      });

      child.on('error', (err) => {
        resolve({
          success: false,
          stdout: '',
          stderr: err.message,
          exitCode: -1,
          executionTimeMs: 0,
          truncated: false,
          error: 'SPAWN_ERROR',
        });
      });

      const timer = setTimeout(() => {
        child.kill('SIGKILL'); // SIGKILL 不可捕获，恶意代码无法赖着不走
      }, timeoutMs);

      child.on('close', (code, signal) => {
        clearTimeout(timer);
        const killed = signal === 'SIGKILL';
        let truncated = false;
        if (stdout.length > maxSize) {
          stdout = stdout.substring(0, maxSize) + '\n[输出已截断]';
          truncated = true;
        }
        resolve({
          success: !killed && code === 0,
          stdout,
          stderr,
          exitCode: code ?? (killed ? -1 : 0),
          executionTimeMs: 0,
          truncated,
          error: killed ? 'TIMEOUT' : undefined,
        });
      });
    });
  }

  /**
   * Docker 容器隔离执行（接口预留）
   */
  private async executeInDocker(
    request: SandboxExecutionRequest,
    timeoutMs: number
  ): Promise<SandboxExecutionResult> {
    const image = request.language === 'python' ? 'python:3.11-slim' : 'node:18-slim';
    const execCommand = request.language === 'python'
      ? `python -c ${JSON.stringify(request.code)}`
      : `node -e ${JSON.stringify(request.code)}`;

    try {
      const output = execSync(
        `docker run --rm --network=none --memory=${this.config.maxMemoryMB}m ` +
        `--cpus=0.5 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64M ` +
        `--timeout ${Math.floor(timeoutMs / 1000)} ` +
        `${image} ${execCommand}`,
        {
          timeout: timeoutMs + 5000, // 额外5秒给docker操作
          maxBuffer: this.config.maxOutputSizeBytes,
          encoding: 'utf-8'
        }
      );

      let stdout = output.toString();
      let truncated = false;
      if (stdout.length > this.config.maxOutputSizeBytes) {
        stdout = stdout.substring(0, this.config.maxOutputSizeBytes) + '\n[输出已截断]';
        truncated = true;
      }

      return {
        success: true,
        stdout,
        stderr: '',
        exitCode: 0,
        executionTimeMs: 0,
        truncated
      };
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: -1,
        executionTimeMs: 0,
        truncated: false,
        error: 'DOCKER_EXECUTION_ERROR'
      };
    }
  }

  /**
   * 操作审计记录
   */
  private auditExecution(
    userId: string,
    request: SandboxExecutionRequest,
    result: SandboxExecutionResult,
    blocked: boolean,
    blockReason?: string
  ): void {
    const entry: SandboxAuditEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      userId,
      language: request.language,
      codeHash: this.hashCode(request.code),
      codeLength: request.code.length,
      executionTimeMs: result.executionTimeMs,
      success: result.success,
      error: result.error,
      blocked,
      blockReason
    };

    this.auditLog.push(entry);

    // 控制日志大小
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-this.maxAuditEntries);
    }

    console.log(`${LOG_PREFIX} [AUDIT] id=${entry.id}, user=${userId}, lang=${request.language}, blocked=${blocked}, time=${result.executionTimeMs}ms`);
  }

  /**
   * 简单哈希（用于审计而不存储源代码）
   */
  private hashCode(code: string): string {
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      const chr = code.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return hash.toString(16);
  }

  // ==================== 查询接口 ====================

  getAuditLog(options?: {
    userId?: string;
    blocked?: boolean;
    limit?: number;
  }): SandboxAuditEntry[] {
    let filtered = [...this.auditLog];
    if (options?.userId) {
      filtered = filtered.filter(e => e.userId === options.userId);
    }
    if (options?.blocked !== undefined) {
      filtered = filtered.filter(e => e.blocked === options.blocked);
    }
    return filtered.slice(-(options?.limit || 100));
  }

  getConfig(): SandboxConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log(`${LOG_PREFIX} [CONFIG_UPDATED]`, updates);
  }

  getStats() {
    const total = this.auditLog.length;
    const blocked = this.auditLog.filter(e => e.blocked).length;
    const successful = this.auditLog.filter(e => e.success && !e.blocked).length;
    const avgTime = total > 0
      ? this.auditLog.reduce((s, e) => s + e.executionTimeMs, 0) / total
      : 0;

    const byLanguage: Record<string, number> = {};
    for (const entry of this.auditLog) {
      byLanguage[entry.language] = (byLanguage[entry.language] || 0) + 1;
    }

    return {
      totalExecutions: total,
      blockedExecutions: blocked,
      blockRate: total > 0 ? Math.round((blocked / total) * 100) : 0,
      successfulExecutions: successful,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      averageExecutionTimeMs: Math.round(avgTime),
      byLanguage,
      config: this.config
    };
  }
}
