#!/usr/bin/env node
/**
 * Разовий імпорт принтів чотирьох колекцій (вересень 2026) У ЧЕРНЕТКИ.
 *
 * Що робить, по кроках, на кожен принт із MANIFEST:
 *   1. заливає webp у Vercel Blob тим самим шляхом, що й адмінка
 *      (`prints/<slug>/…`, addRandomSuffix);
 *   2. створює Print із isPublished=false — на сайті НЕ з'являється,
 *      в адмінці лежить чернеткою, публікує людина після перегляду;
 *   3. чіпляє колекцію та, для «Пес і паб», породи за назвою.
 *
 * Чому raw SQL через @neondatabase/serverless, а не Prisma: скрипт має
 * працювати і з sandbox-середовищ, де TCP 5432 закритий, а Prisma-движки
 * не запускаються; HTTP-драйвер Neon працює звідусіль.
 *
 * Ідемпотентність: принт зі слагом, який уже існує, пропускається цілком —
 * скрипт можна ганяти повторно після обриву без дублікатів.
 *
 * Запуск (з кореня репо):
 *   DATABASE_URL=… BLOB_READ_WRITE_TOKEN=… \
 *     node apps/api/scripts/import-prints.mjs --assets <тека з webp>
 *   або: node apps/api/scripts/import-prints.mjs --env <файл.env> --assets <тека>
 *
 * `--assets` чекає підтеки celebrity/ ua/ pub/ polo/ з файлами з MANIFEST.
 * `--dry` — показати план без жодного запису.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';

/** slug колекції в базі → тека в assets. */
const COLLECTIONS = {
  celebrity: 'pesy-zirky',
  ua: 'ua-diiachi',
  pub: 'pes-pub',
  polo: 'polo-style',
};

/** sizeTier за жанром: паб і селебріті — великі полотна, поло — нагрудні. */
const TIER = { celebrity: 'MAXI', ua: 'MAXI', pub: 'MAXI', polo: 'MEDIUM' };

/** Мокап має сенс лише для макетів із прозорим тлом; паб — квадратні постери. */
const MOCKUP = { celebrity: true, ua: true, pub: false, polo: true };

// artwork: шлях до продакшн-оригіналу в iCloud (kudos/ХВІСТОРІЯ/…) — щоб за
// роки було видно, з якого файлу друкуємо. У Blob лежить лише веб-версія.
const MANIFEST = [
  // ── Пес і Селебріті ────────────────────────────────────────────────
  { c: 'celebrity', slug: 'zirky-dogs', title: 'D.O.G.S', file: 'dogs.webp', artwork: 'Пес і Селебріті (принти)/D.O.G.S_футболка.png' },
  { c: 'celebrity', slug: 'zirky-pet-parent', title: 'PET PARENT', file: 'pet-parent.webp', artwork: 'Пес і Селебріті (принти)/PET PARENT text print.svg' },
  { c: 'celebrity', slug: 'zirky-the-crown', title: 'The Crown', file: 'the-crown.webp', artwork: 'Пес і Селебріті (принти)/the Crown.png' },
  { c: 'celebrity', slug: 'zirky-blondynka', title: 'Блондинка в законі', file: 'blondynka-v-zakoni.webp', artwork: 'Пес і Селебріті (принти)/Блондинка в законі.png' },
  { c: 'celebrity', slug: 'zirky-vitni', title: 'Вітні', file: 'vitni.webp', artwork: "Пес і Селебріті (принти)/Вітні Х'юстон_футболка.png" },
  { c: 'celebrity', slug: 'zirky-dzheki-chan', title: 'Джекі Чан', file: 'dzheki-chan.webp', artwork: 'Пес і Селебріті (принти)/Джекі Чан_футболка.png' },
  { c: 'celebrity', slug: 'zirky-dzhon-vik', title: 'Джон Вік', file: 'dzhon-vik.webp', artwork: 'Пес і Селебріті (принти)/Джон Вік.png' },
  { c: 'celebrity', slug: 'zirky-krasunia-maltipu', title: 'Красуня і мальтіпу', file: 'krasunia-i-maltipu.webp', artwork: 'Пес і Селебріті (принти)/Красуня і мальтіпу.png' },
  { c: 'celebrity', slug: 'zirky-krasunia-spaniel', title: 'Красуня і спанієль', file: 'krasunia-i-spaniel.webp', artwork: 'Пес і Селебріті (принти)/Красуня і спаніель.png' },
  { c: 'celebrity', slug: 'zirky-maikl-dark', title: 'Майкл — на темне', file: 'maikl-chorna.webp', artwork: 'Пес і Селебріті (принти)/Майкл_ чорна футболка.png' },
  { c: 'celebrity', slug: 'zirky-maikl-light', title: 'Майкл — на світле', file: 'maikl-bila.webp', artwork: 'Пес і Селебріті (принти)/Майкл_біла футболка.png' },
  { c: 'celebrity', slug: 'zirky-merlin', title: 'Мерлін', file: 'merlin.webp', artwork: 'Пес і Селебріті (принти)/Мерлін_біла футболка.png' },
  { c: 'celebrity', slug: 'zirky-mister-bin-1', title: 'Містер Бін №1', file: 'mister-bin-1.webp', artwork: 'Пес і Селебріті (принти)/Містер Бін_1.png' },
  { c: 'celebrity', slug: 'zirky-mister-bin-2', title: 'Містер Бін №2', file: 'mister-bin-2.webp', artwork: 'Пес і Селебріті (принти)/Містер Бін_2.png' },
  { c: 'celebrity', slug: 'zirky-odri', title: 'Одрі в Тіфані', file: 'odri-tifani.webp', artwork: 'Пес і Селебріті (принти)/Одрі Тіфані.png' },
  { c: 'celebrity', slug: 'zirky-semiuel', title: 'Семюел Джексон', file: 'semiuel-dzhekson.webp', artwork: 'Пес і Селебріті (принти)/Семюел Джексон_футболка.png' },
  // ── Пес ін UA ──────────────────────────────────────────────────────
  { c: 'ua', slug: 'ua-bandera', title: 'Бандера', file: 'bandera.webp', artwork: 'Пес ін UA (принти)/Бандера_текст зверху.png' },
  { c: 'ua', slug: 'ua-skovoroda', title: 'Сковорода', file: 'skovoroda.webp', artwork: 'Пес ін UA (принти)/Сковорода_футболка.png' },
  { c: 'ua', slug: 'ua-franko', title: 'Франко', file: 'franko.webp', artwork: 'Пес ін UA (принти)/Франко_футболка.png' },
  { c: 'ua', slug: 'ua-shevchenko', title: 'Шевченко', file: 'shevchenko.webp', artwork: 'Пес ін UA (принти)/Шевченко _футболка_принт.png' },
  { c: 'ua', slug: 'ua-kozak', title: 'Козак', file: 'kozak.webp', artwork: 'Пес ін UA (принти)/весті козак.png', breeds: ['вест'] },
  // ── Пес ін Паб (породи чіпляються за назвою) ───────────────────────
  { c: 'pub', slug: 'pab-akita-i-siba', title: 'Акіта і сіба', file: 'akita-i-siba.webp', artwork: 'Пес ін Паб (принти)/акіта і сіба.png', breeds: ['акіта', 'сіба'] },
  { c: 'pub', slug: 'pab-amstaf', title: 'Амстаф', file: 'amstaf.webp', artwork: 'Пес ін Паб (принти)/амстаф.png', breeds: ['амстаф'] },
  { c: 'pub', slug: 'pab-bulterier', title: "Бультер'єр", file: 'bulterier.webp', artwork: "Пес ін Паб (принти)/бультер'єр.png", breeds: ['бультер'] },
  { c: 'pub', slug: 'pab-bihl', title: 'Бігль', file: 'bihl.webp', artwork: 'Пес ін Паб (принти)/бігль.png', breeds: ['бігль'] },
  { c: 'pub', slug: 'pab-vestik', title: 'Вестік', file: 'vestik.webp', artwork: 'Пес ін Паб (принти)/вестік.png', breeds: ['вест'] },
  { c: 'pub', slug: 'pab-vivcharka-i-kane-korso', title: 'Вівчарка і кане-корсо', file: 'vivcharka-i-kane-korso.webp', artwork: 'Пес ін Паб (принти)/вівчарка і кане корсо.png', breeds: ['вівчарка', 'корсо'] },
  { c: 'pub', slug: 'pab-dalmatynets', title: 'Далматинець', file: 'dalmatynets.webp', artwork: 'Пес ін Паб (принти)/далматінець.png', breeds: ['далмат'] },
  { c: 'pub', slug: 'pab-dzhek-rassel', title: 'Джек-рассел', file: 'dzhek-rassel.webp', artwork: 'Пес ін Паб (принти)/джек рассел.png', breeds: ['рассел'] },
  { c: 'pub', slug: 'pab-doberman', title: 'Доберман', file: 'doberman.webp', artwork: 'Пес ін Паб (принти)/доберман.png', breeds: ['доберман'] },
  { c: 'pub', slug: 'pab-york', title: 'Йорк', file: 'york.webp', artwork: 'Пес ін Паб (принти)/йорк.png', breeds: ['йорк'] },
  { c: 'pub', slug: 'pab-korhi', title: 'Коргі', file: 'korhi.webp', artwork: 'Пес ін Паб (принти)/коргі.png', breeds: ['коргі'] },
  { c: 'pub', slug: 'pab-labrador', title: 'Лабрадор', file: 'labrador.webp', artwork: 'Пес ін Паб (принти)/лабрадор.png', breeds: ['лабрадор'] },
  { c: 'pub', slug: 'pab-lievrietka-i-doh', title: 'Левретка і дог', file: 'lievrietka-i-doh.webp', artwork: 'Пес ін Паб (принти)/лєврєтка і дог.png', breeds: ['левретка', 'дог'] },
  { c: 'pub', slug: 'pab-maltipu-i-kavaler', title: 'Мальтіпу і кавалер', file: 'maltipu-i-kavaler.webp', artwork: 'Пес ін Паб (принти)/мальтіпу і кавалер чарльз.png', breeds: ['мальтіпу', 'кавалер'] },
  { c: 'pub', slug: 'pab-mops', title: 'Мопс', file: 'mops.webp', artwork: 'Пес ін Паб (принти)/мопс.png', breeds: ['мопс'] },
  { c: 'pub', slug: 'pab-retryver', title: 'Ретривер', file: 'retryver.webp', artwork: 'Пес ін Паб (принти)/ретривер.png', breeds: ['ретривер'] },
  { c: 'pub', slug: 'pab-rotveiler', title: 'Ротвейлер', file: 'rotveiler.webp', artwork: 'Пес ін Паб (принти)/ротвейлер.png', breeds: ['ротвейлер'] },
  { c: 'pub', slug: 'pab-samoid', title: 'Самоїд', file: 'samoid.webp', artwork: 'Пес ін Паб (принти)/самоїд.png', breeds: ['самоїд'] },
  { c: 'pub', slug: 'pab-taksa-i-york', title: 'Такса і йорк', file: 'taksa-i-york.webp', artwork: 'Пес ін Паб (принти)/такса і йорк.png', breeds: ['такса', 'йорк'] },
  { c: 'pub', slug: 'pab-frantsuz', title: 'Француз', file: 'frantsuz.webp', artwork: 'Пес ін Паб (принти)/француз.png', breeds: ['француз'] },
  { c: 'pub', slug: 'pab-tsverhshnautser', title: 'Цвергшнауцер', file: 'tsverhshnautser.webp', artwork: 'Пес ін Паб (принти)/цвергшнауцер.png', breeds: ['шнауцер'] },
  { c: 'pub', slug: 'pab-chikhuakhua-i-toi', title: 'Чихуахуа і той', file: 'chikhuakhua-i-toi.webp', artwork: 'Пес ін Паб (принти)/чіхуахуа і той.png', breeds: ['чихуахуа', 'той'] },
  { c: 'pub', slug: 'pab-shpits', title: 'Шпіц', file: 'shpits.webp', artwork: 'Пес ін Паб (принти)/шпіц.png', breeds: ['шпіц'] },
  // ── Пес ін Поло (№1 — файл без номера, далі (1)…(23) → №2…№24) ────
  ...Array.from({ length: 24 }, (_, i) => ({
    c: 'polo',
    slug: `polo-${String(i + 1).padStart(2, '0')}`,
    title: `Пес ін POLO №${i + 1}`,
    file: `polo-${String(i + 1).padStart(2, '0')}.webp`,
    artwork: `Пес ін Поло (принти) /${i === 0 ? 'Пес ін POLO.png' : `Пес ін POLO (${i}).png`}`,
  })),
];

// ── далі механіка ──────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] ?? null; };
const DRY = args.includes('--dry');
const ASSETS = flag('--assets');
const envFile = flag('--env');

if (envFile) {
  // Толерантний парсер: KEY=значення — як завжди, а голий рядок без ключа
  // розпізнаємо за префіксом (так люди і вставляють: скопіював — вклеїв).
  const BARE = [
    ['DATABASE_URL', /^postgres(ql)?:\/\//],
    ['BLOB_READ_WRITE_TOKEN', /^vercel_blob_rw_/],
    ['GITHUB_TOKEN', /^(github_pat_|ghp_)/],
  ];
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*["']?([^"'\s]+)/);
    if (m) { if (!process.env[m[1]]) process.env[m[1]] = m[2]; continue; }
    const v = line.trim().replace(/^["']|["']$/g, '');
    for (const [key, rx] of BARE) {
      if (rx.test(v) && !process.env[key]) process.env[key] = v;
    }
  }
}

const DB = process.env.DATABASE_URL ?? '';
const BLOB = process.env.BLOB_READ_WRITE_TOKEN ?? '';
if (!DB.startsWith('postgres')) fail('DATABASE_URL не задано (env або --env файл).');
if (!DRY && !BLOB.startsWith('vercel_blob_rw')) fail('BLOB_READ_WRITE_TOKEN не задано.');
if (!ASSETS) fail('Вкажи --assets <тека з webp> (підтеки celebrity/ ua/ pub/ polo/).');

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }

const sql = neon(DB);

const collections = new Map(); // тека → {id, slug}
for (const [dir, slug] of Object.entries(COLLECTIONS)) {
  const rows = await sql`SELECT id, slug, title FROM "Collection" WHERE slug = ${slug}`;
  if (rows.length === 0) {
    const all = await sql`SELECT slug FROM "Collection" ORDER BY position`;
    fail(`Колекції «${slug}» немає в базі. Є: ${all.map((r) => r.slug).join(', ')}`);
  }
  collections.set(dir, rows[0]);
}

const breeds = await sql`SELECT id, slug, name, synonyms FROM "Breed"`;
function matchBreed(hint) {
  const h = hint.toLowerCase();
  return breeds.find((b) =>
    b.name.toLowerCase().includes(h)
    || (b.synonyms ?? []).some((s) => s.toLowerCase().includes(h)));
}

let created = 0; let skipped = 0; const missedBreeds = [];
for (const item of MANIFEST) {
  const file = join(ASSETS, item.c, item.file);
  if (!existsSync(file)) { fail(`Немає файла ${file}`); }

  const existing = await sql`SELECT id FROM "Print" WHERE slug = ${item.slug}`;
  if (existing.length > 0) { skipped += 1; continue; }

  const breedIds = (item.breeds ?? [])
    .map((hint) => {
      const b = matchBreed(hint);
      if (!b) missedBreeds.push(`${item.slug}: «${hint}»`);
      return b?.id;
    })
    .filter((id) => id !== undefined);

  if (DRY) {
    console.log(`+ ${item.slug} · ${item.title} · ${collections.get(item.c).slug}`
      + ` · ${TIER[item.c]}${MOCKUP[item.c] ? ' · mockup' : ''}`
      + (breedIds.length > 0 ? ` · пород: ${breedIds.length}` : ''));
    created += 1;
    continue;
  }

  const bytes = readFileSync(file);
  const blob = await put(`prints/${item.slug}/${item.file}`, bytes, {
    access: 'public', contentType: 'image/webp', addRandomSuffix: true, token: BLOB,
  });

  const printId = randomUUID();
  const imageId = randomUUID();
  const mockupUrl = MOCKUP[item.c] ? blob.url : '';
  const artworkKey = `icloud:kudos/ХВІСТОРІЯ/${item.c === 'celebrity' ? 'Пес і Селебріті' : item.c === 'ua' ? 'Пес ін UA' : item.c === 'pub' ? 'Пес ін Паб' : 'Пес ін Поло'}/${item.artwork}`;

  // Транзакція: принт або з'являється цілком (з фото і колекцією), або ніяк.
  await sql.transaction((tx) => {
    const ops = [
      tx`INSERT INTO "Print" (id, slug, title, "sizeTier", "previewUrl", "artworkKey", "mockupUrl", "isPublished", "createdAt", "updatedAt")
         VALUES (${printId}, ${item.slug}, ${item.title}, ${TIER[item.c]}::"PrintSizeTier", ${blob.url}, ${artworkKey}, ${mockupUrl}, false, now(), now())`,
      tx`INSERT INTO "PrintImage" (id, "printId", url, pathname, alt, position, "createdAt")
         VALUES (${imageId}, ${printId}, ${blob.url}, ${blob.pathname}, ${item.title}, 0, now())`,
      tx`INSERT INTO "PrintCollection" ("printId", "collectionId")
         VALUES (${printId}, ${collections.get(item.c).id}) ON CONFLICT DO NOTHING`,
    ];
    for (const breedId of breedIds) {
      ops.push(tx`INSERT INTO "PrintBreed" ("printId", "breedId") VALUES (${printId}, ${breedId}) ON CONFLICT DO NOTHING`);
    }
    return ops;
  });

  created += 1;
  console.log(`✓ ${item.slug} (${item.title})`);
}

console.log(`\nГотово: створено ${created}, пропущено (вже були) ${skipped}, разом у маніфесті ${MANIFEST.length}.`);
if (missedBreeds.length > 0) {
  console.log(`Породи, яких не знайшли в базі (прив'яжете в адмінці руками):\n  ${missedBreeds.join('\n  ')}`);
}
console.log('Усі створені принти — ЧЕРНЕТКИ (isPublished=false): на сайті їх не видно, публікація — кнопкою в адмінці.');
