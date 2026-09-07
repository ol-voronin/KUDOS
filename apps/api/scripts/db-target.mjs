#!/usr/bin/env node
// Друкує, НА ЯКУ БАЗУ зараз дивиться Prisma, перш ніж щось у неї котити.
//
// Урок, оплачений годиною лежачого прода (07.09.2026): `db:deploy` читає
// apps/api/.env, а там localhost — тож «All migrations applied» стосувалося
// локального docker-постгреса, поки Neon сидів без нових колонок і сайт
// відповідав 500. Цей скрипт робить ціль видимою в кожному запуску.
//
// Прод (Neon) мігрується ТІЛЬКИ через `bash scripts/setup-neon.sh` з кореня —
// він бере адресу з .env.neon.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function readEnvFile(path) {
  const out = {};
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return out;
  }
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

// Той самий порядок, що в Prisma CLI: спершу середовище, потім .env поруч зі
// схемою (apps/api/.env).
const fileEnv = readEnvFile(resolve(here, '..', '.env'));
const url = process.env.DATABASE_URL ?? fileEnv.DATABASE_URL ?? '';

let host = '(не задано)';
let db = '';
try {
  const parsed = new URL(url);
  host = parsed.host;
  db = parsed.pathname.replace('/', '');
} catch {
  if (url !== '') host = '(нерозбірливий DATABASE_URL)';
}

const isLocal = /localhost|127\.0\.0\.1/.test(host);
console.log('──────────────────────────────────────────────────');
console.log(`Ціль міграції: ${host}${db ? ` · база "${db}"` : ''}`);
if (isLocal) {
  console.log('⚠️  Це ЛОКАЛЬНА база (apps/api/.env), НЕ прод!');
  console.log('   Neon мігрується так:  bash scripts/setup-neon.sh');
}
console.log('──────────────────────────────────────────────────');
