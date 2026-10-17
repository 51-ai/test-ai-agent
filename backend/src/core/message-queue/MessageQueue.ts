/**
 * 消息队列 - 发布订阅/消息生产消费/消息路由
 */

import { v4 as uuidv4 } from 'uuid';

export type QueueType = 'fifo' | 'priority' | 'delayed' | 'dead_letter' | 'topic';
export type MessageStatus = 'pending' | 'delivered' | 'processing' | 'acknowledged' | 'failed' | 'expired' | 'dlq';
export type DeliveryMode = 'at_most_once' | 'at_least_once' | 'exactly_once';

export interface Message {
  id: string;
  topic: string;
  payload: unknown;
  headers?: Record<string, string>;
  priority: number;
  delayMs?: number;
  ttlMs?: number;
  attempts: number;
  maxAttempts: number;
  status: MessageStatus;
  createdAt: Date;
  scheduledAt?: Date;
  deliveredAt?: Date;
  acknowledgedAt?: Date;
  expiresAt?: Date;
  error?: string;
  consumerId?: string;
  metadata?: Record<string, unknown>;
}

export interface Topic {
  id: string;
  name: string;
  type: QueueType;
  config: {
    maxSize: number;
    maxRetries: number;
    deliveryMode: DeliveryMode;
    enableDLQ: boolean;
    ttlMs?: number;
  };
  subscribers: Map<string, { id: string; filter?: (msg: Message) => boolean; callback: (msg: Message) => Promise<void> | void }>;
  createdAt: Date;
  messageCount: number;
  totalPublished: number;
  totalConsumed: number;
  totalFailed: number;
}

export interface MessageQueueStats {
  totalTopics: number;
  totalMessages: number;
  delivered: number;
  failed: number;
  inFlight: number;
  averageLatency: number;
  byStatus: Record<MessageStatus, number>;
  topTopics: Array<{ topic: string; published: number; consumed: number; failed: number }>;
}

export class MessageQueue {
  private topics: Map<string, Topic> = new Map();
  private messages: Map<string, Message> = new Map();
  private consumerMetrics: Map<string, { processed: number; failed: number; latency: number }> = new Map();
  private stats: MessageQueueStats = {
    totalTopics: 0,
    totalMessages: 0,
    delivered: 0,
    failed: 0,
    inFlight: 0,
    averageLatency: 0,
    byStatus: { pending: 0, delivered: 0, processing: 0, acknowledged: 0, failed: 0, expired: 0, dlq: 0 },
    topTopics: []
  };
  private totalLatency = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    this.startProcessor();
  }

  private startProcessor(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.processScheduledMessages(), 100);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  createTopic(name: string, type: QueueType = 'fifo', config?: Partial<Topic['config']>): string {
    const id = uuidv4();
    this.topics.set(name, {
      id,
      name,
      type,
      config: {
        maxSize: 10000,
        maxRetries: 3,
        deliveryMode: 'at_least_once',
        enableDLQ: true,
        ttlMs: 24 * 60 * 60 * 1000,
        ...config
      },
      subscribers: new Map(),
      createdAt: new Date(),
      messageCount: 0,
      totalPublished: 0,
      totalConsumed: 0,
      totalFailed: 0
    });
    this.stats.totalTopics++;
    return id;
  }

  publish(topicName: string, payload: unknown, options: { priority?: number; delayMs?: number; ttlMs?: number; headers?: Record<string, string> } = {}): string {
    const topic = this.topics.get(topicName);
    if (!topic) throw new Error(`Topic ${topicName} not found`);

    if (topic.messageCount >= topic.config.maxSize) {
      throw new Error(`Topic ${topicName} is full`);
    }

    const id = uuidv4();
    const now = new Date();
    const ttlMs = options.ttlMs || topic.config.ttlMs || 86400000;
    const message: Message = {
      id,
      topic: topicName,
      payload,
      headers: options.headers,
      priority: options.priority || 5,
      delayMs: options.delayMs,
      ttlMs,
      attempts: 0,
      maxAttempts: topic.config.maxRetries,
      status: options.delayMs ? 'pending' : 'pending',
      createdAt: now,
      scheduledAt: options.delayMs ? new Date(now.getTime() + options.delayMs) : undefined,
      expiresAt: new Date(now.getTime() + ttlMs)
    };
    this.messages.set(id, message);
    topic.messageCount++;
    topic.totalPublished++;
    this.stats.totalMessages++;
    this.stats.byStatus[message.status]++;
    return id;
  }

  subscribe(topicName: string, consumerId: string, callback: (msg: Message) => Promise<void> | void, filter?: (msg: Message) => boolean): boolean {
    const topic = this.topics.get(topicName);
    if (!topic) return false;
    topic.subscribers.set(consumerId, { id: consumerId, filter, callback });
    if (!this.consumerMetrics.has(consumerId)) {
      this.consumerMetrics.set(consumerId, { processed: 0, failed: 0, latency: 0 });
    }
    return true;
  }

  unsubscribe(topicName: string, consumerId: string): boolean {
    const topic = this.topics.get(topicName);
    if (!topic) return false;
    return topic.subscribers.delete(consumerId);
  }

  private processScheduledMessages(): void {
    const now = Date.now();
    for (const message of this.messages.values()) {
      if (message.status !== 'pending') continue;
      if (message.scheduledAt && message.scheduledAt.getTime() > now) continue;
      if (message.expiresAt && message.expiresAt.getTime() < now) {
        message.status = 'expired';
        this.stats.byStatus.pending--;
        this.stats.byStatus.expired++;
        continue;
      }
      this.deliverMessage(message);
    }
  }

  private async deliverMessage(message: Message): Promise<void> {
    const topic = this.topics.get(message.topic);
    if (!topic) return;
    const subscribers = Array.from(topic.subscribers.values());
    if (subscribers.length === 0) return;
    message.status = 'delivered';
    message.deliveredAt = new Date();
    this.stats.byStatus.pending--;
    this.stats.byStatus.delivered++;

    for (const sub of subscribers) {
      if (sub.filter && !sub.filter(message)) continue;
      try {
        message.status = 'processing';
        this.stats.byStatus.delivered--;
        this.stats.byStatus.processing++;
        this.stats.inFlight++;
        const start = Date.now();
        await sub.callback(message);
        const latency = Date.now() - start;
        message.status = 'acknowledged';
        message.acknowledgedAt = new Date();
        message.consumerId = sub.id;
        this.stats.byStatus.processing--;
        this.stats.byStatus.acknowledged++;
        this.stats.inFlight--;
        this.stats.delivered++;
        topic.totalConsumed++;
        const m = this.consumerMetrics.get(sub.id);
        if (m) {
          m.processed++;
          m.latency += latency;
          this.totalLatency += latency;
        }
        this.stats.averageLatency = this.consumerMetrics.size > 0
          ? this.totalLatency / Array.from(this.consumerMetrics.values()).reduce((a, b) => a + b.processed, 0)
          : 0;
      } catch (err) {
        message.attempts++;
        message.error = err instanceof Error ? err.message : String(err);
        this.stats.byStatus.processing--;
        this.stats.inFlight--;
        if (message.attempts < message.maxAttempts) {
          message.status = 'pending';
          this.stats.byStatus.pending++;
        } else {
          message.status = topic.config.enableDLQ ? 'dlq' : 'failed';
          this.stats.byStatus[message.status]++;
          topic.totalFailed++;
          this.stats.failed++;
        }
      }
    }
  }

  acknowledge(messageId: string): boolean {
    const message = this.messages.get(messageId);
    if (!message) return false;
    if (message.status === 'delivered' || message.status === 'processing') {
      this.stats.byStatus[message.status]--;
      message.status = 'acknowledged';
      message.acknowledgedAt = new Date();
      this.stats.byStatus.acknowledged++;
      this.stats.delivered++;
      return true;
    }
    return false;
  }

  reject(messageId: string, requeue: boolean = false): boolean {
    const message = this.messages.get(messageId);
    if (!message) return false;
    if (requeue) {
      message.status = 'pending';
      message.attempts++;
    } else {
      message.status = this.topics.get(message.topic)?.config.enableDLQ ? 'dlq' : 'failed';
    }
    return true;
  }

  getMessage(messageId: string): Message | undefined {
    return this.messages.get(messageId);
  }

  getTopic(name: string): Topic | undefined {
    return this.topics.get(name);
  }

  listTopics(): Topic[] {
    return Array.from(this.topics.values());
  }

  listMessages(topicName?: string, status?: MessageStatus, limit: number = 100): Message[] {
    let all = Array.from(this.messages.values());
    if (topicName) all = all.filter(m => m.topic === topicName);
    if (status) all = all.filter(m => m.status === status);
    return all.slice(-limit);
  }

  getStats(): MessageQueueStats {
    const topicStats = new Map<string, { published: number; consumed: number; failed: number }>();
    for (const t of this.topics.values()) {
      topicStats.set(t.name, { published: t.totalPublished, consumed: t.totalConsumed, failed: t.totalFailed });
    }
    this.stats.topTopics = Array.from(topicStats.entries())
      .map(([topic, s]) => ({ topic, ...s }))
      .sort((a, b) => b.published - a.published)
      .slice(0, 10);
    return { ...this.stats };
  }

  purgeTopic(name: string): number {
    const ids = Array.from(this.messages.entries())
      .filter(([_, m]) => m.topic === name)
      .map(([id]) => id);
    for (const id of ids) this.messages.delete(id);
    const topic = this.topics.get(name);
    if (topic) topic.messageCount = 0;
    return ids.length;
  }
}

export const messageQueue = new MessageQueue();
export default MessageQueue;
