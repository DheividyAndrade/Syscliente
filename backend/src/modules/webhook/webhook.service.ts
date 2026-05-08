import prisma from '../../config/prisma';
import { getIO } from '../../config/socket';
import { logger } from '../../lib/logger';

interface WebhookEvent {
  event: string;
  instance: string;
  data?: {
    key?: {
      remoteJid: string;
      id: string;
      fromMe: boolean;
    };
    messageType?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text: string };
      imageMessage?: { caption?: string; url?: string };
      documentMessage?: { title?: string; url?: string };
    };
    pushName?: string;
    source?: string;
  };
}

function extractPhoneNumber(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '').replace(/@lid$/, '');
}

function extractMessageContent(data: WebhookEvent['data']): { content: string; contentType: string } {
  const msg = data?.message;
  if (!msg) return { content: '', contentType: 'TEXT' };

  if (msg.conversation) {
    return { content: msg.conversation, contentType: 'TEXT' };
  }
  if (msg.extendedTextMessage?.text) {
    return { content: msg.extendedTextMessage.text, contentType: 'TEXT' };
  }
  if (msg.imageMessage) {
    return { content: msg.imageMessage.caption || '📷 Imagem', contentType: 'IMAGE' };
  }
  if (msg.documentMessage) {
    return { content: msg.documentMessage.title || '📎 Documento', contentType: 'DOCUMENT' };
  }

  return { content: '📩 Mensagem recebida', contentType: 'TEXT' };
}

export async function processWebhookEvent(event: WebhookEvent) {
  if (event.event !== 'messages.upsert' || !event.data) {
    return;
  }

  const data = event.data;

  // Ignore messages sent by us (fromMe)
  if (data.key?.fromMe) {
    return;
  }

  const phone = extractPhoneNumber(data.key?.remoteJid || '');
  const customerName = data.pushName || `Cliente ${phone.substring(0, 8)}`;
  const { content, contentType } = extractMessageContent(data);
  const externalId = data.key?.id || '';

  if (!phone || !content) {
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Find or create conversation
      let conversation = await tx.conversation.findFirst({
        where: { customerPhone: phone, status: { not: 'CLOSED' } },
      });

      if (!conversation) {
        conversation = await tx.conversation.create({
          data: {
            customerName,
            customerPhone: phone,
            status: 'OPEN',
            lastMessageAt: new Date(),
          },
        });
      } else {
        await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            unreadCount: { increment: 1 },
            customerName,
          },
        });
      }

      // Create message
      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderType: 'CLIENT',
          content,
          contentType: contentType as any,
          status: 'DELIVERED',
          externalId: externalId || undefined,
        },
      });

      return { conversation, message };
    });

    // Emit real-time events via Socket.IO
    try {
      const io = getIO();
      io.to(`conversation:${result.conversation.id}`).emit('new_message', {
        conversationId: result.conversation.id,
        message: result.message,
      });
      io.emit('conversation_updated', {
        id: result.conversation.id,
        customerName: result.conversation.customerName,
        customerPhone: result.conversation.customerPhone,
        status: result.conversation.status,
        lastMessageAt: result.conversation.lastMessageAt,
        unreadCount: result.conversation.unreadCount,
      });
    } catch (socketError) {
      logger.warn('Socket emit failed', { error: socketError });
    }

    logger.info('Webhook processed', {
      conversationId: result.conversation.id,
      messageId: result.message.id,
    });
  } catch (error) {
    logger.error('Failed to process webhook event', { error });
    throw error;
  }
}
