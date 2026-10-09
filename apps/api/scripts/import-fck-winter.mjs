#!/usr/bin/env node
/**
 * Колекція «F*ck winter» (жовтень 2026): нова колекція + 17 принтів.
 *
 * На кожен принт: обкладинка (фото на моделі) → previewUrl і перший кадр
 * галереї; артворк зі знаком «Бабака» → другий кадр; той самий малюнок без
 * знаку → mockupUrl для орієнтовного вигляду. Порода — з довідника (усі вже є).
 * Колекції дозволяються ті самі 7 опублікованих виробів, що й у «Polo Бабаки».
 *
 * Ассети готує tools/fck-winter-assets.py: <assets>/covers|prints|mockups/<slug>.webp.
 * Ідемпотентний: колекція й принти шукаються за слагом; повторний запуск
 * перезаливає картинки й оновлює рядки на місці.
 *
 *   node apps/api/scripts/import-fck-winter.mjs --env <файл.env> --assets <тека> [--publish] [--dry]
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';

const COLLECTION = {
  slug: 'fck-winter',
  title: 'F*ck winter',
  description: 'Коли у тебе хоробре серце і тепла шапка, ми не кажемо «важка зима», ми кажемо «F*ck you, winter»',
};
const SRC = 'icloud:kudos/БАБАКА/КОЛЕКЦІЇ/F*CK WINTER/F*CK WINTER (принти)';
const PRINTS = [
  ['Акіта', 'winter-akita', 'Акіта', ['akita-inu']],
  ['Ауссі', 'winter-aussi', 'Ауссі', ['aussi']],
  ['Вестік', 'winter-vestik', 'Вестік', ['vestik']],
  ['Джек рассел', 'winter-dzhek-rassel', 'Джек-рассел', ['dzhek-rassel']],
  ['Доберман', 'winter-doberman', 'Доберман', ['doberman']],
  ['Кане корсо', 'winter-kane-korso', 'Кане-корсо', ['kane-korso']],
  ['Коргі', 'winter-korhi', 'Коргі', ['korgi']],
  ['Ксоло', 'winter-ksolo', 'Ксоло', ['ksolo']],
  ['Лабрадор', 'winter-labrador', 'Лабрадор', ['labrador']],
  ['Левретка', 'winter-levretka', 'Левретка', ['levretka']],
  ['Пудель', 'winter-pudel', 'Пудель', ['pudel']],
  ['Ретривер', 'winter-retryver', 'Ретривер', ['retriver']],
  ['Самоїд', 'winter-samoid', 'Самоїд', ['samoyid']],
  ['Спаніель', 'winter-spaniel', 'Спанієль', ['koker-spaniel']],
  ['Фрнцуз', 'winter-frantsuz', 'Француз', ['frantsuzkyi-buldog']],
  ['Хаскі', 'winter-khaski', 'Хаскі', ['khaski']],
  ['Шпіц', 'winter-shpits', 'Шпіц', ['shpits']],
];
const SIZE_TIER = 'MAXI';
const RULES_FROM = 'polo-babaky';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1] ?? null; };
const DRY = args.includes('--dry');
const PUBLISH = args.includes('--publish');
const ASSETS = flag('--assets');
const envFile = flag('--env');
if (envFile) {
  const BARE = [['DATABASE_URL', /^postgres(ql)?:\/\//], ['BLOB_READ_WRITE_TOKEN', /^vercel_blob_rw_/]];
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*["']?([^"'\s]+)/);
    if (m) { process.env[m[1]] ??= m[2]; continue; }
    const v = line.trim().replace(/^["']|["']$/g, '');
    for (const [k, rx] of BARE) if (rx.test(v)) process.env[k] ??= v;
  }
}
const DB = process.env.DATABASE_URL ?? '';
const BLOB = process.env.BLOB_READ_WRITE_TOKEN ?? '';
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
if (!DB.startsWith('postgres')) fail('DATABASE_URL не задано.');
if (!DRY && !BLOB.startsWith('vercel_blob_rw')) fail('BLOB_READ_WRITE_TOKEN не задано.');
if (!ASSETS) fail('Вкажи --assets <тека з covers/ prints/ mockups/>');
const sql = neon(DB);

const upload = async (file, slug, kind) => put(`prints/${slug}/${kind}.webp`, readFileSync(file), {
  access: 'public', contentType: 'image/webp', addRandomSuffix: true, token: BLOB,
});

// перевірка файлів і порід до будь-якого запису
const breedId = new Map((await sql`SELECT id, slug FROM "Breed"`).map((r) => [r.slug, r.id]));
const problems = [];
for (const [, slug, , breeds] of PRINTS) {
  for (const k of ['covers', 'prints', 'mockups']) if (!existsSync(join(ASSETS, k, `${slug}.webp`))) problems.push(`${k}/${slug}.webp`);
  for (const b of breeds) if (!breedId.has(b)) problems.push(`порода ${b}`);
}
if (problems.length) fail(`бракує:\n  ${problems.join('\n  ')}`);

// колекція
let [col] = await sql`SELECT id FROM "Collection" WHERE slug = ${COLLECTION.slug}`;
const [{ pos }] = await sql`SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM "Collection"`;
if (DRY) console.log(`~ колекція ${COLLECTION.slug} ${col ? 'оновиться' : `створиться (position ${pos})`}`);
else if (col) {
  await sql`UPDATE "Collection" SET title = ${COLLECTION.title}, description = ${COLLECTION.description},
            ${PUBLISH ? sql`"isPublished" = true,` : sql``} "updatedAt" = now() WHERE id = ${col.id}`;
} else {
  [col] = await sql`INSERT INTO "Collection" (id, slug, title, description, position, "isPublished", "createdAt", "updatedAt")
            VALUES (${randomUUID()}, ${COLLECTION.slug}, ${COLLECTION.title}, ${COLLECTION.description}, ${pos}, ${PUBLISH}, now(), now())
            RETURNING id`;
}
if (!DRY) {
  await sql`INSERT INTO "PrintGarmentRule" (id, "collectionId", "garmentId")
            SELECT gen_random_uuid(), ${col.id}, r."garmentId" FROM "PrintGarmentRule" r
            JOIN "Collection" c ON c.id = r."collectionId" WHERE c.slug = ${RULES_FROM}
              AND NOT EXISTS (SELECT 1 FROM "PrintGarmentRule" x WHERE x."collectionId" = ${col.id} AND x."garmentId" = r."garmentId")`;
}

for (const [file, slug, title, breeds] of PRINTS) {
  const [row] = await sql`SELECT id FROM "Print" WHERE slug = ${slug}`;
  if (DRY) { console.log(`~ ${slug} «${title}» ${row ? 'оновиться' : 'створиться'} · ${breeds.join(', ')}`); continue; }
  const cover = await upload(join(ASSETS, 'covers', `${slug}.webp`), slug, 'cover');
  const art = await upload(join(ASSETS, 'prints', `${slug}.webp`), slug, 'art');
  const mock = await upload(join(ASSETS, 'mockups', `${slug}.webp`), slug, 'mockup');
  const id = row?.id ?? randomUUID();
  const artworkKey = `${SRC}/${file}_F_ck winter_принт.png`;
  await sql.transaction((tx) => [
    row
      ? tx`UPDATE "Print" SET title = ${title}, "previewUrl" = ${cover.url}, "mockupUrl" = ${mock.url},
              ${PUBLISH ? tx`"isPublished" = true,` : tx``} "updatedAt" = now() WHERE id = ${id}`
      : tx`INSERT INTO "Print" (id, slug, title, "sizeTier", "previewUrl", "artworkKey", "mockupUrl", "isPublished", "createdAt", "updatedAt")
           VALUES (${id}, ${slug}, ${title}, ${SIZE_TIER}::"PrintSizeTier", ${cover.url}, ${artworkKey}, ${mock.url}, ${PUBLISH}, now(), now())`,
    tx`DELETE FROM "PrintImage" WHERE "printId" = ${id}`,
    tx`INSERT INTO "PrintImage" (id, "printId", url, pathname, alt, position, "createdAt")
       VALUES (${randomUUID()}, ${id}, ${cover.url}, ${cover.pathname}, ${`${title} — на моделі`}, 0, now())`,
    tx`INSERT INTO "PrintImage" (id, "printId", url, pathname, alt, position, "createdAt")
       VALUES (${randomUUID()}, ${id}, ${art.url}, ${art.pathname}, ${title}, 1, now())`,
    tx`INSERT INTO "PrintCollection" ("printId", "collectionId") VALUES (${id}, ${col.id}) ON CONFLICT DO NOTHING`,
    tx`DELETE FROM "PrintBreed" WHERE "printId" = ${id}`,
    ...breeds.map((b) => tx`INSERT INTO "PrintBreed" ("printId", "breedId") VALUES (${id}, ${breedId.get(b)}) ON CONFLICT DO NOTHING`),
  ]);
  console.log(`✓ ${slug} «${title}»`);
}
console.log(DRY ? 'Сухий прогін, нічого не записано.' : `Готово: ${PRINTS.length} принтів у «${COLLECTION.title}»${PUBLISH ? ', опубліковано' : ' (чернетки)'}.`);
