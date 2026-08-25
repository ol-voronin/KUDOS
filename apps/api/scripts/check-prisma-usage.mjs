#!/usr/bin/env node
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
    const source = readFileSync(file, 'utf8');
    const where = relative(API_ROOT, file);

    // Заперечний lookbehind відсікає шляхи імпорту: у `../common/prisma.service`
    // перед `prisma` стоїть слеш, у `this.prisma.garment` — крапка.
    // Крапка після імені моделі обовʼязкова: далі завжди йде метод.
    for (const hit of source.matchAll(/(?<![\w/'"-])prisma\.([a-z][A-Za-z0-9]*)\./g)) {
      const model = hit[1];
      // Клієнтські методи, а не моделі.
      if (/^\$/.test(model) || ['on', 'use', 'then', 'catch', 'finally'].includes(model)) continue;
      if (models.has(model)) continue;
      problems.push(`${where}: моделі \`${model}\` немає в schema.prisma`);
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
