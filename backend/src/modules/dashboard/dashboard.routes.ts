import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import * as dashboardService from './dashboard.service';
import * as exportService from './dashboard.export';

const router = Router();

router.use(authenticate);

router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const month = req.query.month ? parseInt(req.query.month as string) : null;
    const year = req.query.year ? parseInt(req.query.year as string) : null;
    const stats = await dashboardService.getStats(month, year);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.get('/export', authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const month = req.query.month ? parseInt(req.query.month as string) : new Date().getMonth() + 1;
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

    const buffer = await exportService.generateMonthlyReport(month, year);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio-syscliente-${year}-${String(month).padStart(2, '0')}.xlsx`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export default router;
