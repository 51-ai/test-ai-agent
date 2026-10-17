import { Router } from 'express';
import { ConversationService } from '../services/ConversationService';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { getSharedAgent } from '../core/Agent';

const router = Router();
const conversationService = new ConversationService();
// 单例：与所有入口共享同一个 Agent 实例
const agent = getSharedAgent();

router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const conversations = await conversationService.getConversations(req.user!.id);
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const conversation = await conversationService.getConversationById(req.params.id, req.user!.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { title } = req.body;
    const conversation = await conversationService.createConversation(req.user!.id, title || 'New Conversation');
    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/messages', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { content } = req.body;
    const conversation = await conversationService.getConversationById(req.params.id, req.user!.id);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await conversationService.addMessage(req.params.id, req.user!.id, content, 'user');
    
    const agentResponse = await agent.processInput(content, req.user!.id);
    
    await conversationService.addMessage(req.params.id, req.user!.id, agentResponse.content, 'assistant', {
      intent: agentResponse.status,
      emotion: agentResponse.emotion
    });

    res.json({ response: agentResponse });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.put('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { title } = req.body;
    const conversation = await conversationService.updateConversationTitle(req.params.id, req.user!.id, title);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const deleted = await conversationService.deleteConversation(req.params.id, req.user!.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;