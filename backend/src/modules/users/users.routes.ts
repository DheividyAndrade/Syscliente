import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createUserSchema, updateUserSchema } from '../../lib/schemas';
import * as usersService from './users.service';

const router = Router();

router.use(authenticate);

// List all users
router.get('/', authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await usersService.listUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Get user by ID
router.get('/:id', authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await usersService.getUserById(req.params.id as string);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Create user
router.post('/', authorize('ADMIN'), validate(createUserSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await usersService.createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

// Update user
router.put('/:id', authorize('ADMIN'), validate(updateUserSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await usersService.updateUser(req.params.id as string, req.body);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Delete user
router.delete('/:id', authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await usersService.deleteUser(req.params.id as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
