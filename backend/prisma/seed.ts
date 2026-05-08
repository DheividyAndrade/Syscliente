import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const adminPassword = await bcrypt.hash('Admin@123', 12);
  const agentPassword = await bcrypt.hash('Agente@123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@syscliente.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@syscliente.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: 'agente@syscliente.com' },
    update: {},
    create: {
      name: 'Atendente Exemplo',
      email: 'agente@syscliente.com',
      password: agentPassword,
      role: 'AGENT',
    },
  });

  const tags = await Promise.all([
    prisma.tag.upsert({ where: { name: 'Financeiro' }, update: {}, create: { name: 'Financeiro', color: '#10B981' } }),
    prisma.tag.upsert({ where: { name: 'Suporte' }, update: {}, create: { name: 'Suporte', color: '#3B82F6' } }),
    prisma.tag.upsert({ where: { name: 'Vendas' }, update: {}, create: { name: 'Vendas', color: '#F59E0B' } }),
    prisma.tag.upsert({ where: { name: 'Reclamação' }, update: {}, create: { name: 'Reclamação', color: '#EF4444' } }),
  ]);

  console.log('Seed completed!');
  console.log(`Admin user: admin@syscliente.com / Admin@123`);
  console.log(`Agent user: agente@syscliente.com / Agente@123`);
  console.log(`Tags created: ${tags.map((t) => t.name).join(', ')}`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
