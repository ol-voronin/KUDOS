// Готує блок змінних для вставки у Vercel -> kudos-api -> Environment Variables.
//
//   node scripts/vercel-env.mjs
//
// Читає рядки Neon з .env.neon, решту — з .env, генерує JWT-секрети
// і складає все у vercel-api-env.txt. Обидва вихідні файли в .gitignore.
// Скрипт НІКОЛИ не друкує значення — тільки імена змінних.

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

const vars = {
  DATABASE_URL: forPrismaPool(neon['DATABASE_URL']),
  DIRECT_DATABASE_URL: forPrismaDirect(neon['DIRECT_DATABASE_URL']),
  JWT_ACCESS_SECRET: keepOrMake('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: keepOrMake('JWT_REFRESH_SECRET'),
};
for (const key of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'MONOBANK_TOKEN', 'BLOB_READ_WRITE_TOKEN']) {
  const value = local[key];
  if (value && value !== '__replace_me__') vars[key] = value;
}

const body = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
writeFileSync(join(root, 'vercel-api-env.txt'), body, { mode: 0o600 });

console.log('Готово: vercel-api-env.txt');
console.log('Змінні у файлі:');
for (const key of Object.keys(vars)) console.log(`  ${key}`);
const skipped = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'MONOBANK_TOKEN', 'BLOB_READ_WRITE_TOKEN'].filter((k) => !vars[k]);
if (skipped.length) console.log(`Не знайдено в .env, додай вручну: ${skipped.join(', ')}`);
