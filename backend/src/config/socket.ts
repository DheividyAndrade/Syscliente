import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from './env';
import jwt from 'jsonwebtoken';
import { logger } from '../lib/logger';

let io: Server;

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

declare module 'socket.io' {
  interface Socket {
    user?: JwtPayload;
  }
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.SOCKET_CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // JWT Authentication middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      logger.warn('Socket connection rejected: no token', { socketId: socket.id });
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token as string, env.JWT_ACCESS_SECRET) as JwtPayload;
      socket.user = decoded;
      next();
    } catch {
      logger.warn('Socket connection rejected: invalid token', { socketId: socket.id });
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (user: ${socket.user?.email})`);

    socket.on('join:conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('leave:conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}
