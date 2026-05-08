import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
    });
  }

  logger.error('Unhandled error', {
    message: err.message,
    path: req.path,
    method: req.method,
  });

  return res.status(500).json({
    error: 'Erro interno do servidor',
    statusCode: 500,
  });
}
