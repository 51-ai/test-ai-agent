import { Conversation, IConversation, IMessage } from '../models/Conversation';

export class ConversationService {
  async createConversation(userId: string, title: string): Promise<IConversation> {
    const conversation = new Conversation({ userId, title, messages: [] });
    return conversation.save();
  }

  async getConversations(userId: string): Promise<IConversation[]> {
    return Conversation.find({ userId }).sort({ updatedAt: -1 });
  }

  async getConversationById(id: string, userId: string): Promise<IConversation | null> {
    return Conversation.findOne({ _id: id, userId });
  }

  async addMessage(conversationId: string, userId: string, content: string, role: 'user' | 'assistant', metadata?: Record<string, unknown>): Promise<IConversation | null> {
    // 白名单校验：仅允许安全的 metadata key，防止注入 _id / __proto__ / $where 等
    const ALLOWED_META_KEYS = new Set(['source', 'tokens', 'model', 'duration', 'toolCalls', 'notes']);
    const sanitizedMeta: Record<string, unknown> = {};
    if (metadata) {
      for (const key of Object.keys(metadata)) {
        if (ALLOWED_META_KEYS.has(key) && typeof metadata[key] !== 'function') {
          sanitizedMeta[key] = metadata[key];
        }
      }
    }
    const message: IMessage = {
      content,
      role,
      timestamp: new Date(),
      metadata: sanitizedMeta
    };

    return Conversation.findOneAndUpdate(
      { _id: conversationId, userId },
      { 
        $push: { messages: message },
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async updateConversationTitle(id: string, userId: string, title: string): Promise<IConversation | null> {
    return Conversation.findOneAndUpdate(
      { _id: id, userId },
      { title, updatedAt: new Date() },
      { new: true }
    );
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    const result = await Conversation.findOneAndDelete({ _id: id, userId });
    return result !== null;
  }

  async clearMessages(conversationId: string, userId: string): Promise<IConversation | null> {
    return Conversation.findOneAndUpdate(
      { _id: conversationId, userId },
      { messages: [], updatedAt: new Date() },
      { new: true }
    );
  }

  // ========== Admin methods ==========

  async listConversationsAdmin(query: {
    page?: number;
    pageSize?: number;
    userId?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const filter: Record<string, unknown> = {};
    if (query.userId) filter.userId = query.userId;
    if (query.search) filter.title = { $regex: query.search, $options: 'i' };

    const sortBy = query.sortBy || 'updatedAt';
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortBy]: sortDir };

    const [total, docs] = await Promise.all([
      Conversation.countDocuments(filter),
      Conversation.find(filter)
        .sort(sort).skip(skip).limit(pageSize)
        .populate('userId', 'username email')
        .lean()
    ]);

    return { data: docs, total, page, pageSize };
  }

  async getConversationByIdAdmin(id: string) {
    return Conversation.findById(id).populate('userId', 'username email').lean();
  }

  async updateConversationAdmin(id: string, patch: { title?: string }) {
    const update: Record<string, unknown> = {};
    if (patch.title !== undefined) {
      update.title = patch.title;
      update.updatedAt = new Date();
    }
    return Conversation.findByIdAndUpdate(id, update, { new: true }).populate('userId', 'username email');
  }

  async deleteConversationAdmin(id: string): Promise<boolean> {
    const res = await Conversation.findByIdAndDelete(id);
    return res !== null;
  }

  async clearMessagesByAdmin(id: string) {
    return Conversation.findByIdAndUpdate(
      id,
      { messages: [], updatedAt: new Date() },
      { new: true }
    );
  }

  async getConversationStats() {
    const [total, totalMessages] = await Promise.all([
      Conversation.countDocuments(),
      Conversation.aggregate([
        { $project: { count: { $size: '$messages' } } },
        { $group: { _id: null, total: { $sum: '$count' } } }
      ])
    ]);
    const userCount = await Conversation.distinct('userId').then(ids => ids.length);
    return {
      total,
      totalMessages: (totalMessages[0]?.total as number) || 0,
      uniqueUsers: userCount
    };
  }
}