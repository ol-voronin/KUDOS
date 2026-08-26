/**
 * Ловить класи Tailwind, яких не існує.
 *
 * Навіщо це є. `min-h-13` виглядає як звичайний клас, компілюється без
 * жодного слова й не робить нічого: типова шкала відступів стрибає 12 → 14.
 * Велика кнопка через це складалася до висоти тексту — 25 px замість 52 —
 * і на сайті це читалося як «так задумано». Ані TypeScript, ані збірка, ані
 * тести такого не бачать: для них це просто рядок.
 *
 * Перевіряються тільки числові утиліти розміру — саме там шкала має діри
 * (13, 15, 17, 19…). Довільні значення в дужках і кольори не чіпаємо: вони
 * генеруються завжди.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SIZE_CLASS = /\b(?:min-h|max-h|min-w|max-w|h|w|size)-\d+(?:\.\d+)?\b/g;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full)
      : /\.tsx?$/.test(name) ? [full] : [];
  });
}

const used = new Map();
for (const file of walk('src')) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.match(SIZE_CLASS) ?? []) {
    if (!used.has(match)) used.set(match, file);
  }
}

if (used.size === 0) process.exit(0);

const tmp = mkdtempSync(join(tmpdir(), 'twcheck-'));
const probe = join(tmp, 'probe.html');
writeFileSync(probe, [...used.keys()].map((c) => `<i class="${c}"></i>`).join('\n'));
const out = join(tmp, 'probe.css');
execFileSync('npx', ['tailwindcss', '-c', 'tailwind.config.ts', '--content', probe, '-o', out], {
  stdio: 'ignore',
});
const css = readFileSync(out, 'utf8');

/*
 * Крапку в назві класу Tailwind екранує сам: `h-1.5` стає селектором
 * `.h-1\.5`. Тому в шаблоні пошуку має бути зворотна скісна з крапкою, а
 * не просто крапка — інакше кожен дробовий клас виглядає як неіснуючий.
 */
function selector(cls) {
  return `^\\.${cls.replace(/\./g, '\\\\.')}\\s*\\{`;
}

const missing = [...used.entries()].filter(([cls]) => !new RegExp(selector(cls), 'm').test(css));

if (missing.length > 0) {
  console.error('Класи Tailwind, яких не існує (мовчки нічого не роблять):');
  for (const [cls, file] of missing) console.error(`  ${cls}  —  ${file}`);
  console.error('\nДодайте значення в `theme.extend.spacing` або візьміть довільне: min-h-[3.25rem].');
  process.exit(1);
}
console.log(`Tailwind: ${used.size} числових класів розміру, усі існують`);
