import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import * as service from './ignoredContacts.service';

const router = Router();

router.use(authenticate);

// Check route must be before /:id
router.get('/check/:phone', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.checkIfIgnored(req.params.phone as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/', authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await service.listIgnoredContacts();
    res.json(list);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contact = await service.addIgnoredContact(req.user!.userId, {
      phone: req.body.phone,
      label: req.body.label,
      contactName: req.body.contactName,
    });
    res.status(201).json(contact);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.removeIgnoredContact(req.params.id as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
