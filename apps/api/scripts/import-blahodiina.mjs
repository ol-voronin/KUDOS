#!/usr/bin/env node
/**
 * Колекція «Благодійна Бабака» (листопад 2026): колекція + 10 принтів.
 *
 * Чим відрізняється від «F*ck winter»: тут принт — це готовий виріб
 * («Худі Animal Lovers Club», «Футболка Eyes&Noses»), а не малюнок, який
 * лягає на будь-що. Тому на кожен принт:
 *   • рівно один виріб (колекційне правило дозволяє три, а точкова заборона
 *     на принті прибирає два зайві) і, де треба, заборонені кольори;
 *   • фіксована ціна «принт + виріб» (2600 / 1600 / 1800 ₴) — див.
 *     Print.fixedPriceMinor;
 *   • абзац про благодійний внесок (Print.description) і свій текст
 *     «Виріб і друк» зі складом тканини (Print.productNote);
 *   • галерея з 3–6 фото (мокапи на моделях, без авто-мокапів — mockupUrl
 *     порожній), перше — обкладинка;
 *   • порода «Без породи» (створюється, якщо її ще нема).
 *
 * Ассети: <assets>/<slug>/1.webp … N.webp — їх робить convert.py з
 * icloud:kudos/БАБАКА/КОЛЕКЦІЇ/Благодійна Бабака (підтека _web).
 *
 * Ідемпотентний: колекція, порода й принти шукаються за слагом; повторний
 * запуск перезаливає картинки й оновлює рядки на місці. Створює ЧЕРНЕТКИ:
 * без --publish ні колекція, ні принти на сайті не видно.
 *
 *   node apps/api/scripts/import-blahodiina.mjs --env <файл.env> --assets <тека> [--publish] [--dry]
 *
 * Фото цієї колекції лежать у репо: apps/web/public/collections/blahodiina-babaka/
 * (4.9 МБ webp), а не в Blob, — так їх можна додати без токена сховища, і
 * вони їдуть на сайт разом із кодом. Тому за замовчуванням скрипт НЕ вантажить
 * нічого у Blob, а пише адреси від кореня сайту; --blob вмикає стару схему
 * (тоді потрібен BLOB_READ_WRITE_TOKEN).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';

const COLLECTION = {
  slug: 'blahodiina-babaka',
  title: 'Благодійна Бабака',
  description: 'Благодійна Бабака — це колекція речей, які популяризують культуру відповідального ставлення та любові до тварин. Обирай близький тобі сенс, носи із задоволенням і будь впевнений, що цією покупкою ти зробив внесок у добру справу разом з Бабакою.',
};
const BREED = { slug: 'bez-porody', name: 'Без породи' };
const SRC = 'icloud:kudos/БАБАКА/КОЛЕКЦІЇ/Благодійна Бабака';

/** Три вироби, на яких узагалі друкується ця колекція (PrintGarmentRule). */
const GARMENTS = ['hudi-oversayz', 'futbolka-oversayz-zhinocha', 'futbolka-oversayz-cholovicha'];

const CHARITY = (what) => `${what} допомагає популяризувати адопцію (взяття) тварин з притулків і водночас робить реальний внесок: 50% від прибутку Бабака перераховує у фонд Харківського КП «Центр поводження з тваринами» (Харківський міський притулок для безхатніх тварин).`;
const NOTE = {
  'hudi-oversayz': 'Худі оверсайз крою, утеплене ніжним тонким флісом, який не додає зайвого об’єму. Має двошаровий капюшон і мінімалістичні бічні кишені. Модель унісекс. Склад: 85% органічна бавовна та 15% перероблений поліестер, щільність 300 г/м². Принт DTF.',
  'futbolka-oversayz-zhinocha': 'Ніжна та легка футболка оверсайз. Має широкий, але вкорочений крій, що пасує жінкам. Склад: 100% органічна бавовна, щільність 180 г/м². Принт DTF.',
  'futbolka-oversayz-cholovicha': 'Щільна футболка оверсайз: широкий і подовжений крій, опущені плечі. Склад: 100% органічна бавовна, щільність 220 г/м². Принт DTF.',
};
const UAH = (n) => n * 100;

/**
 * [slug, назва, виріб, ціна ₴, дозволені кольори (supplierCode) або null = усі, файл-макет]
 * Порядок — як в інструкціях 2–11.
 */
const PRINTS = [
  ['hudi-animal-lovers-club', 'Худі Animal Lovers Club', 'hudi-oversayz', 2600, null, 'Худі Animal Lovers Club'],
  ['futbolka-animal-lovers-club', 'Футболка Animal Lovers Club', 'futbolka-oversayz-zhinocha', 1600, null, 'Футболка Animal Lovers Club'],
  ['hudi-eyes-noses', 'Худі Eyes&Noses', 'hudi-oversayz', 2600, null, 'Худі Eyes&Noses'],
  ['futbolka-eyes-noses', 'Футболка Eyes&Noses', 'futbolka-oversayz-cholovicha', 1800, ['chornyi', 'bilyi', 'derevianyi'], 'Футболка Eyes&Noses'],
  ['hudi-adopt-dont-shop', 'Худі Adopt, don’t shop', 'hudi-oversayz', 2600, null, 'Худі Adopt, don’t shop'],
  ['futbolka-adopt-dont-shop', 'Футболка Adopt, don’t shop', 'futbolka-oversayz-cholovicha', 1800, null, 'Футболка Adopt, don’t shop'],
  ['hudi-animals', 'Худі A.N.I.M.A.L.S', 'hudi-oversayz', 2600, null, 'Худі A.N.I.M.A.L.S'],
  ['futbolka-animals', 'Футболка A.N.I.M.A.L.S', 'futbolka-oversayz-zhinocha', 1600, ['chornyi', 'bilyi'], 'Футболка A.N.I.M.A.L.S'],
  ['hudi-stan-vsesvitom', 'Худі Стань Всесвітом', 'hudi-oversayz', 2600, null, 'Худі Стань Всесвітом'],
  ['futbolka-stan-vsesvitom', 'Футболка Стань Всесвітом', 'futbolka-oversayz-zhinocha', 1600, ['chornyi', 'bilyi'], 'Футболка Стань Всесвітом'],
];
const SIZE_TIER = 'MAXI';
const MAX_IMAGES = 6;

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1] ?? null; };
const DRY = args.includes('--dry');
const PUBLISH = args.includes('--publish');
const USE_BLOB = args.includes('--blob');
const PUBLIC_BASE = '/collections/blahodiina-babaka';
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
if (!DRY && USE_BLOB && !BLOB.startsWith('vercel_blob_rw')) fail('BLOB_READ_WRITE_TOKEN не задано.');
if (!ASSETS) fail('Вкажи --assets <тека з <slug>/1.webp…>');
const sql = neon(DB);

const upload = async (file, slug, name) => USE_BLOB
  ? put(`prints/${slug}/${name}.webp`, readFileSync(file), { access: 'public', contentType: 'image/webp', addRandomSuffix: true, token: BLOB })
  // pathname тут — той самий шлях: адмінка при видаленні спробує del() у Blob,
  // не знайде й позначить файл осиротілим — це штатна гілка, нічого не ламає.
  : { url: `${PUBLIC_BASE}/${slug}/${name}.webp`, pathname: `${PUBLIC_BASE}/${slug}/${name}.webp` };
const imagesOf = (slug) => {
  const dir = join(ASSETS, slug);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^\d+\.webp$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b)).map((f) => join(dir, f));
};

// довідники й перевірки — до будь-якого запису
const garmentId = new Map((await sql`SELECT id, slug FROM "Garment"`).map((r) => [r.slug, r.id]));
const colourId = new Map((await sql`SELECT id, "supplierCode" FROM "Colour"`).map((r) => [r.supplierCode, r.id]));
// Кольори, у яких виріб справді шиється: заборона потрібна лише серед них.
const garmentColours = new Map();
for (const r of await sql`SELECT DISTINCT g.slug, c."supplierCode" AS code FROM "Variant" v
    JOIN "Garment" g ON g.id = v."garmentId" JOIN "Colour" c ON c.id = v."colourId"`) {
  if (!garmentColours.has(r.slug)) garmentColours.set(r.slug, []);
  garmentColours.get(r.slug).push(r.code);
}
const [{ n: hasNewColumns }] = await sql`SELECT count(*)::int AS n FROM information_schema.columns
  WHERE table_name = 'Print' AND column_name IN ('description', 'productNote', 'fixedPriceMinor')`;
const problems = [];
if (hasNewColumns !== 3) problems.push('у таблиці Print ще немає description/productNote/fixedPriceMinor — спершу міграція 20261030230000');
for (const g of GARMENTS) if (!garmentId.has(g)) problems.push(`виріб ${g}`);
for (const [slug, , garment, , colours] of PRINTS) {
  const imgs = imagesOf(slug);
  if (imgs.length === 0) problems.push(`${slug}/1.webp`);
  if (imgs.length > MAX_IMAGES) problems.push(`${slug}: ${imgs.length} фото, ліміт ${MAX_IMAGES}`);
  if (!GARMENTS.includes(garment)) problems.push(`${slug}: виріб ${garment} не в списку колекції`);
  for (const c of colours ?? []) if (!(garmentColours.get(garment) ?? []).includes(c)) problems.push(`${slug}: ${garment} не шиється в кольорі ${c}`);
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
// правило колекції: ці три вироби й більше нічого
if (!DRY) {
  for (const g of GARMENTS) {
    await sql`INSERT INTO "PrintGarmentRule" (id, "collectionId", "garmentId") VALUES (${randomUUID()}, ${col.id}, ${garmentId.get(g)})
              ON CONFLICT ("collectionId", "garmentId") DO NOTHING`;
  }
}

// порода «Без породи»
let [breed] = await sql`SELECT id FROM "Breed" WHERE slug = ${BREED.slug}`;
if (DRY) console.log(`~ порода ${BREED.slug} ${breed ? 'є' : 'створиться'}`);
else if (!breed) {
  [breed] = await sql`INSERT INTO "Breed" (id, slug, name, synonyms, "createdAt", "updatedAt")
            VALUES (${randomUUID()}, ${BREED.slug}, ${BREED.name}, ${['безпородний', 'дворняга', 'метис']}, now(), now()) RETURNING id`;
}

for (const [slug, title, garment, priceUah, colours, file] of PRINTS) {
  const [row] = await sql`SELECT id FROM "Print" WHERE slug = ${slug}`;
  const imgs = imagesOf(slug);
  const what = title.startsWith('Худі') ? 'Цей худі' : 'Ця футболка';
  if (DRY) { console.log(`~ ${slug} «${title}» ${row ? 'оновиться' : 'створиться'} · ${garment} · ${priceUah} ₴ · ${imgs.length} фото · кольори: ${colours ? colours.join(', ') : 'усі'}`); continue; }

  const uploaded = [];
  for (let i = 0; i < imgs.length; i++) uploaded.push(await upload(imgs[i], slug, String(i + 1)));
  const cover = uploaded[0];
  const id = row?.id ?? randomUUID();
  const artworkKey = `${SRC}/${file}`;
  const bannedGarments = GARMENTS.filter((g) => g !== garment).map((g) => garmentId.get(g));
  const bannedColours = colours === null ? [] : garmentColours.get(garment).filter((code) => !colours.includes(code)).map((code) => colourId.get(code));

  await sql.transaction((tx) => [
    row
      ? tx`UPDATE "Print" SET title = ${title}, "previewUrl" = ${cover.url}, "mockupUrl" = '',
              description = ${CHARITY(what)}, "productNote" = ${NOTE[garment]}, "fixedPriceMinor" = ${UAH(priceUah)},
              ${PUBLISH ? tx`"isPublished" = true,` : tx``} "updatedAt" = now() WHERE id = ${id}`
      : tx`INSERT INTO "Print" (id, slug, title, "sizeTier", "previewUrl", "artworkKey", "mockupUrl", description, "productNote", "fixedPriceMinor", "isPublished", "createdAt", "updatedAt")
           VALUES (${id}, ${slug}, ${title}, ${SIZE_TIER}::"PrintSizeTier", ${cover.url}, ${artworkKey}, '', ${CHARITY(what)}, ${NOTE[garment]}, ${UAH(priceUah)}, ${PUBLISH}, now(), now())`,
    tx`DELETE FROM "PrintImage" WHERE "printId" = ${id}`,
    ...uploaded.map((u, i) => tx`INSERT INTO "PrintImage" (id, "printId", url, pathname, alt, position, "createdAt")
       VALUES (${randomUUID()}, ${id}, ${u.url}, ${u.pathname}, ${i === 0 ? `${title} — на моделі` : title}, ${i}, now())`),
    tx`INSERT INTO "PrintCollection" ("printId", "collectionId") VALUES (${id}, ${col.id}) ON CONFLICT DO NOTHING`,
    tx`DELETE FROM "PrintBreed" WHERE "printId" = ${id}`,
    tx`INSERT INTO "PrintBreed" ("printId", "breedId") VALUES (${id}, ${breed.id}) ON CONFLICT DO NOTHING`,
    // один виріб: решта два з правила колекції — під точкову заборону
    tx`DELETE FROM "PrintGarmentExclusion" WHERE "printId" = ${id}`,
    ...bannedGarments.map((gid) => tx`INSERT INTO "PrintGarmentExclusion" ("printId", "garmentId", reason, "createdAt")
       VALUES (${id}, ${gid}, 'Благодійна Бабака: принт продається лише з одним виробом', now()) ON CONFLICT DO NOTHING`),
    tx`DELETE FROM "PrintColourExclusion" WHERE "printId" = ${id}`,
    ...bannedColours.map((cid) => tx`INSERT INTO "PrintColourExclusion" ("printId", "colourId", reason, "createdAt")
       VALUES (${id}, ${cid}, 'Благодійна Бабака: кольори за інструкцією', now()) ON CONFLICT DO NOTHING`),
  ]);
  console.log(`✓ ${slug} «${title}» · ${uploaded.length} фото`);
}
console.log(DRY ? 'Сухий прогін, нічого не записано.' : `Готово: ${PRINTS.length} принтів у «${COLLECTION.title}»${PUBLISH ? ', опубліковано' : ' (чернетки)'}.`);
