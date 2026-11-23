#!/usr/bin/env node
// Міграції на прод — у складі деплою, ДО збірки коду.
//
// Урок 07.09.2026 (див. db-target.mjs): код, що читає нову колонку, поїхав
// раніше за міграцію, і сайт лежав з 500. Контейнери Claude до Neon не
// дістають, тож ручний `setup-neon.sh` упирався в людину з ноутбуком.
// Тепер Vercel сам котить `prisma migrate deploy` на продакшн-деплої:
// якщо міграція впала — збірка падає, і живим лишається попередній деплой.
//
// Лише VERCEL_ENV=production: превʼю можуть дивитися в ту саму базу, а
// міграція з незлитої гілки на проді — не те, чого ми хочемо.
import { execFileSync } from 'node:child_process';

if (process.env.VERCEL_ENV !== 'production') {
  console.log(`vercel-migrate: VERCEL_ENV=${process.env.VERCEL_ENV ?? '(нема)'} — пропускаю`);
  process.exit(0);
}

// Міграціям потрібне пряме зʼєднання (pgbouncer не тримає advisory lock).
// Інтеграція Vercel↔Neon кладе його в DATABASE_URL_UNPOOLED.
const direct =
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL;
if (!direct) {
  console.error('vercel-migrate: немає жодного рядка підключення — зупиняю збірку');
  process.exit(1);
}

let host = '?';
try { host = new URL(direct).host; } catch { /* лишаємо ? */ }
console.log(`vercel-migrate: prisma migrate deploy → ${host}`);

execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DIRECT_DATABASE_URL: direct, DATABASE_URL: process.env.DATABASE_URL || direct },
});
