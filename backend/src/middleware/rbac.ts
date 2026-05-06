import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../lib/errors';

type Role = 'ADMIN' | 'AGENT';

export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ForbiddenError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role as Role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
}
