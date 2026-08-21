// Створити першого адміна вручну — самореєстрації в API немає навмисно.
//   ADMIN_EMAIL=me@example.com ADMIN_PASSWORD=... node scripts/create-admin.mjs
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error('Задай ADMIN_EMAIL і ADMIN_PASSWORD');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Пароль має бути не коротшим за 8 символів');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const passwordHash = await argon2.hash(password);
  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash, isActive: true, failedLoginAttempts: 0, lockedUntil: null },
    create: { email, passwordHash },
    select: { id: true, email: true },
  });
  console.log(`✅ Адмін готовий: ${admin.email} (${admin.id})`);
} finally {
  await prisma.$disconnect();
}
