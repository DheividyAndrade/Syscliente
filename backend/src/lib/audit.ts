import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';
import { logger } from './logger';

export async function createAuditLog(params: {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: (params.details ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    logger.error('Failed to create audit log', { error, params });
  }
}
