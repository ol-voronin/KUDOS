#!/usr/bin/env node
/*
 * ── Чому `prisma generate` стоїть у `typecheck` ───────────────────────
 *
 * Клієнт Prisma — це згенерований код, а не бібліотека: типи моделей,
 * перелічень і колонок беруться з `node_modules/.prisma/client`, який
 * створюється командою `prisma generate`. Змінили schema.prisma — і доки
 * генерацію не перезапустили, `tsc` перевіряє код проти СТАРОЇ бази.
 *
 * Це помилка, яка не падає, а бреше в обидва боки: у того, хто щойно
 * згенерував, усе зелене; у того, хто просто витягнув зміни, — десяток
 * помилок про поля, яких «не існує». Ми на цьому вже обпеклися: кошик
 * приїхав із міграцією, що додає статус `NEW` і колонки доставки, і
 * зібрався тільки на тій машині, де генерацію запустили руками.
 *
 * Тому генерація тепер — перший крок і `typecheck`, і `build`. Коштує
 * пів секунди й прибирає цілий клас розбіжностей «у мене працює».
 */
/**
 * Звіряє звернення до Prisma в коді зі схемою.
 *
 * Навіщо, якщо є `tsc`: `tsc` бачить помилку лише після `prisma generate`, а
 * generate тягне бінарні движки з мережі. У середовищі без доступу до
 * binaries.prisma.sh (CI без кешу, контейнер за проксі, будь-яка машина
 * офлайн) типізація Prisma просто зникає — `PrismaService` стає порожнім
 * обʼєктом, і `tsc` мовчки пропускає ВСІ звернення до бази. Саме тоді
 * зʼявляється друкарська помилка в назві моделі, яка падає в рантаймі.
 *
 * Тому ця перевірка читає `schema.prisma` як текст і не потребує ні движків,
 * ні бази. Вона свідомо неповна — перевіряє те, де помилка тиха й дорога:
 *
 *   1. `prisma.<model>` — модель існує в схемі;
 *   2. складені ключі (`where: { line_type_fit: … }`) — такий @@unique/@@id
 *      у схемі справді оголошений і саме з цих полів.
 *
 * Запуск: node scripts/check-prisma-usage.mjs
 */

import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCHEMA = join(API_ROOT, 'prisma', 'schema.prisma');

// ── схема ────────────────────────────────────────────────────────────────────

const schema = readFileSync(SCHEMA, 'utf8');

/** Назви моделей у тому вигляді, в якому їх бачить клієнт: перша літера мала. */
const models = new Set();
/** Складені ключі: "line_type_fit" → "Garment". */
const compoundKeys = new Map();

for (const block of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
  const [, name, body] = block;
  models.add(name[0].toLowerCase() + name.slice(1));

  for (const attr of body.matchAll(/@@(unique|id)\(\s*(?:fields:\s*)?\[([^\]]+)\]/g)) {
    const fields = attr[2].split(',').map((f) => f.trim()).filter(Boolean);
    if (fields.length < 2) continue;
    compoundKeys.set(fields.join('_'), name);
  }
  // Іменований складений ключ: @@unique([a, b], name: "ab")
  for (const attr of body.matchAll(/@@(?:unique|id)\([^)]*name:\s*"([^"]+)"/g)) {
    compoundKeys.set(attr[1], name);
  }
}

/**
 * Орендні моделі — ті самі, що в `src/common/tenancy.ts`.
 *
 * Список читається з файлу, а не дублюється тут: дві копії розійдуться,
 * і розійдуться саме тоді, коли додадуть нову таблицю вмісту.
 */
const tenancySource = readFileSync(join(API_ROOT, 'src', 'common', 'tenancy.ts'), 'utf8');
const tenantBlock = /TENANT_MODELS[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(tenancySource);
const tenantModels = new Set(
  [...(tenantBlock?.[1] ?? '').matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]),
);

// ── код ──────────────────────────────────────────────────────────────────────

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|mts)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) yield full;
  }
}

const problems = [];

for (const dir of ['src', 'prisma', 'scripts']) {
  for await (const file of walk(join(API_ROOT, dir))) {
    // Коментарі відкидаємо: у них цілком доречно згадати старий, небезпечний
    // виклик, щоб пояснити, чому його більше немає.
    const source = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const where = relative(API_ROOT, file);

    // Заперечний lookbehind відсікає шляхи імпорту: у `../common/prisma.service`
    // перед `prisma` стоїть слеш, у `this.prisma.db.garment` — крапка.
    // Крапка після імені моделі обовʼязкова: далі завжди йде метод.
    for (const hit of source.matchAll(/(?<![\w/'"-])prisma\.(?:db\.)?([a-z][A-Za-z0-9]*)\./g)) {
      const model = hit[1];
      // Клієнтські методи, а не моделі.
      if (/^\$/.test(model) || ['db', 'raw', 'on', 'use', 'then', 'catch', 'finally'].includes(model)) continue;
      if (models.has(model)) continue;
      problems.push(`${where}: моделі \`${model}\` немає в schema.prisma`);
    }

    // Небезпека, яку тут ловимо, одна: файл бере сирий `PrismaClient` і
    // сам іде до таблиці вмісту. У сервісах це вже неможливо — `PrismaService`
    // не успадковує клієнта, тож `this.prisma.page` не збереться. А от новий
    // сідер написати саме так дуже легко, і він мовчки прочитає дані всіх
    // сайтів одразу.
    //
    // Перевіряти імена змінних безглуздо: у сідері `prisma` — це вже
    // ізольований клієнт. Тому дивимося на імпорти.
    const usesRawClient = /from '@prisma\/client'/.test(source) && /\bnew PrismaClient\(/.test(source);
    const isolated = /withTenancy|withSite/.test(source);
    if (usesRawClient && !isolated) {
      const touched = [...tenantModels].filter((m) => {
        const lower = m[0].toLowerCase() + m.slice(1);
        return new RegExp(`\\.${lower}\\.`).test(source);
      });
      if (touched.length > 0) {
        problems.push(
          `${where}: сирий PrismaClient звертається до ${touched.join(', ')} — `
          + 'оберніть у withSite() або withTenancy(), інакше запит побачить дані всіх сайтів',
        );
      }
    }

    // Складений ключ упізнаємо за формою: щонайменше два фрагменти через "_",
    // одразу після відкритої дужки where/upsert.
    for (const hit of source.matchAll(/where:\s*\{\s*([a-z][A-Za-z0-9]*(?:_[a-z][A-Za-z0-9]*)+)\s*:/g)) {
      const key = hit[1];
      if (compoundKeys.has(key)) continue;
      problems.push(`${where}: складеного ключа \`${key}\` немає в schema.prisma`);
    }
  }
}

if (problems.length > 0) {
  console.error('Звернення до Prisma не збігаються зі схемою:\n');
  for (const p of [...new Set(problems)].sort()) console.error(`  ${p}`);
  console.error(`\nМоделей у схемі: ${models.size}. Складених ключів: ${compoundKeys.size}.`);
  process.exit(1);
}

console.info(`prisma usage ok — моделей ${models.size}, складених ключів ${compoundKeys.size}`);
