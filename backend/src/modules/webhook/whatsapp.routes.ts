import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { getQR, getConnectionState, startWhatsApp } from '../../lib/whatsapp';

const router = Router();

router.get('/status', authenticate, async (_req: Request, res: Response) => {
  res.json({
    connectionState: getConnectionState(),
    hasQR: !!getQR(),
  });
});

router.get('/qr', authenticate, authorize('ADMIN'), async (_req: Request, res: Response) => {
  const qr = getQR();
  if (!qr) {
    res.status(404).json({ error: 'QR code not available. WhatsApp may already be connected.' });
    return;
  }
  res.json({ qr });
});

router.post('/reconnect', authenticate, authorize('ADMIN'), async (_req: Request, res: Response) => {
  try {
    await startWhatsApp();
    res.json({ message: 'Reconnecting...' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reconnect' });
  }
});

export default router;
