import prisma from '../../config/prisma';
import { getIO } from '../../config/socket';
import { sendWhatsAppText } from '../../lib/whatsapp';
import { createAuditLog } from '../../lib/audit';
import { AppError, NotFoundError, ForbiddenError } from '../../lib/errors';
import { logger } from '../../lib/logger';

export async function sendMessage(
  userId: string,
  conversationId: string,
  data: { content: string; contentType?: string }
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }

  if (conversation.status === 'CLOSED') {
    throw new AppError('Cannot send messages to a closed conversation');
  }

  // Auto-assign if no agent assigned yet
  if (!conversation.assignedToId) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedToId: userId, status: 'IN_PROGRESS' },
    });
  } else if (conversation.assignedToId !== userId) {
    // Another agent is assigned - block
    throw new AppError('Esta conversa esta sendo atendida por outro agente. Use Transferir para assumir.');
  }

  let externalId: string | undefined;
  let messageStatus = 'SENT';

  // Send via WhatsApp (Baileys)
  try {
    // Use rawJid if available (for linked device), otherwise construct from phone
    const destination = conversation.rawJid || conversation.customerPhone;
    const result = await sendWhatsAppText(destination, data.content);
    externalId = result.id;
    messageStatus = 'SENT';
  } catch (error) {
    logger.error('Failed to send WhatsApp message', {
      conversationId,
      error,
    });
    messageStatus = 'FAILED';
    throw new AppError('Failed to send message to WhatsApp. Check WhatsApp connection.');
  }

  // Save message
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderType: 'AGENT',
      senderId: userId,
      content: data.content,
      contentType: (data.contentType as any) || 'TEXT',
      status: messageStatus as any,
      externalId,
    },
  });

  // Update conversation
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
      status: 'IN_PROGRESS',
    },
  });

  // Emit socket event
  try {
    const io = getIO();
    io.to(`conversation:${conversationId}`).emit('new_message', {
      conversationId,
      message,
    });
  } catch (e) {
    logger.warn('Socket emit failed', { error: e });
  }

  await createAuditLog({
    userId,
    action: 'MESSAGE_SENT',
    entityType: 'Message',
    entityId: message.id,
    details: { conversationId },
  });

  return message;
}

export async function sendTemplate(
  userId: string,
  conversationId: string,
  quickReplyId: string
) {
  const quickReply = await prisma.quickReply.findUnique({
    where: { id: quickReplyId },
  });

  if (!quickReply) {
    throw new NotFoundError('Quick reply template not found');
  }

  return sendMessage(userId, conversationId, {
    content: quickReply.content,
    contentType: 'TEMPLATE',
  });
}

export async function getMessages(conversationId: string, cursor?: string, limit = 50, userId?: string, userRole?: string) {
  // IDOR check
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { assignedToId: true },
  });
  if (!conversation) throw new NotFoundError('Conversation not found');
  if (userRole !== 'ADMIN' && conversation.assignedToId && conversation.assignedToId !== userId) {
    throw new ForbiddenError('Voce nao tem permissao para acessar esta conversa');
  }

  const where: any = { conversationId };
  if (cursor) {
    where.createdAt = { lt: new Date(cursor) };
  }

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    include: {
      sender: {
        select: { id: true, name: true },
      },
    },
  });

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? items[items.length - 1]?.createdAt?.toISOString() : null;

  return {
    messages: items.reverse(),
    nextCursor,
    hasMore,
  };
}
