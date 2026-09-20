#!/usr/bin/env node
/**
 * Оновлення каталогу під бренд «Бабака» (вересень 2026).
 *
 * Що робить:
 *   1. перейменовує 4 колекції (назва + слаг), лишаючи старі адреси на редиректи;
 *   2. дає принтам людські назви з породами замість «Пес ін POLO №23»;
 *   3. заливає обложки — фото принта на моделі — і робить їх ОБКЛАДИНКОЮ
 *      (те, що видно в каталозі) та першим кадром галереї;
 *   4. перезаливає всі артворки з водяним знаком «Бабака» по центру,
 *      а поруч — той самий малюнок без знаку як макет для авто-мокапів;
 *   5. чіпляє породи до кожного принта, створюючи ті, яких ще немає;
 *   6. знімає з публікації службовий PET PARENT.
 *
 * Ідемпотентний: повторний запуск нічого не дублює — зображення перезаливаються
 * (у Blob лишаються сироти, це нормально), решта оновлюється на місці.
 *
 * Запуск із кореня репо:
 *   node apps/api/scripts/sync-babaka.mjs --env ../dt-access.env --assets ../babaka-assets
 *   (--dry — показати план без жодного запису)
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';

// ── маніфест ───────────────────────────────────────────────────────────────

/** Старий слаг колекції → нові назва і слаг. */
const COLLECTIONS = [
  { was: 'pesy-zirky', slug: 'zirky-z-babakamy', title: 'Зірки з Бабаками' },
  { was: 'ua-diiachi', slug: 'babaka-ua', title: 'Бабака UA' },
  { was: 'pes-pub', slug: 'babaky-v-pabi', title: 'Бабаки в пабі' },
  { was: 'polo-style', slug: 'polo-babaky', title: 'Polo Бабаки' },
];

/**
 * Породи, яких ще немає в довіднику. Синоніми — те, як люди справді шукають:
 * саме за ними працює пошук і автопідбір, а не за офіційною назвою з
 * кінологічного стандарту.
 */
const NEW_BREEDS = [
  { slug: 'maltese', name: 'Мальтезе', synonyms: ['мальтійська болонка', 'мальтезе', 'maltese'] },
  { slug: 'bishon-frize', name: 'Бішон фризе', synonyms: ['бішон', 'bichon'] },
  { slug: 'levretka', name: 'Левретка', synonyms: ['італійський грейхаунд', 'левретка'] },
  { slug: 'dalmatynets', name: 'Далматинець', synonyms: ['далматин', 'dalmatian'] },
  { slug: 'ksolo', name: 'Ксолоїтцкуїнтлі', synonyms: ['ксоло', 'мексиканська гола', 'xolo'] },
  { slug: 'rotveiler', name: 'Ротвейлер', synonyms: ['ротвейлер', 'rottweiler'] },
  { slug: 'honchak', name: 'Гончак', synonyms: ['гончак', 'український гончак'] },
  { slug: 'karpatska-vivcharka', name: 'Карпатська вівчарка', synonyms: ['карпатська вівчарка', 'карпатка'] },
  { slug: 'toi-terier', name: 'Той-тер’єр', synonyms: ['той тер’єр', 'той', 'той-терьер'] },
  { slug: 'velykyi-dog', name: 'Німецький дог', synonyms: ['дог', 'great dane'] },
];

/**
 * Принти. `was` — слаг, під яким принт лежить у базі зараз; `slug` — новий
 * (для Polo змінюється, решта лишається). Файли шукаються за слагом у теці
 * ассетів: covers/, prints/ (зі знаком) і mockups/ (без знаку).
 */
const PRINTS = [
  // ── Polo Бабаки: нові слаги, нові артворки, нові обложки ────────────────
  { was: 'polo-01', slug: 'polo-siba-inu', title: 'Сіба іну', breeds: ['siba-inu'] },
  { was: 'polo-02', slug: 'polo-toi-pudel', title: 'Той пудель', breeds: ['pudel'] },
  { was: 'polo-03', slug: 'polo-maltese', title: 'Мальтезе', breeds: ['maltese'] },
  { was: 'polo-04', slug: 'polo-shpits', title: 'Шпіц', breeds: ['shpits'] },
  { was: 'polo-05', slug: 'polo-korhi', title: 'Коргі', breeds: ['korgi'] },
  { was: 'polo-06', slug: 'polo-kavaler-charlz', title: 'Кавалер Чарльз спанієль', breeds: ['kavaler-charlz'] },
  { was: 'polo-07', slug: 'polo-mops', title: 'Мопс', breeds: ['mops'] },
  { was: 'polo-08', slug: 'polo-chikhuakhua', title: 'Чихуахуа', breeds: ['chihuahua'] },
  { was: 'polo-09', slug: 'polo-dzhek-rassel', title: 'Джек-рассел', breeds: ['dzhek-rassel'] },
  { was: 'polo-10', slug: 'polo-bishon-frize', title: 'Бішон фризе', breeds: ['bishon-frize'] },
  { was: 'polo-11', slug: 'polo-taksa', title: 'Такса', breeds: ['taksa'] },
  { was: 'polo-12', slug: 'polo-retryver', title: 'Ретривер', breeds: ['retriver'] },
  { was: 'polo-13', slug: 'polo-doberman', title: 'Доберман', breeds: ['doberman'] },
  { was: 'polo-14', slug: 'polo-tsverhshnautser', title: 'Цвергшнауцер', breeds: ['tsvergshnautser'] },
  { was: 'polo-15', slug: 'polo-bihl', title: 'Бігль', breeds: ['bigl'] },
  { was: 'polo-16', slug: 'polo-vestik', title: 'Вестік', breeds: ['vestik'] },
  { was: 'polo-17', slug: 'polo-levretka', title: 'Левретка', breeds: ['levretka'] },
  { was: 'polo-18', slug: 'polo-samoid', title: 'Самоїд', breeds: ['samoyid'] },
  { was: 'polo-19', slug: 'polo-dalmatyn', title: 'Далматинець', breeds: ['dalmatynets'] },
  { was: 'polo-20', slug: 'polo-ksolo', title: 'Ксоло', breeds: ['ksolo'] },
  { was: 'polo-21', slug: 'polo-bulterier', title: 'Бультер’єр', breeds: ['bulteryer'] },
  { was: 'polo-22', slug: 'polo-labrador', title: 'Лабрадор', breeds: ['labrador'] },
  { was: 'polo-23', slug: 'polo-amstaf', title: 'Амстаф', breeds: ['staford'] },
  { was: 'polo-24', slug: 'polo-frantsuz', title: 'Француз', breeds: ['frantsuzkyi-buldog'] },

  // ── Бабаки в пабі: слаг лишається, назва людська, артворк той самий ─────
  { was: 'pab-akita-i-siba', title: 'Акіта і сіба іну', breeds: ['akita-inu', 'siba-inu'] },
  { was: 'pab-amstaf', title: 'Амстаф', breeds: ['staford'] },
  { was: 'pab-bihl', title: 'Бігль', breeds: ['bigl'] },
  { was: 'pab-bulterier', title: 'Бультер’єр', breeds: ['bulteryer'] },
  { was: 'pab-vestik', title: 'Вестік', breeds: ['vestik'] },
  { was: 'pab-vivcharka-i-kane-korso', title: 'Вівчарка і кане-корсо', breeds: ['nimetska-vivcharka', 'kane-korso'] },
  { was: 'pab-dalmatynets', title: 'Далматинець', breeds: ['dalmatynets'] },
  { was: 'pab-dzhek-rassel', title: 'Джек-рассел', breeds: ['dzhek-rassel'] },
  { was: 'pab-doberman', title: 'Доберман', breeds: ['doberman'] },
  { was: 'pab-york', title: 'Йорк', breeds: ['yorkshyrskyi-terier'] },
  { was: 'pab-korhi', title: 'Коргі', breeds: ['korgi'] },
  { was: 'pab-labrador', title: 'Лабрадор', breeds: ['labrador'] },
  { was: 'pab-lievrietka-i-doh', title: 'Дог і левретка', breeds: ['velykyi-dog', 'levretka'] },
  { was: 'pab-maltipu-i-kavaler', title: 'Мальтіпу і кавалер чарльз спанієль', breeds: ['maltipu', 'kavaler-charlz'] },
  { was: 'pab-mops', title: 'Мопс', breeds: ['mops'] },
  { was: 'pab-retryver', title: 'Ретривер', breeds: ['retriver'] },
  { was: 'pab-rotveiler', title: 'Ротвейлер', breeds: ['rotveiler'] },
  { was: 'pab-samoid', title: 'Самоїд', breeds: ['samoyid'] },
  { was: 'pab-taksa-i-york', title: 'Такса і йорк', breeds: ['taksa', 'yorkshyrskyi-terier'] },
  { was: 'pab-frantsuz', title: 'Француз', breeds: ['frantsuzkyi-buldog'] },
  { was: 'pab-tsverhshnautser', title: 'Цвергшнауцер', breeds: ['tsvergshnautser'] },
  { was: 'pab-chikhuakhua-i-toi', title: 'Чихуахуа і той-тер’єр', breeds: ['chihuahua', 'toi-terier'] },
  { was: 'pab-shpits', title: 'Шпіц', breeds: ['shpits'] },

  // ── Бабака UA ───────────────────────────────────────────────────────────
  { was: 'ua-bandera', title: 'Бандера', breeds: ['dzhek-rassel'] },
  { was: 'ua-kozak', title: 'Козак', breeds: ['vestik'] },
  { was: 'ua-skovoroda', title: 'Сковорода', breeds: ['honchak'] },
  { was: 'ua-franko', title: 'Франко', breeds: ['karpatska-vivcharka'] },
  { was: 'ua-shevchenko', title: 'Шевченко', breeds: ['taksa'] },

  // ── Зірки з Бабаками ────────────────────────────────────────────────────
  { was: 'zirky-blondynka', title: 'Білявка в законі', breeds: ['doberman', 'chihuahua'] },
  { was: 'zirky-vitni', title: 'Вітні Х’юстон', breeds: ['maltipu'] },
  { was: 'zirky-dzheki-chan', title: 'Джекі Чан', breeds: ['mops'] },
  { was: 'zirky-dzhon-vik', title: 'Джон Вік', breeds: ['staford'] },
  { was: 'zirky-krasunia-maltipu', title: 'Красуня і мальтіпу', breeds: ['maltipu'] },
  { was: 'zirky-krasunia-spaniel', title: 'Красуня і спанієль', breeds: ['koker-spaniel'] },
  { was: 'zirky-maikl-dark', title: 'Майкл — на темне', breeds: ['vestik'] },
  { was: 'zirky-maikl-light', title: 'Майкл — на світле', breeds: ['vestik'] },
  { was: 'zirky-merlin', title: 'Мерлін', breeds: ['chihuahua'] },
  { was: 'zirky-mister-bin-1', title: 'Містер Бін №1', breeds: ['chihuahua'] },
  { was: 'zirky-mister-bin-2', title: 'Містер Бін №2', breeds: ['chihuahua'] },
  { was: 'zirky-odri', title: 'Одрі в Тіфані', breeds: ['doberman'] },
  { was: 'zirky-semiuel', title: 'Семюел Джексон', breeds: ['frantsuzkyi-buldog'] },
  { was: 'zirky-dogs', title: 'D.O.G.S', breeds: [] },
  { was: 'zirky-the-crown', title: 'The Crown', breeds: ['korgi'] },
];

/** Службовий напис, який не має бути окремим товаром. */
const UNPUBLISH = ['zirky-pet-parent'];

// ── механіка ───────────────────────────────────────────────────────────────

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
if (!ASSETS) fail('Вкажи --assets <тека з covers/ і prints/>');

const sql = neon(DB);

async function upload(file, slug, kind) {
  const bytes = readFileSync(file);
  const blob = await put(`prints/${slug}/${kind}.webp`, bytes, {
    access: 'public', contentType: 'image/webp', addRandomSuffix: true, token: BLOB,
  });
  return blob;
}

// 1. Породи, яких бракує.
const have = new Set((await sql`SELECT slug FROM "Breed"`).map((r) => r.slug));
let breedsAdded = 0;
for (const b of NEW_BREEDS) {
  if (have.has(b.slug)) continue;
  if (!DRY) {
    await sql`INSERT INTO "Breed" (id, slug, name, synonyms, "createdAt", "updatedAt")
              VALUES (${randomUUID()}, ${b.slug}, ${b.name}, ${b.synonyms}, now(), now())
              ON CONFLICT (slug) DO NOTHING`;
  }
  breedsAdded += 1;
}
const breedId = new Map((await sql`SELECT id, slug FROM "Breed"`).map((r) => [r.slug, r.id]));

// 2. Колекції.
const colResults = [];
for (const c of COLLECTIONS) {
  const rows = await sql`SELECT id, slug, title FROM "Collection" WHERE slug = ${c.was} OR slug = ${c.slug}`;
  if (rows.length === 0) { colResults.push(`${c.was}: НЕМАЄ`); continue; }
  if (!DRY) {
    await sql`UPDATE "Collection" SET slug = ${c.slug}, title = ${c.title}, "updatedAt" = now() WHERE id = ${rows[0].id}`;
  }
  colResults.push(`${rows[0].slug} → ${c.slug} «${c.title}»`);
}

// 3. Принти.
let updated = 0; const missing = []; const noBreed = [];
for (const p of PRINTS) {
  const slug = p.slug ?? p.was;
  const rows = await sql`SELECT id, slug FROM "Print" WHERE slug = ${p.was} OR slug = ${slug}`;
  if (rows.length === 0) { missing.push(p.was); continue; }
  const id = rows[0].id;

  const coverFile = join(ASSETS, 'covers', `${slug}.webp`);
  const artFile = join(ASSETS, 'prints', `${slug}.webp`);
  // Макет для авто-мокапів — той самий малюнок, але БЕЗ водяного знака:
  // на виробі знак виглядав би як брак друку. Красти там нема чого — 900px.
  const mockFile = join(ASSETS, 'mockups', `${slug}.webp`);
  if (!existsSync(coverFile)) { missing.push(`cover ${slug}`); continue; }
  // Водяний знак наклали на ВСІ артворки, тож перезаливаємо кожен, для якого
  // є файл. Якщо файла нема — лишаємо те, що вже в Blob (і кажемо про це).
  const hasArt = existsSync(artFile) && existsSync(mockFile);
  if (!hasArt) missing.push(`art/mockup ${slug} — лишили старий`);

  const ids = (p.breeds ?? []).map((b) => breedId.get(b)).filter(Boolean);
  if ((p.breeds ?? []).length !== ids.length) noBreed.push(`${slug}: ${p.breeds.join(', ')}`);

  if (DRY) {
    console.log(`~ ${rows[0].slug} → ${slug} «${p.title}»${hasArt ? ' +артворк зі знаком' : ''} · порід ${ids.length}`);
    updated += 1;
    continue;
  }

  const cover = await upload(coverFile, slug, 'cover');
  const art = hasArt ? await upload(artFile, slug, 'art') : null;
  const mock = hasArt ? await upload(mockFile, slug, 'mockup') : null;

  // Обкладинка — фото на моделі; артворк лишається другим кадром і макетом
  // для авто-мокапів. Якщо артворк не перезаливали, беремо той, що вже є.
  const old = await sql`SELECT url, pathname, alt FROM "PrintImage" WHERE "printId" = ${id} ORDER BY position LIMIT 5`;
  const keepArt = art ?? (old.length > 0 ? { url: old[old.length - 1].url, pathname: old[old.length - 1].pathname } : null);

  await sql.transaction((tx) => {
    const ops = [
      tx`UPDATE "Print" SET slug = ${slug}, title = ${p.title}, "previewUrl" = ${cover.url},
             ${hasArt ? tx`"mockupUrl" = ${mock.url},` : tx``} "updatedAt" = now()
         WHERE id = ${id}`,
      tx`DELETE FROM "PrintImage" WHERE "printId" = ${id}`,
      tx`INSERT INTO "PrintImage" (id, "printId", url, pathname, alt, position, "createdAt")
         VALUES (${randomUUID()}, ${id}, ${cover.url}, ${cover.pathname}, ${`${p.title} — на моделі`}, 0, now())`,
      tx`DELETE FROM "PrintBreed" WHERE "printId" = ${id}`,
    ];
    if (keepArt) {
      ops.push(tx`INSERT INTO "PrintImage" (id, "printId", url, pathname, alt, position, "createdAt")
                  VALUES (${randomUUID()}, ${id}, ${keepArt.url}, ${keepArt.pathname}, ${p.title}, 1, now())`);
    }
    for (const b of ids) {
      ops.push(tx`INSERT INTO "PrintBreed" ("printId", "breedId") VALUES (${id}, ${b}) ON CONFLICT DO NOTHING`);
    }
    return ops;
  });

  updated += 1;
  console.log(`✓ ${slug} «${p.title}»`);
}

// 4. Службові принти геть із вітрини.
if (!DRY) {
  for (const slug of UNPUBLISH) {
    await sql`UPDATE "Print" SET "isPublished" = false, "updatedAt" = now() WHERE slug = ${slug}`;
  }
  // Тестова порода з часів налаштування — щоб не світилась у фільтрах.
  await sql`DELETE FROM "Breed" WHERE slug = 'new-oleksii'
            AND NOT EXISTS (SELECT 1 FROM "PrintBreed" pb JOIN "Breed" b ON b.id = pb."breedId" WHERE b.slug = 'new-oleksii')`;
}

console.log(`\nКолекції:\n  ${colResults.join('\n  ')}`);
console.log(`Порід додано: ${breedsAdded}. Принтів оновлено: ${updated} з ${PRINTS.length}.`);
if (missing.length) console.log(`НЕ ЗНАЙДЕНО:\n  ${missing.join('\n  ')}`);
if (noBreed.length) console.log(`Породи не зіставились:\n  ${noBreed.join('\n  ')}`);
if (!DRY) console.log('Готово. Далі — прогрів сторінок (зробить Claude).');
