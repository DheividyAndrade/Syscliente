import prisma from '../../config/prisma';
import { getIO } from '../../config/socket';
import { createAuditLog } from '../../lib/audit';
import { AppError, NotFoundError, ForbiddenError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { Prisma } from '@prisma/client';

export async function listConversations(query: {
  status?: string;
  agentId?: string;
  tagId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const skip = (page - 1) * limit;

  const where: Prisma.ConversationWhereInput = {};

  if (query.status) {
    where.status = query.status as any;
  }
  if (query.agentId) {
    where.assignedToId = query.agentId;
  }
  if (query.tagId) {
    where.tags = { some: { tagId: query.tagId } };
  }
  if (query.search) {
    where.OR = [
      { customerName: { contains: query.search } },
      { customerPhone: { contains: query.search } },
    ];
  }

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        assignedTo: {
          select: { id: true, name: true, avatarUrl: true },
        },
        tags: {
          include: {
            tag: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.conversation.count({ where }),
  ]);

  return {
    conversations: conversations.map((c) => ({
      id: c.id,
      customerName: c.customerName,
      customerPhone: c.customerPhone,
      status: c.status,
      priority: c.priority,
      lastMessageAt: c.lastMessageAt,
      unreadCount: c.unreadCount,
      assignedTo: c.assignedTo,
      tags: c.tags.map((ct) => ({ id: ct.tag.id, name: ct.tag.name, color: ct.tag.color })),
      messageCount: c._count.messages,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getConversation(id: string, userId?: string, userRole?: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      assignedTo: {
        select: { id: true, name: true, avatarUrl: true },
      },
      tags: {
        include: { tag: true },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          sender: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }

  // IDOR check: agent can only read conversations assigned to them
  if (userRole !== 'ADMIN' && conversation.assignedToId && conversation.assignedToId !== userId) {
    throw new ForbiddenError('Voce nao tem permissao para acessar esta conversa');
  }

  return {
    ...conversation,
    tags: conversation.tags.map((ct) => ({ id: ct.tag.id, name: ct.tag.name, color: ct.tag.color })),
    messages: conversation.messages.reverse(),
  };
}

export async function createConversation(data: {
  customerName: string;
  customerPhone: string;
  priority?: string;
}) {
  // Check if open conversation already exists for this phone
  const existing = await prisma.conversation.findFirst({
    where: {
      customerPhone: data.customerPhone,
      status: { not: 'CLOSED' },
    },
  });

  if (existing) {
    throw new AppError('An open conversation already exists for this phone number', 409);
  }

  return prisma.conversation.create({
    data: {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      priority: (data.priority as any) || 'MEDIUM',
    },
  });
}

export async function assignConversation(conversationId: string, agentId: string, userId: string) {
  const [conversation, agent] = await Promise.all([
    prisma.conversation.findUnique({ where: { id: conversationId } }),
    prisma.user.findUnique({ where: { id: agentId } }),
  ]);

  if (!conversation) throw new NotFoundError('Conversation not found');
  if (!agent) throw new NotFoundError('Agent not found');

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      assignedToId: agentId,
      status: 'IN_PROGRESS',
    },
  });

  try {
    const io = getIO();
    io.to(`conversation:${conversationId}`).emit('conversation_assigned', {
      conversationId,
      assignedTo: { id: agent.id, name: agent.name },
    });
  } catch (e) {
    logger.warn('Socket emit failed', { error: e });
  }

  await createAuditLog({
    userId,
    action: 'CONVERSATION_ASSIGNED',
    entityType: 'Conversation',
    entityId: conversationId,
    details: { agentId, agentName: agent.name },
  });

  return updated;
}

export async function updateStatus(conversationId: string, status: string, ticketTitle?: string, solution?: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) throw new NotFoundError('Conversation not found');

  const data: any = { status };
  if (status === 'CLOSED') {
    data.unreadCount = 0;
    if (ticketTitle) data.ticketTitle = ticketTitle;
    if (solution) data.solution = solution;
  }

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data,
  });

  // Emit socket event to update sidebar
  try {
    const io = getIO();
    io.emit('conversation_updated', {
      id: updated.id,
      customerName: updated.customerName,
      customerPhone: updated.customerPhone,
      status: updated.status,
      lastMessageAt: updated.lastMessageAt,
      unreadCount: updated.unreadCount,
    });
  } catch (e) {
    logger.warn('Socket emit failed', { error: e });
  }

  return updated;
}

export async function updateTags(conversationId: string, tagIds: string[]) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) throw new NotFoundError('Conversation not found');

  // Remove all existing tags
  await prisma.conversationTag.deleteMany({
    where: { conversationId },
  });

  // Add new tags
  if (tagIds.length > 0) {
    await prisma.conversationTag.createMany({
      data: tagIds.map((tagId) => ({
        conversationId,
        tagId,
      })),
    });
  }

  return prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      tags: { include: { tag: true } },
    },
  });
}

export async function transferConversation(
  conversationId: string,
  newAgentId: string,
  userId: string
) {
  const [conversation, newAgent] = await Promise.all([
    prisma.conversation.findUnique({ where: { id: conversationId } }),
    prisma.user.findUnique({ where: { id: newAgentId } }),
  ]);

  if (!conversation) throw new NotFoundError('Conversation not found');
  if (!newAgent) throw new NotFoundError('Agent not found');

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { assignedToId: newAgentId },
  });

  try {
    const io = getIO();
    io.to(`conversation:${conversationId}`).emit('conversation_transferred', {
      conversationId,
      fromAgentId: conversation.assignedToId,
      toAgent: { id: newAgent.id, name: newAgent.name },
    });
  } catch (e) {
    logger.warn('Socket emit failed', { error: e });
  }

  await createAuditLog({
    userId,
    action: 'CONVERSATION_TRANSFERRED',
    entityType: 'Conversation',
    entityId: conversationId,
    details: { fromAgentId: conversation.assignedToId, toAgentId: newAgentId },
  });

  return updated;
}

export async function getHistoryByPhone(phone: string, userRole?: string) {
  // Only admins can look up history by phone
  if (userRole !== 'ADMIN') {
    throw new ForbiddenError('Apenas administradores podem acessar historico por telefone');
  }

  const conversations = await prisma.conversation.findMany({
    where: { customerPhone: phone },
    include: {
      assignedTo: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return conversations.map((c) => ({
    id: c.id,
    customerName: c.customerName,
    customerPhone: c.customerPhone,
    status: c.status,
    priority: c.priority,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    lastMessageAt: c.lastMessageAt,
    assignedTo: c.assignedTo,
    tags: c.tags.map((ct) => ({ id: ct.tag.id, name: ct.tag.name, color: ct.tag.color })),
    messageCount: c._count.messages,
  }));
}

export async function deleteConversation(id: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id } });
  if (!conversation) throw new NotFoundError('Conversation not found');

  await prisma.conversation.delete({ where: { id } });
}

export async function getDetailedConversations(targetMonth?: number | null, targetYear?: number | null) {
  const now = new Date();
  const month = targetMonth || now.getMonth() + 1;
  const year = targetYear || now.getFullYear();

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const conversations = await prisma.conversation.findMany({
    where: {
      createdAt: { gte: startOfMonth, lte: endOfMonth },
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
      messages: {
        select: { senderType: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return conversations.map((conv) => {
    // Calculate response time: time between first client message and first agent message
    const firstClientMsg = conv.messages.find((m) => m.senderType === 'CLIENT');
    const firstAgentMsg = conv.messages.find((m) => m.senderType === 'AGENT');

    let responseTimeMinutes: number | null = null;
    if (firstClientMsg && firstAgentMsg) {
      responseTimeMinutes = Math.round(
        (firstAgentMsg.createdAt.getTime() - firstClientMsg.createdAt.getTime()) / 60000
      );
    }

    const statusMap: Record<string, string> = {
      OPEN: 'Aberta',
      IN_PROGRESS: 'Em atendimento',
      CLOSED: 'Finalizada',
    };

    const priorityMap: Record<string, string> = {
      LOW: 'Baixa',
      MEDIUM: 'Media',
      HIGH: 'Alta',
    };

    return {
      id: conv.id,
      customerName: conv.customerName,
      customerPhone: conv.customerPhone,
      status: conv.status,
      statusLabel: statusMap[conv.status] || conv.status,
      priority: conv.priority,
      priorityLabel: priorityMap[conv.priority] || conv.priority,
      ticketTitle: conv.ticketTitle || '',
      solution: conv.solution || '',
      assignedTo: conv.assignedTo,
      tags: conv.tags.map((ct) => ({ id: ct.tag.id, name: ct.tag.name, color: ct.tag.color })),
      messageCount: conv.messages.length,
      responseTimeMinutes,
      responseTimeDisplay: responseTimeMinutes != null
        ? responseTimeMinutes < 60
          ? `${responseTimeMinutes} min`
          : `${Math.floor(responseTimeMinutes / 60)}h ${responseTimeMinutes % 60}min`
        : '-',
      createdAt: conv.createdAt,
      closedAt: conv.status === 'CLOSED' ? conv.updatedAt : null,
    };
  });
}
