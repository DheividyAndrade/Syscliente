import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createTagSchema, updateTagSchema } from '../../lib/schemas';
import * as tagsService from './tags.service';

const router = Router();

router.use(authenticate);

// List all tags
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tags = await tagsService.listTags();
    res.json(tags);
  } catch (error) {
    next(error);
  }
});

// Create tag (admin)
router.post('/', authorize('ADMIN'), validate(createTagSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tag = await tagsService.createTag(req.body);
    res.status(201).json(tag);
  } catch (error) {
    next(error);
  }
});

// Update tag
router.put('/:id', authorize('ADMIN'), validate(updateTagSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tag = await tagsService.updateTag(req.params.id as string, req.body);
    res.json(tag);
  } catch (error) {
    next(error);
  }
});

// Delete tag
router.delete('/:id', authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await tagsService.deleteTag(req.params.id as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
