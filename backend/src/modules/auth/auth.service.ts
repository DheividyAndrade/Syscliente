import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';
import prisma from '../../config/prisma';
import { env } from '../../config/env';
import { AppError, UnauthorizedError } from '../../lib/errors';
import { LoginInput, RegisterInput } from '../../lib/schemas';
import { JwtPayload } from '../../middleware/auth';
import { createAuditLog } from '../../lib/audit';

async function generateTokens(userId: string, email: string, role: string) {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = { userId, email, role };

  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: 900, // 15 minutes
  } as jwt.SignOptions);

  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: 604800, // 7 days
  } as jwt.SignOptions);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt,
    },
  });

  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError('Email already in use', 409);
  }

  const hashedPassword = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password: hashedPassword,
      role: input.role || 'AGENT',
    },
  });

  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

export async function login(input: LoginInput, res: Response) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Account is deactivated');
  }

  const valid = await bcrypt.compare(input.password, user.password);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const { accessToken, refreshToken } = await generateTokens(user.id, user.email, user.role);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });

  await createAuditLog({
    userId: user.id,
    action: 'LOGIN',
    entityType: 'User',
    entityId: user.id,
  });

  const { password, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, accessToken };
}

export async function refreshToken(oldRefreshToken: string) {
  let payload: JwtPayload;
  try {
    payload = jwt.verify(oldRefreshToken, env.JWT_REFRESH_SECRET) as JwtPayload;
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: oldRefreshToken },
  });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token expired or revoked');
  }

  await prisma.refreshToken.delete({ where: { id: storedToken.id } });

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.isActive) {
    throw new UnauthorizedError('User not found or inactive');
  }

  return generateTokens(user.id, user.email, user.role);
}

export async function logout(userId: string) {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}
