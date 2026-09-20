#!/usr/bin/env node
/**
 * Заливає фотографії порід і чіпляє їх до довідника.
 *
 * Плитка породи досі показувала превʼю одного з її принтів, і виходило коло:
 * щоб зрозуміти, як виглядає такса, людина дивилась на малюнок такси в
 * капелюсі. Фото відповідає на питання «це моя собака?» за пів секунди.
 *
 * Файли беруться за слагом породи: <assets>/breeds/<slug>.webp. Порода без
 * файла просто не чіпається — поле nullable, і плитка падає назад на принт,
 * тож довідник можна заповнювати поступово.
 *
 * Запуск із кореня репо:
 *   node apps/api/scripts/sync-breed-photos.mjs --env ../dt-access.env --assets ../babaka-assets
 *   (--dry — показати, що знайшлося, без жодного запису)
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1] ?? null; };
const DRY = args.includes('--dry');
const ASSETS = flag('--assets');
const envFile = flag('--env');

if (envFile) {
  const BARE = [
    ['DATABASE_URL', /^postgres(ql)?:\/\//],
    ['BLOB_READ_WRITE_TOKEN', /^vercel_blob_rw_/],
    ['GITHUB_TOKEN', /^(github_pat_|ghp_)/],
  ];
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*["']?([^"'\s]+)/);
    if (m) { if (!process.env[m[1]]) process.env[m[1]] = m[2]; continue; }
    const v = line.trim().replace(/^["']|["']$/g, '');
    for (const [key, rx] of BARE) if (rx.test(v) && !process.env[key]) process.env[key] = v;
  }
}

const DB = process.env.DATABASE_URL ?? '';
const BLOB = process.env.BLOB_READ_WRITE_TOKEN ?? '';
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
if (!DB.startsWith('postgres')) fail('DATABASE_URL не задано.');
if (!DRY && !BLOB.startsWith('vercel_blob_rw')) fail('BLOB_READ_WRITE_TOKEN не задано.');
if (!ASSETS) fail('Вкажи --assets <тека, всередині якої breeds/>');

const dir = join(ASSETS, 'breeds');
if (!existsSync(dir)) fail(`Немає теки ${dir}. Поклади туди <slug>.webp.`);

const sql = neon(DB);
const breeds = await sql`SELECT id, slug, name FROM "Breed" ORDER BY name`;
const bySlug = new Map(breeds.map((b) => [b.slug, b]));

const files = readdirSync(dir).filter((f) => f.endsWith('.webp'));
const unknown = [];
let done = 0;

for (const file of files) {
  const slug = file.replace(/\.webp$/, '');
  const breed = bySlug.get(slug);
  if (!breed) { unknown.push(slug); continue; }

  if (DRY) { console.log(`~ ${slug} → «${breed.name}»`); done += 1; continue; }

  const blob = await put(`breeds/${slug}.webp`, readFileSync(join(dir, file)), {
    access: 'public', contentType: 'image/webp', addRandomSuffix: true, token: BLOB,
  });
  await sql`UPDATE "Breed" SET "photoUrl" = ${blob.url}, "updatedAt" = now() WHERE id = ${breed.id}`;
  console.log(`✓ ${slug} «${breed.name}»`);
  done += 1;
}

const without = breeds.filter((b) => !files.includes(`${b.slug}.webp`)).map((b) => b.slug);
console.log(`\nФото поставлено: ${done} з ${breeds.length} порід.`);
if (unknown.length) console.log(`Файли без породи в базі:\n  ${unknown.join('\n  ')}`);
if (without.length) console.log(`Ще без фото (покажуть принт):\n  ${without.join(', ')}`);
