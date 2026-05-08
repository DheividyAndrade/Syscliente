import prisma from '../../config/prisma';
import { AppError, NotFoundError } from '../../lib/errors';
import { logger } from '../../lib/logger';

export async function listIgnoredContacts() {
  return prisma.ignoredContact.findMany({
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function addIgnoredContact(userId: string, data: { phone: string; label?: string; contactName?: string }) {
  const normalized = data.phone.replace(/\D/g, '');

  // Check for duplicates by phone OR name
  const existing = await prisma.ignoredContact.findFirst({
    where: {
      OR: [
        { phone: data.phone },
        { phone: normalized },
        ...(data.contactName ? [{ contactName: data.contactName }] : []),
      ],
    },
  });
  if (existing) throw new AppError('Este contato ja esta na lista de ignorados', 409);

  return prisma.ignoredContact.create({
    data: {
      phone: data.phone,
      contactName: data.contactName || null,
      label: data.label || null,
      createdById: userId,
    },
  });
}

export async function removeIgnoredContact(id: string) {
  const contact = await prisma.ignoredContact.findUnique({ where: { id } });
  if (!contact) throw new NotFoundError('Contato ignorado nao encontrado');

  await prisma.ignoredContact.delete({ where: { id } });
}

export async function checkIfIgnored(phone: string): Promise<{ blocked: boolean; id?: string }> {
  const normalized = phone.replace(/\D/g, '');
  const contact = await prisma.ignoredContact.findFirst({
    where: {
      phone: { in: [phone, normalized, `+${normalized}`] },
    },
  });
  return contact ? { blocked: true, id: contact.id } : { blocked: false };
}

export async function isPhoneIgnored(phone: string, contactName?: string, rawJid?: string): Promise<boolean> {
  const normalized = phone.replace(/\D/g, '');
  const conditions: any[] = [{ phone }, { phone: normalized }];
  if (rawJid) conditions.push({ phone: rawJid });
  if (contactName) conditions.push({ contactName });

  const contact = await prisma.ignoredContact.findFirst({
    where: { OR: conditions },
  });

  return !!contact;
}
