import { Router, Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import * as webhookService from './webhook.service';

const router = Router();

router.post('/whatsapp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = req.headers['x-webhook-secret'] || req.headers['webhook-secret'];

    if (env.EVOLUTION_WEBHOOK_SECRET && secret !== env.EVOLUTION_WEBHOOK_SECRET) {
      res.status(403).json({ error: 'Invalid webhook secret' });
      return;
    }

    const event = req.body;

    await webhookService.processWebhookEvent(event);

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error processing event:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
