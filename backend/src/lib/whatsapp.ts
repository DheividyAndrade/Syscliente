import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { downloadContentFromMessage } from '@whiskeysockets/baileys/lib/Utils/messages-media';
import { Boom } from '@hapi/boom';
import { toDataURL } from 'qrcode';
import path from 'path';
import fs from 'fs';
import prisma from '../config/prisma';
import { getIO } from '../config/socket';
import { logger } from './logger';

const AUTH_DIR = path.resolve(__dirname, '../../.baileys-auth');
const MEDIA_DIR = path.resolve(__dirname, '../../media');

let sock: ReturnType<typeof makeWASocket> | null = null;
let qrCodeDataUrl: string | null = null;
let connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let syncTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let isStarting = false;
let isSynced = false;

export function getQR(): string | null {
  return qrCodeDataUrl;
}

export function getConnectionState() {
  return connectionState;
}

function clearTimers() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (syncTimeoutTimer) {
    clearTimeout(syncTimeoutTimer);
    syncTimeoutTimer = null;
  }
}

async function processIncomingMessage(msg: any) {
  try {
    if (msg.key?.fromMe) return;

    // Filter out status broadcasts and protocol messages
    const jid = msg.key?.remoteJid || '';
    if (
      jid === 'status@broadcast' ||
      jid.includes('@broadcast') ||
      jid.includes('@newsletter') ||
      msg.messageStubType != null ||
      msg.message?.protocolMessage != null ||
      msg.message?.senderKeyDistributionMessage != null
    ) {
      logger.info('Skipping non-chat message', { jid, messageStubType: msg.messageStubType });
      return;
    }

    // Log raw key to debug JID format
    logger.info('Incoming message raw key', {
      remoteJid: msg.key?.remoteJid,
      pushName: msg.pushName,
      messageKeys: Object.keys(msg.message || {}),
      id: msg.key?.id,
    });

    const rawJid = msg.key.remoteJid || '';
    const phone = rawJid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '').replace(/@lid$/, '').replace(/@broadcast$/, '');
    const customerName = msg.pushName || `Cliente ${phone.substring(0, 8)}`;
    const externalId = msg.key.id || '';

    let content = '';
    let contentType = 'TEXT';
    let mediaUrl: string | null = null;

    if (msg.message?.conversation) {
      content = msg.message.conversation;
    } else if (msg.message?.extendedTextMessage?.text) {
      content = msg.message.extendedTextMessage.text;
    } else if (msg.message?.imageMessage) {
      content = msg.message.imageMessage.caption || '\u{1F4F7} Imagem';
      contentType = 'IMAGE';
    } else if (msg.message?.documentMessage) {
      content = msg.message.documentMessage.title || '\u{1F4CE} Documento';
      contentType = 'DOCUMENT';
    }

    if (!phone || !content) return;

    // Download and save media if present
    if (contentType === 'IMAGE' && msg.message?.imageMessage) {
      try {
        const stream = await downloadContentFromMessage(
          msg.message.imageMessage,
          'image',
          {}
        );
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        const ext = msg.message.imageMessage.mimetype?.split('/')[1] || 'jpg';
        const filename = `${externalId || msg.key.id || 'img'}.${ext}`;
        const filepath = path.join(MEDIA_DIR, filename);

        if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
        fs.writeFileSync(filepath, buffer);

        mediaUrl = `/media/${filename}`;
        logger.info('Media saved', { filename, size: buffer.length });
      } catch (mediaErr: any) {
        mediaUrl = msg.message.imageMessage.url || null;
        logger.warn('Media download failed, using CDN URL', { error: mediaErr?.message || mediaErr });
      }
    } else if (contentType === 'DOCUMENT' && msg.message?.documentMessage) {
      try {
        const stream = await downloadContentFromMessage(
          msg.message.documentMessage,
          'document',
          {}
        );
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        const ext = msg.message.documentMessage.mimetype?.split('/')[1] || 'bin';
        const filename = `${externalId || msg.key.id || 'doc'}.${ext}`;
        const filepath = path.join(MEDIA_DIR, filename);

        if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
        fs.writeFileSync(filepath, buffer);

        mediaUrl = `/media/${filename}`;
        logger.info('Document saved', { filename, size: buffer.length });
      } catch (mediaErr: any) {
        mediaUrl = msg.message.documentMessage.url || null;
        logger.warn('Document download failed', { error: mediaErr?.message || mediaErr });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let conversation = await tx.conversation.findFirst({
        where: { customerPhone: phone, status: { not: 'CLOSED' } },
      });

      if (!conversation) {
        conversation = await tx.conversation.create({
          data: {
            customerName,
            customerPhone: phone,
            rawJid: rawJid,
            status: 'OPEN',
            unreadCount: 1,
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
            rawJid: rawJid,
          },
        });
      }

      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderType: 'CLIENT',
          content,
          contentType: contentType as any,
          mediaUrl: mediaUrl || undefined,
          status: 'DELIVERED',
          externalId: externalId || undefined,
        },
      });

      return { conversation, message };
    });

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
    } catch (e) {
      logger.warn('Socket emit failed', { error: e });
    }

    logger.info('WhatsApp message processed', {
      phone,
      conversationId: result.conversation.id,
    });
  } catch (error) {
    logger.error('Failed to process incoming message', { error });
  }
}

function scheduleReconnect() {
  clearTimers();
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    logger.info('Tentando reconectar WhatsApp...');
    try {
      await startWhatsApp();
    } catch (err) {
      logger.error('Reconnect failed', { error: err });
      scheduleReconnect();
    }
  }, 5000);
}

export async function startWhatsApp() {
  if (isStarting) return;
  isStarting = true;

  try {
    // Close existing socket
    if (sock) {
      try { sock.end(undefined); } catch {}
      sock = null;
    }

    clearTimers();

    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    connectionState = 'connecting';
    isSynced = false;
    qrCodeDataUrl = null;

    // Safety: if sync takes too long, force reconnect
    syncTimeoutTimer = setTimeout(() => {
      logger.warn('Initial sync timeout - forçando reconexão');
      connectionState = 'disconnected';
      isStarting = false;
      scheduleReconnect();
    }, 90000);

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: ['Syscliente', 'Chrome', '1.0.0'],
      defaultQueryTimeoutMs: 90000,
      connectTimeoutMs: 90000,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 1000,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr, isNewLogin, receivedPendingNotifications } = update;

      // QR code available
      if (qr) {
        try {
          qrCodeDataUrl = await toDataURL(qr);
          logger.info('QR Code gerado - escaneie com WhatsApp');
        } catch {
          qrCodeDataUrl = null;
        }
      }

      if (connection === 'open') {
        // Only mark as connected if sync is complete
        // receivedPendingNotifications=false means sync still in progress
        // isNewLogin=true means still resolving session
        if (receivedPendingNotifications !== false && !isNewLogin) {
          isSynced = true;
          connectionState = 'connected';
          qrCodeDataUrl = null;
          isStarting = false;
          clearTimers();
          logger.info('WhatsApp conectado e sincronizado!');
        } else {
          // Socket open but still syncing - stay in connecting state
          connectionState = 'connecting';
          logger.info('WhatsApp socket aberto, aguardando sincronizacao...');
        }
      }

      if (connection === 'close') {
        connectionState = 'disconnected';
        isSynced = false;
        qrCodeDataUrl = null;
        isStarting = false;
        clearTimers();

        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          logger.info(`WhatsApp desconectado (code: ${statusCode}). Reconectando em 5s...`);
          scheduleReconnect();
        } else {
          logger.warn('WhatsApp desconectado (logged out). Remova .baileys-auth para reconectar.');
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      // If sync just completed (we can now send), mark as connected
      if (!isSynced && connectionState === 'connecting') {
        isSynced = true;
        connectionState = 'connected';
        clearTimers();
        isStarting = false;
        logger.info('WhatsApp sincronizacao completa via mensagens recebidas');
      }
      for (const msg of messages) {
        await processIncomingMessage(msg as any);
      }
    });

    // Cleanup unused listener
    sock.ev.on('group-participants.update', async () => {});
  } catch (err) {
    isStarting = false;
    logger.error('Failed to start WhatsApp', { error: err });
    scheduleReconnect();
  }
}

export async function sendWhatsAppText(number: string, text: string): Promise<{ id: string }> {
  if (!sock || !isSynced) {
    throw new Error('WhatsApp ainda esta sincronizando. Aguarde alguns segundos.');
  }

  try {
    // Use the number directly to construct JID
    // If number already contains @, use it as-is (raw JID)
    const jid = number.includes('@') ? number : `${number.replace(/\D/g, '')}@s.whatsapp.net`;

    const result = await sock.sendMessage(jid, { text });

    if (!result || !result.key?.id) {
      throw new Error('WhatsApp nao confirmou o envio');
    }

    logger.info('WhatsApp message sent', {
      to: jid,
      messageId: result.key.id,
      status: result.status || 'unknown',
    });

    return { id: result.key.id };
  } catch (error: any) {
    logger.error('Failed to send WhatsApp message', {
      number,
      error: error?.message || error,
    });
    throw error;
  }
}

export async function stopWhatsApp() {
  clearTimers();
  isStarting = false;
  if (sock) {
    try { sock.end(undefined); } catch {}
    sock = null;
  }
  connectionState = 'disconnected';
  isSynced = false;
  qrCodeDataUrl = null;
}
