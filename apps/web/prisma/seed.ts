import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const PASS = 'Password123!';

async function main() {
  const passwordHash = await bcrypt.hash(PASS, 10);
  const provider = await prisma.provider.upsert({
    where: { slug: 'drivehub' },
    update: {},
    create: {
      name: 'DriveHub', slug: 'drivehub',
      colors: { primary: '#F97316', primaryDark: '#EA580C' },
      businessSettings: { create: { currency: 'USD', taxRatePct: 5 } },
    },
  });
  const users: Array<[string, 'ADMIN'|'PROVIDER'|'STAFF'|'CUSTOMER', string | null, string]> = [
    ['admin@demo.test', 'ADMIN', null, 'Platform Admin'],
    ['provider@demo.test', 'PROVIDER', provider.id, 'DriveHub Owner'],
    ['staff@demo.test', 'STAFF', provider.id, 'DriveHub Staff'],
    ['customer@demo.test', 'CUSTOMER', null, 'Demo Customer'],
  ];
  for (const [email, role, providerId, name] of users) {
    await prisma.user.upsert({
      where: { email }, update: {},
      create: { email, role, providerId, name, passwordHash },
    });
  }
  console.log('Seeded provider DriveHub + 4 users (password:', PASS, ')');
}
main().finally(() => prisma.$disconnect());
