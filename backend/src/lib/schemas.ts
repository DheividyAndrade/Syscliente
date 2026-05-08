import { z } from 'zod';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(1, 'Senha obrigatoria'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email invalido'),
  password: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiuscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minuscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um numero')
    .regex(/[^A-Za-z0-9]/, 'Senha deve conter pelo menos um caractere especial'),
  role: z.enum(['ADMIN', 'AGENT']).optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Conversation schemas
export const createConversationSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().min(8, 'Valid phone number is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

export const assignConversationSchema = z.object({
  agentId: z.string().uuid('Invalid agent ID'),
});

export const updateStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED']),
  ticketTitle: z.string().max(200).optional(),
  solution: z.string().max(2000).optional(),
});

export const updateTagsSchema = z.object({
  tagIds: z.array(z.string().uuid('Invalid tag ID')),
});

export const transferSchema = z.object({
  agentId: z.string().uuid('Invalid agent ID'),
});

// Message schemas
export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required'),
  contentType: z.enum(['TEXT', 'IMAGE', 'DOCUMENT', 'TEMPLATE']).optional(),
});

export const sendTemplateSchema = z.object({
  quickReplyId: z.string().uuid('Invalid template ID'),
});

// User schemas
export const createUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email invalido'),
  password: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiuscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minuscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um numero')
    .regex(/[^A-Za-z0-9]/, 'Senha deve conter pelo menos um caractere especial'),
  role: z.enum(['ADMIN', 'AGENT']),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(['ADMIN', 'AGENT']).optional(),
  isActive: z.boolean().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

// Tag schemas
export const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional(),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// Quick Reply schemas
export const createQuickReplySchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  content: z.string().min(1, 'Content is required'),
});

// Query schemas
export const conversationQuerySchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED']).optional(),
  agentId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type ConversationQuery = z.infer<typeof conversationQuerySchema>;
