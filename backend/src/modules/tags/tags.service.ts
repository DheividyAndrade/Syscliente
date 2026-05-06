import prisma from '../../config/prisma';
import { AppError, NotFoundError } from '../../lib/errors';

export async function listTags() {
  return prisma.tag.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function createTag(data: { name: string; color?: string }) {
  const existing = await prisma.tag.findUnique({ where: { name: data.name } });
  if (existing) throw new AppError('Tag already exists', 409);

  return prisma.tag.create({
    data: {
      name: data.name,
      color: data.color || '#6B7280',
    },
  });
}

export async function updateTag(id: string, data: { name?: string; color?: string }) {
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) throw new NotFoundError('Tag not found');

  if (data.name && data.name !== tag.name) {
    const existing = await prisma.tag.findUnique({ where: { name: data.name } });
    if (existing) throw new AppError('Tag name already exists', 409);
  }

  return prisma.tag.update({
    where: { id },
    data,
  });
}

export async function deleteTag(id: string) {
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) throw new NotFoundError('Tag not found');

  await prisma.tag.delete({ where: { id } });
}
