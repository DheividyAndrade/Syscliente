import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import http from 'http';
import path from 'path';
import { env } from './config/env';
import { initSocket } from './config/socket';
import { startWhatsApp } from './lib/whatsapp';
import { errorHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/auth';
import { authenticateMedia } from './middleware/mediaAuth';
import { logger } from './lib/logger';

// Route modules
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/users.routes';
import conversationRoutes from './modules/conversations/conversations.routes';
import messageRoutes from './modules/messages/messages.routes';
// import tagRoutes from './modules/tags/tags.routes';
import webhookRoutes from './modules/webhook/webhook.routes';
import whatsappRoutes from './modules/webhook/whatsapp.routes';
import tagRoutes from './modules/tags/tags.routes';
import ignoredContactsRoutes from './modules/ignoredContacts/ignoredContacts.routes';
// import quickReplyRoutes from './modules/quickReplies/quickReplies.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';

const app = express();

// ─── Security & parsing middlewares ───
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
    },
  },
}));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Logging ───
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Health check (before rate limiter) ───
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Static media files (authenticated) ───
app.use('/media', authenticateMedia, (req, res, next) => {
  const ext = req.path.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    ogg: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', opus: 'audio/ogg',
    pdf: 'application/pdf',
  };
  if (ext && mimeMap[ext]) {
    res.setHeader('Content-Type', mimeMap[ext]);
  }
  next();
}, express.static(path.resolve(__dirname, '../media'), {
  maxAge: '7d',
  immutable: true,
}));

// ─── Rate limiting ───
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 10000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts' },
});
app.use('/api/auth/login', authLimiter);

// ─── Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api', messageRoutes);
// app.use('/api/tags', tagRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/ignored-contacts', ignoredContactsRoutes);
// app.use('/api/quick-replies', quickReplyRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ─── Error handler ───
app.use(errorHandler);

// ─── Server & Socket.IO ───
const server = http.createServer(app);
initSocket(server);

server.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT}`, { mode: env.NODE_ENV });
  logger.info(`Health check: http://localhost:${env.PORT}/api/health`);

  // Start WhatsApp connection
  startWhatsApp().catch((err) => {
    logger.error('Failed to start WhatsApp', { error: err });
  });
});

export default app;
