import prisma from '../../config/prisma';
import { getIO } from '../../config/socket';
import { createAuditLog } from '../../lib/audit';
import { AppError, NotFoundError } from '../../lib/errors';
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

export async function getConversation(id: string) {
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

  return {
    ...conversation,
    tags: conversation.tags.map((ct) => ({ id: ct.tag.id, name: ct.tag.name, color: ct.tag.color })),
    messages: conversation.messages.reverse(),
  };

  return conversation;
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

export async function updateStatus(conversationId: string, status: string, ticketTitle?: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) throw new NotFoundError('Conversation not found');

  const data: any = { status };
  if (status === 'CLOSED') {
    data.unreadCount = 0;
    if (ticketTitle) {
      data.ticketTitle = ticketTitle;
    }
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

export async function getHistoryByPhone(phone: string) {
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
