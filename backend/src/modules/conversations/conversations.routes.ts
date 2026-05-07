import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createConversationSchema,
  assignConversationSchema,
  updateStatusSchema,
  updateTagsSchema,
  transferSchema,
  conversationQuerySchema,
} from '../../lib/schemas';
import * as conversationsService from './conversations.service';

const router = Router();

router.use(authenticate);

// List conversations with filters
router.get('/', validate(conversationQuerySchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await conversationsService.listConversations(req.query as any);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Create conversation manually
router.post('/', validate(createConversationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversation = await conversationsService.createConversation(req.body);
    res.status(201).json(conversation);
  } catch (error) {
    next(error);
  }
});

// Get conversation history by phone (must be before /:id)
router.get('/history/:phone', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const history = await conversationsService.getHistoryByPhone(req.params.phone as string);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Get detailed conversations with response time (must be before /:id)
router.get('/detailed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const month = req.query.month ? parseInt(req.query.month as string) : null;
    const year = req.query.year ? parseInt(req.query.year as string) : null;
    const result = await conversationsService.getDetailedConversations(month, year);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get conversation with messages
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversation = await conversationsService.getConversation(req.params.id as string);
    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

// Assign conversation to agent
router.patch('/:id/assign', validate(assignConversationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversation = await conversationsService.assignConversation(
      req.params.id as string,
      req.body.agentId,
      req.user!.userId
    );
    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

// Update conversation status
router.patch('/:id/status', validate(updateStatusSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversation = await conversationsService.updateStatus(
      req.params.id as string,
      req.body.status,
      req.body.ticketTitle,
      req.body.solution
    );
    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

// Update conversation tags
router.patch('/:id/tags', validate(updateTagsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversation = await conversationsService.updateTags(
      req.params.id as string,
      req.body.tagIds
    );
    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

// Transfer conversation to another agent
router.put('/:id/transfer', validate(transferSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversation = await conversationsService.transferConversation(
      req.params.id as string,
      req.body.agentId,
      req.user!.userId
    );
    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

// Delete conversation
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await conversationsService.deleteConversation(req.params.id as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
