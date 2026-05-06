import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { sendMessageSchema, sendTemplateSchema } from '../../lib/schemas';
import * as messagesService from './messages.service';

const router = Router();

router.use(authenticate);

// Send message to WhatsApp
router.post(
  '/conversations/:conversationId/messages',
  validate(sendMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await messagesService.sendMessage(
        req.user!.userId,
        req.params.conversationId as string,
        req.body
      );
      res.status(201).json(message);
    } catch (error) {
      next(error);
    }
  }
);

// Send quick reply template
router.post(
  '/conversations/:conversationId/messages/template',
  validate(sendTemplateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await messagesService.sendTemplate(
        req.user!.userId,
        req.params.conversationId as string,
        req.body.quickReplyId
      );
      res.status(201).json(message);
    } catch (error) {
      next(error);
    }
  }
);

// Get messages for a conversation (paginated)
router.get(
  '/conversations/:conversationId/messages',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cursor = req.query.cursor as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const result = await messagesService.getMessages(
        req.params.conversationId as string,
        cursor,
        limit
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
