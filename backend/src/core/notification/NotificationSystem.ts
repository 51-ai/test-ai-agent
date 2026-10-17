/**
 * 通知系统 - 多渠道通知管理
 */

import { v4 as uuidv4 } from 'uuid';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'webhook' | 'in_app';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

export interface Notification {
  id: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  content: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  metadata?: Record<string, unknown>;
  scheduledAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  retryCount: number;
  maxRetries: number;
  error?: string;
  createdAt: Date;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  subject?: string;
  template: string;
  variables?: string[];
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  userId: string;
  channels: Partial<Record<NotificationChannel, {
    enabled: boolean;
    quietHours?: { start: string; end: string };
  }>>;
  priorityThreshold: NotificationPriority;
  email?: string;
  phone?: string;
  pushToken?: string;
}

export interface NotificationResult {
  success: boolean;
  notificationId: string;
  channel: NotificationChannel;
  error?: string;
  sentAt?: Date;
}

export class NotificationSystem {
  private notifications: Map<string, Notification> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private preferences: Map<string, NotificationPreferences> = new Map();
  private channelHandlers: Map<NotificationChannel, ChannelHandler> = new Map();
  private queue: string[] = [];
  private maxQueueSize = 10000;
  private retryDelay = 5000;
  private maxRetries = 3;
  private processing = false;

  constructor() {
    this.setupDefaultTemplates();
    this.setupChannelHandlers();
    this.startQueueProcessor();
  }

  /**
   * 设置默认模板
   */
  private setupDefaultTemplates(): void {
    const defaultTemplates: NotificationTemplate[] = [
      {
        id: 'welcome_email',
        name: '欢迎邮件',
        channel: 'email',
        subject: '欢迎使用 {{appName}}',
        template: '亲爱的 {{userName}}，\n\n欢迎加入 {{appName}}！\n\n{{message}}\n\n祝您使用愉快！',
        variables: ['appName', 'userName', 'message'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'password_reset',
        name: '密码重置',
        channel: 'email',
        subject: '密码重置请求',
        template: '您好 {{userName}}，\n\n您请求重置密码。请点击以下链接：\n{{resetLink}}\n\n链接有效期：{{expiresIn}}\n\n如果不是您本人操作，请忽略此邮件。',
        variables: ['userName', 'resetLink', 'expiresIn'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'alert_notification',
        name: '告警通知',
        channel: 'in_app',
        template: '[{{level}}] {{title}}\n\n{{message}}\n\n时间：{{timestamp}}',
        variables: ['level', 'title', 'message', 'timestamp'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'task_reminder',
        name: '任务提醒',
        channel: 'push',
        template: '任务提醒：{{taskName}}\n\n{{description}}\n\n截止时间：{{dueDate}}',
        variables: ['taskName', 'description', 'dueDate'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const template of defaultTemplates) {
      this.templates.set(template.id, template);
    }
  }

  /**
   * 设置渠道处理器
   */
  private setupChannelHandlers(): void {
    // 邮件处理
    this.channelHandlers.set('email', {
      send: async (notification) => {
        console.log(`[Notification] Sending email to ${notification.recipient}`);
        console.log(`[Notification] Subject: ${notification.subject}`);
        console.log(`[Notification] Content: ${notification.content}`);
        // 实际实现应该调用邮件服务API
        return { success: true, sentAt: new Date() };
      },
      validate: (recipient) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);
      }
    });

    // SMS处理
    this.channelHandlers.set('sms', {
      send: async (notification) => {
        console.log(`[Notification] Sending SMS to ${notification.recipient}`);
        console.log(`[Notification] Content: ${notification.content}`);
        return { success: true, sentAt: new Date() };
      },
      validate: (recipient) => {
        return /^[\d\s\-\+\(\)]{10,}$/.test(recipient);
      }
    });

    // 推送处理
    this.channelHandlers.set('push', {
      send: async (notification) => {
        console.log(`[Notification] Sending push to ${notification.recipient}`);
        console.log(`[Notification] Title: ${notification.subject}`);
        console.log(`[Notification] Body: ${notification.content}`);
        return { success: true, sentAt: new Date() };
      },
      validate: (recipient) => {
        return recipient.length > 0;
      }
    });

    // Webhook处理
    this.channelHandlers.set('webhook', {
      send: async (notification) => {
        console.log(`[Notification] Sending webhook to ${notification.recipient}`);
        console.log(`[Notification] Payload: ${JSON.stringify(notification.metadata)}`);
        return { success: true, sentAt: new Date() };
      },
      validate: (recipient) => {
        try {
          new URL(recipient);
          return true;
        } catch {
          return false;
        }
      }
    });

    // 应用内通知处理
    this.channelHandlers.set('in_app', {
      send: async (notification) => {
        console.log(`[Notification] Sending in-app notification to ${notification.recipient}`);
        console.log(`[Notification] Content: ${notification.content}`);
        return { success: true, sentAt: new Date() };
      },
      validate: (recipient) => {
        return recipient.length > 0;
      }
    });
  }

  /**
   * 启动队列处理器
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.processing && this.queue.length > 0) {
        this.processQueue();
      }
    }, 1000).unref();
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const notificationId = this.queue.shift()!;
      await this.sendNotification(notificationId);
    }
    
    this.processing = false;
  }

  /**
   * 发送通知
   */
  async send(notification: Omit<Notification, 'id' | 'status' | 'retryCount' | 'createdAt'>): Promise<string> {
    const fullNotification: Notification = {
      ...notification,
      id: `notif_${uuidv4()}`,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date()
    };

    // 检查用户偏好
    const preferences = this.preferences.get(notification.recipient);
    if (preferences) {
      const channelPref = preferences.channels[notification.channel];
      if (channelPref && !channelPref.enabled) {
        console.log(`[Notification] Channel ${notification.channel} disabled for ${notification.recipient}`);
        return fullNotification.id;
      }

      // 检查优先级别
      const priorityOrder = ['low', 'normal', 'high', 'urgent'];
      if (priorityOrder.indexOf(notification.priority) < priorityOrder.indexOf(preferences.priorityThreshold)) {
        console.log(`[Notification] Priority below threshold for ${notification.recipient}`);
        return fullNotification.id;
      }

      // 检查安静时段
      if (channelPref?.quietHours) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        if (this.isInQuietHours(currentTime, channelPref.quietHours)) {
          fullNotification.scheduledAt = this.getNextQuietHourEnd(channelPref.quietHours);
          console.log(`[Notification] Scheduled for quiet hours end: ${fullNotification.scheduledAt}`);
        }
      }
    }

    this.notifications.set(fullNotification.id, fullNotification);

    // 如果有预定时间，放入队列等待
    if (fullNotification.scheduledAt && fullNotification.scheduledAt > new Date()) {
      this.queue.push(fullNotification.id);
      return fullNotification.id;
    }

    // 立即发送
    return this.sendNotification(fullNotification.id);
  }

  /**
   * 发送通知
   */
  private async sendNotification(notificationId: string): Promise<string> {
    const notification = this.notifications.get(notificationId);
    if (!notification) {
      return notificationId;
    }

    const handler = this.channelHandlers.get(notification.channel);
    if (!handler) {
      notification.status = 'failed';
      notification.error = `No handler for channel: ${notification.channel}`;
      return notificationId;
    }

    try {
      // 验证接收者
      if (!handler.validate(notification.recipient)) {
        notification.status = 'failed';
        notification.error = 'Invalid recipient';
        return notificationId;
      }

      // 发送
      const result = await handler.send(notification);
      
      if (result.success) {
        notification.status = 'sent';
        notification.sentAt = result.sentAt;
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      notification.retryCount++;
      notification.error = error instanceof Error ? error.message : String(error);

      if (notification.retryCount >= notification.maxRetries) {
        notification.status = 'failed';
        console.error(`[Notification] Failed after ${notification.maxRetries} retries: ${notificationId}`);
      } else {
        // 重新加入队列等待重试
        setTimeout(() => {
          this.queue.push(notificationId);
        }, this.retryDelay * notification.retryCount);
      }
    }

    return notificationId;
  }

  /**
   * 使用模板发送通知
   */
  async sendWithTemplate(
    templateId: string,
    recipient: string,
    variables: Record<string, string>,
    options?: Partial<Omit<Notification, 'id' | 'channel' | 'recipient' | 'content' | 'createdAt'>>
  ): Promise<string> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // 填充模板
    let content = template.template;
    let subject = template.subject;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      content = content.replace(new RegExp(placeholder, 'g'), value);
      if (subject) {
        subject = subject.replace(new RegExp(placeholder, 'g'), value);
      }
    }

    return this.send({
      channel: template.channel,
      recipient,
      subject,
      content,
      priority: options?.priority || 'normal',
      metadata: variables,
      maxRetries: options?.maxRetries || this.maxRetries,
      ...options
    });
  }

  /**
   * 创建模板
   */
  createTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = `template_${uuidv4()}`;
    this.templates.set(id, {
      ...template,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return id;
  }

  /**
   * 更新模板
   */
  updateTemplate(id: string, updates: Partial<NotificationTemplate>): boolean {
    const template = this.templates.get(id);
    if (!template) {
      return false;
    }

    this.templates.set(id, {
      ...template,
      ...updates,
      id,
      createdAt: template.createdAt,
      updatedAt: new Date()
    });
    return true;
  }

  /**
   * 删除模板
   */
  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  /**
   * 获取模板
   */
  getTemplate(id: string): NotificationTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 设置用户偏好
   */
  setPreferences(preferences: NotificationPreferences): void {
    this.preferences.set(preferences.userId, preferences);
  }

  /**
   * 获取用户偏好
   */
  getPreferences(userId: string): NotificationPreferences | undefined {
    return this.preferences.get(userId);
  }

  /**
   * 获取用户通知
   */
  getUserNotifications(userId: string, options?: {
    status?: NotificationStatus[];
    limit?: number;
    offset?: number;
  }): Notification[] {
    let results = Array.from(this.notifications.values())
      .filter(n => n.recipient === userId);

    if (options?.status?.length) {
      results = results.filter(n => options.status!.includes(n.status));
    }

    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = options?.offset || 0;
    const limit = options?.limit || 50;
    
    return results.slice(offset, offset + limit);
  }

  /**
   * 标记为已读
   */
  markAsRead(notificationId: string): boolean {
    const notification = this.notifications.get(notificationId);
    if (!notification) {
      return false;
    }

    notification.status = 'read';
    notification.readAt = new Date();
    return true;
  }

  /**
   * 标记所有为已读
   */
  markAllAsRead(userId: string): number {
    let count = 0;
    const now = new Date();

    for (const notification of this.notifications.values()) {
      if (notification.recipient === userId && notification.status !== 'read') {
        notification.status = 'read';
        notification.readAt = now;
        count++;
      }
    }

    return count;
  }

  /**
   * 获取未读计数
   */
  getUnreadCount(userId: string): number {
    let count = 0;
    for (const notification of this.notifications.values()) {
      if (notification.recipient === userId && notification.status !== 'read' && notification.status !== 'failed') {
        count++;
      }
    }
    return count;
  }

  /**
   * 取消通知
   */
  cancel(notificationId: string): boolean {
    const notification = this.notifications.get(notificationId);
    if (!notification || notification.status === 'sent' || notification.status === 'delivered') {
      return false;
    }

    notification.status = 'failed';
    notification.error = 'Cancelled by user';

    // 从队列中移除
    const queueIndex = this.queue.indexOf(notificationId);
    if (queueIndex > -1) {
      this.queue.splice(queueIndex, 1);
    }

    return true;
  }

  /**
   * 获取通知统计
   */
  getStats(): {
    total: number;
    byStatus: Record<NotificationStatus, number>;
    byChannel: Record<NotificationChannel, number>;
    byPriority: Record<NotificationPriority, number>;
    averageDeliveryTime: number;
  } {
    const stats = {
      total: this.notifications.size,
      byStatus: {} as Record<NotificationStatus, number>,
      byChannel: {} as Record<NotificationChannel, number>,
      byPriority: {} as Record<NotificationPriority, number>,
      averageDeliveryTime: 0
    };

    let totalDeliveryTime = 0;
    let deliveredCount = 0;

    for (const notification of this.notifications.values()) {
      stats.byStatus[notification.status] = (stats.byStatus[notification.status] || 0) + 1;
      stats.byChannel[notification.channel] = (stats.byChannel[notification.channel] || 0) + 1;
      stats.byPriority[notification.priority] = (stats.byPriority[notification.priority] || 0) + 1;

      if (notification.sentAt && notification.deliveredAt) {
        totalDeliveryTime += notification.deliveredAt.getTime() - notification.sentAt.getTime();
        deliveredCount++;
      }
    }

    if (deliveredCount > 0) {
      stats.averageDeliveryTime = totalDeliveryTime / deliveredCount;
    }

    return stats;
  }

  /**
   * 检查是否在安静时段
   */
  private isInQuietHours(currentTime: string, quietHours: { start: string; end: string }): boolean {
    return currentTime >= quietHours.start && currentTime < quietHours.end;
  }

  /**
   * 获取安静时段结束时间
   */
  private getNextQuietHourEnd(quietHours: { start: string; end: string }): Date {
    const now = new Date();
    const [hours, minutes] = quietHours.end.split(':').map(Number);
    
    const nextEnd = new Date(now);
    nextEnd.setHours(hours, minutes, 0, 0);
    
    if (nextEnd <= now) {
      nextEnd.setDate(nextEnd.getDate() + 1);
    }
    
    return nextEnd;
  }
}

interface ChannelHandler {
  send: (notification: Notification) => Promise<{ success: boolean; error?: string; sentAt?: Date }>;
  validate: (recipient: string) => boolean;
}

export default NotificationSystem;
