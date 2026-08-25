// Готує блоки змінних для вставки у Vercel — окремо для API, окремо для вебу.
//
//   node scripts/vercel-env.mjs
//
// Читає рядки Neon з .env.neon, решту — з .env, генерує секрети і складає
// все у vercel-api-env.txt і vercel-web-env.txt. Обидва вихідні файли в
// .gitignore. Скрипт НІКОЛИ не друкує значення — тільки імена змінних.
//
// REVALIDATE_SECRET навмисно потрапляє в ОБИДВА файли з тим самим значенням:
// API ним підписує прохання «перечитай сторінку», веб ним це прохання
// перевіряє. Розійдуться — публікація мовчки перестане оновлювати сайт.

import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readEnvFile(name) {
  const path = join(root, name);
  if (!existsSync(path)) return null;
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const neon = readEnvFile('.env.neon');
if (!neon) {
  console.error('Немає файлу .env.neon у корені репозиторію.');
  console.error('Створи його з двох рядків Neon:');
  console.error('  DATABASE_URL=<pooled>');
  console.error('  DIRECT_DATABASE_URL=<direct>');
  process.exit(1);
}

const local = readEnvFile('.env') ?? {};
const missing = ['DATABASE_URL', 'DIRECT_DATABASE_URL'].filter((k) => !neon[k]);
if (missing.length) {
  console.error(`У .env.neon бракує: ${missing.join(', ')}`);
  process.exit(1);
}

// Prisma спотикається на channel_binding; pgbouncer і ліміт зʼєднань
// обовʼязкові, бо кожен холодний старт функції відкриває нове зʼєднання.
function forPrismaPool(raw) {
  const url = new URL(raw);
  url.searchParams.delete('channel_binding');
  url.searchParams.set('sslmode', 'require');
  url.searchParams.set('pgbouncer', 'true');
  url.searchParams.set('connection_limit', '1');
  return url.toString();
}
function forPrismaDirect(raw) {
  const url = new URL(raw);
  url.searchParams.delete('channel_binding');
  url.searchParams.delete('pgbouncer');
  url.searchParams.delete('connection_limit');
  url.searchParams.set('sslmode', 'require');
  return url.toString();
}

const secret = () => randomBytes(48).toString('base64url');

// Секрети переживають повторний запуск: якщо їх уже вставлено у Vercel,
// нова генерація розлогінила б адмінку й довелося б вставляти все заново.
const previous = readEnvFile('vercel-api-env.txt') ?? {};
const keepOrMake = (key) => previous[key] || secret();

// Адреса сайту потрібна API, щоб було куди стукати після публікації.
// Коли зʼявиться власний домен — поміняти тут і в обох проєктах Vercel.
const webUrl = local['WEB_URL']
  || local['NEXT_PUBLIC_SITE_URL']
  || previous['WEB_URL']
  || 'https://kudos-web-ten.vercel.app';

const vars = {
  DATABASE_URL: forPrismaPool(neon['DATABASE_URL']),
  DIRECT_DATABASE_URL: forPrismaDirect(neon['DIRECT_DATABASE_URL']),
  JWT_ACCESS_SECRET: keepOrMake('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: keepOrMake('JWT_REFRESH_SECRET'),
  WEB_URL: webUrl,
  // base64url дає лише латиницю, цифри, «-» і «_» — рівно те, що можна
  // покласти в HTTP-заголовок. Кирилиця там фізично не проходить.
  REVALIDATE_SECRET: keepOrMake('REVALIDATE_SECRET'),
};
for (const key of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'MONOBANK_TOKEN', 'BLOB_READ_WRITE_TOKEN']) {
  const value = local[key];
  if (value && value !== '__replace_me__') vars[key] = value;
}

const body = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
writeFileSync(join(root, 'vercel-api-env.txt'), body, { mode: 0o600 });

// Вебу потрібен рівно один секрет — той самий.
const webVars = {
  REVALIDATE_SECRET: vars.REVALIDATE_SECRET,
  NEXT_PUBLIC_SITE_URL: webUrl,
};
const webBody = Object.entries(webVars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
writeFileSync(join(root, 'vercel-web-env.txt'), webBody, { mode: 0o600 });

console.log('Готово: vercel-api-env.txt і vercel-web-env.txt');
console.log('kudos-api:');
for (const key of Object.keys(vars)) console.log(`  ${key}`);
console.log('kudos-web:');
for (const key of Object.keys(webVars)) console.log(`  ${key}`);
const skipped = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'MONOBANK_TOKEN', 'BLOB_READ_WRITE_TOKEN'].filter((k) => !vars[k]);
if (skipped.length) console.log(`Не знайдено в .env, додай вручну: ${skipped.join(', ')}`);
