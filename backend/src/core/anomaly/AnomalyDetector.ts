/**
 * 异常检测模块 (Anomaly Detector)
 *
 * 提供多种轻量级异常检测：
 *  - 输入长度异常（突然超长/超短）
 *  - 频率异常（短时间内大量请求）
 *  - 情感/语义异常（与历史基线偏离）
 *  - 工具调用异常（错误率突增、参数异常）
 *  - 自定义规则（关键词、正则）
 *
 * 检测结果可联动 Security / Audit / Notification 模块。
 */

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
export type AnomalyType =
  | 'input_length'
  | 'frequency'
  | 'sentiment'
  | 'tool_error_rate'
  | 'tool_param'
  | 'keyword'
  | 'pattern'
  | 'custom';

export interface AnomalyEvent {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  userId: string;
  score: number;             // 0-1 异常分数
  description: string;
  evidence: Record<string, unknown>;
  detectedAt: Date;
  acknowledged: boolean;
}

export interface AnomalyStats {
  totalDetected: number;
  unacknowledged: number;
  bySeverity: Record<AnomalySeverity, number>;
  byType: Record<string, number>;
  lastHour: number;
}

interface UserBaseline {
  userId: string;
  inputLengthAvg: number;
  inputLengthStd: number;
  requestCount: number;
  firstSeen: Date;
  lastSeen: Date;
  requestTimestamps: number[];   // 用于频率分析
  toolErrors: Map<string, number>;
  toolCalls: Map<string, number>;
  sentimentAvg: number;
  sentimentStd: number;
}

export default class AnomalyDetector {
  private events: AnomalyEvent[] = [];
  private baselines: Map<string, UserBaseline> = new Map();
  private blockedKeywords: string[] = [];
  private suspiciousPatterns: RegExp[] = [];

  // 配置阈值
  private readonly LENGTH_ZSCORE = 3;
  private readonly FREQUENCY_WINDOW = 60 * 1000;       // 1min
  private readonly FREQUENCY_THRESHOLD = 30;            // 每分钟最多 30 次
  private readonly SENTIMENT_ZSCORE = 2.5;
  private readonly TOOL_ERROR_RATE = 0.5;
  private readonly MAX_EVENTS = 5000;

  constructor() {
    this.loadDefaultRules();
  }

  private loadDefaultRules(): void {
    this.blockedKeywords = [
      'rm -rf', 'format c:', 'drop table', 'delete from',
      '忽略之前的指令', 'ignore previous', 'system prompt',
    ];
    this.suspiciousPatterns = [
      /(\.\.\/){3,}/g,                                  // 路径穿越
      /(\<script|\<iframe|javascript:)/gi,               // XSS
      /(union\s+select|or\s+1=1|--$)/gi,                // SQL 注入
    ];
  }

  addBlockedKeyword(kw: string): void { this.blockedKeywords.push(kw); }
  addSuspiciousPattern(re: RegExp): void { this.suspiciousPatterns.push(re); }

  // ============== 检测入口 ==============

  /**
   * 检查用户输入。
   *  - 维护基线
   *  - 检查长度异常
   *  - 检查关键词/正则
   *  - 检查频率异常
   */
  checkInput(userId: string, input: string): AnomalyEvent[] {
    const out: AnomalyEvent[] = [];
    const baseline = this.ensureBaseline(userId);
    baseline.requestTimestamps.push(Date.now());
    baseline.requestCount += 1;
    baseline.lastSeen = new Date();
    // 截断时间戳列表
    if (baseline.requestTimestamps.length > 200) {
      baseline.requestTimestamps = baseline.requestTimestamps.slice(-200);
    }

    // 1) 关键词
    const lc = input.toLowerCase();
    for (const kw of this.blockedKeywords) {
      if (lc.includes(kw.toLowerCase())) {
        out.push(this.createEvent('keyword', 'critical', userId, 1, `触发禁用关键词: ${kw}`, { keyword: kw }));
      }
    }
    // 2) 正则
    for (const re of this.suspiciousPatterns) {
      re.lastIndex = 0;
      if (re.test(input)) {
        out.push(this.createEvent('pattern', 'high', userId, 0.9, `可疑模式: ${re.source}`, { pattern: re.source }));
      }
    }
    // 3) 长度异常 (Z-Score)
    const len = input.length;
    if (baseline.inputLengthStd > 0 && baseline.requestCount > 5) {
      const z = Math.abs((len - baseline.inputLengthAvg) / baseline.inputLengthStd);
      if (z > this.LENGTH_ZSCORE) {
        out.push(this.createEvent('input_length', 'medium', userId, Math.min(1, z / 6),
          `输入长度异常 (z=${z.toFixed(2)}, len=${len})`,
          { length: len, zscore: z }));
      }
    }
    // 更新基线（指数移动平均）
    const alpha = 0.1;
    baseline.inputLengthAvg = baseline.inputLengthAvg * (1 - alpha) + len * alpha;
    const diff = len - baseline.inputLengthAvg;
    baseline.inputLengthStd = Math.sqrt(
      Math.max(0, baseline.inputLengthStd * baseline.inputLengthStd * (1 - alpha) + diff * diff * alpha)
    );

    // 4) 频率异常
    const now = Date.now();
    const recent = baseline.requestTimestamps.filter((t) => now - t < this.FREQUENCY_WINDOW).length;
    if (recent > this.FREQUENCY_THRESHOLD) {
      out.push(this.createEvent('frequency', 'high', userId, Math.min(1, recent / this.FREQUENCY_THRESHOLD),
        `请求频率异常: ${recent} 次/${this.FREQUENCY_WINDOW / 1000}s`,
        { count: recent, windowMs: this.FREQUENCY_WINDOW }));
    }

    return this.appendAndReturn(out);
  }

  /** 记录工具调用结果，检查工具异常 */
  recordToolCall(userId: string, toolName: string, success: boolean, paramSnapshot?: Record<string, unknown>): AnomalyEvent[] {
    const baseline = this.ensureBaseline(userId);
    baseline.toolCalls.set(toolName, (baseline.toolCalls.get(toolName) ?? 0) + 1);
    if (!success) baseline.toolErrors.set(toolName, (baseline.toolErrors.get(toolName) ?? 0) + 1);
    const out: AnomalyEvent[] = [];

    // 工具错误率
    const total = baseline.toolCalls.get(toolName) ?? 0;
    const errs = baseline.toolErrors.get(toolName) ?? 0;
    if (total >= 5) {
      const rate = errs / total;
      if (rate > this.TOOL_ERROR_RATE) {
        out.push(this.createEvent('tool_error_rate', 'medium', userId, rate,
          `工具 ${toolName} 错误率 ${(rate * 100).toFixed(1)}%`,
          { tool: toolName, errors: errs, total, rate }));
      }
    }
    return this.appendAndReturn(out);
  }

  /** 记录用户情感分数 */
  recordSentiment(userId: string, score: number): AnomalyEvent[] {
    const baseline = this.ensureBaseline(userId);
    const out: AnomalyEvent[] = [];
    if (baseline.requestCount > 5 && baseline.sentimentStd > 0) {
      const z = Math.abs((score - baseline.sentimentAvg) / baseline.sentimentStd);
      if (z > this.SENTIMENT_ZSCORE && (score < 0.2 || score > 0.95)) {
        out.push(this.createEvent('sentiment', score < 0.2 ? 'high' : 'low', userId, Math.min(1, z / 4),
          `情感异常 (z=${z.toFixed(2)}, score=${score})`,
          { score, zscore: z }));
      }
    }
    const alpha = 0.1;
    baseline.sentimentAvg = baseline.sentimentAvg * (1 - alpha) + score * alpha;
    const diff = score - baseline.sentimentAvg;
    baseline.sentimentStd = Math.sqrt(
      Math.max(0, baseline.sentimentStd * baseline.sentimentStd * (1 - alpha) + diff * diff * alpha)
    );
    return this.appendAndReturn(out);
  }

  /** 手动上报事件（供其他模块联动） */
  reportCustom(userId: string, severity: AnomalySeverity, description: string, evidence: Record<string, unknown> = {}, score: number = 0.5): AnomalyEvent {
    const ev = this.createEvent('custom', severity, userId, score, description, evidence);
    this.appendEvent(ev);
    return ev;
  }

  // ============== 查询 ==============
  listEvents(opts?: { userId?: string; severity?: AnomalySeverity; acknowledged?: boolean; limit?: number }): AnomalyEvent[] {
    let r = this.events;
    if (opts?.userId) r = r.filter((e) => e.userId === opts.userId);
    if (opts?.severity) r = r.filter((e) => e.severity === opts.severity);
    if (opts?.acknowledged !== undefined) r = r.filter((e) => e.acknowledged === opts.acknowledged);
    return r.slice(-1 * (opts?.limit ?? 100)).reverse();
  }

  acknowledge(eventId: string): boolean {
    const ev = this.events.find((e) => e.id === eventId);
    if (ev) { ev.acknowledged = true; return true; }
    return false;
  }

  // ============== 内部 ==============
  private ensureBaseline(userId: string): UserBaseline {
    let b = this.baselines.get(userId);
    if (!b) {
      b = {
        userId,
        inputLengthAvg: 0,
        inputLengthStd: 0,
        requestCount: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
        requestTimestamps: [],
        toolErrors: new Map(),
        toolCalls: new Map(),
        sentimentAvg: 0.5,
        sentimentStd: 0.1,
      };
      this.baselines.set(userId, b);
    }
    return b;
  }

  private createEvent(
    type: AnomalyType,
    severity: AnomalySeverity,
    userId: string,
    score: number,
    description: string,
    evidence: Record<string, unknown>
  ): AnomalyEvent {
    return {
      id: `anomaly_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type, severity, userId, score, description, evidence,
      detectedAt: new Date(),
      acknowledged: false,
    };
  }

  private appendEvent(ev: AnomalyEvent): void {
    this.events.push(ev);
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }
  }

  private appendAndReturn(arr: AnomalyEvent[]): AnomalyEvent[] {
    for (const ev of arr) this.appendEvent(ev);
    return arr;
  }

  getStats(): AnomalyStats {
    const bySeverity: Record<AnomalySeverity, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const byType: Record<string, number> = {};
    let lastHour = 0;
    let unack = 0;
    const now = Date.now();
    for (const e of this.events) {
      bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
      byType[e.type] = (byType[e.type] ?? 0) + 1;
      if (!e.acknowledged) unack++;
      if (now - e.detectedAt.getTime() < 3600 * 1000) lastHour++;
    }
    return {
      totalDetected: this.events.length,
      unacknowledged: unack,
      bySeverity,
      byType,
      lastHour,
    };
  }
}
