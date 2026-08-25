#!/usr/bin/env node
/**
 * Перегенеровує реєстр фото виробів зі вмісту `public/garments`.
 *
 * Реєстр існує, щоб компонент знав про наявність кадру ДО того, як спробує
 * його завантажити. Тримати такий список вручну — гарантія розбіжності, тому
 * тут він читається з диска.
 *
 * Запуск: pnpm --filter @dt/web run gen:garment-photos
 */

import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url));
const PHOTO_DIR = join(WEB_ROOT, 'public', 'garments');
const TARGET = join(WEB_ROOT, 'src', 'features', 'catalog', 'garment-photos.ts');

const entries = readdirSync(PHOTO_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => [
    e.name,
    readdirSync(join(PHOTO_DIR, e.name))
      .filter((f) => f.endsWith('.webp'))
      .map((f) => f.slice(0, -'.webp'.length))
      .sort(),
  ])
  .sort(([a], [b]) => a.localeCompare(b));

const body = entries
  .map(([garment, colours]) => `  '${garment}': [${colours.map((c) => `'${c}'`).join(', ')}],`)
  .join('\n');

writeFileSync(TARGET, `/**
 * Які фото виробів у нас справді є.
 *
 * Файли лежать у \`public/garments/<виріб>/<колір>.webp\` — це кадри з
 * паспортів виробів, знятих із прозорим тлом. Реєстр згенеровано зі вмісту
 * теки, а не написано вручну, і саме тому він тут потрібен: без нього
 * компонент мусив би пробувати шлях і ловити \`onError\`, тобто малювати
 * зламану картинку, щоб дізнатися, що її немає. Дешевше знати заздалегідь.
 *
 * Оновити після додавання фото: \`pnpm --filter @dt/web run gen:garment-photos\`.
 */

/* eslint-disable */
// ЗГЕНЕРОВАНО. Не редагувати руками.
const PHOTOS: Readonly<Record<string, readonly string[]>> = {
${body}
};

/** Шлях до фото виробу в кольорі, або null — якщо такого кадру немає. */
export function garmentPhoto(garmentSlug: string, colourCode: string): string | null {
  return PHOTOS[garmentSlug]?.includes(colourCode) === true
    ? \`/garments/\${garmentSlug}/\${colourCode}.webp\`
    : null;
}

/** Скільки кольорів виробу ми можемо показати кадром. */
export function garmentPhotoCount(garmentSlug: string): number {
  return PHOTOS[garmentSlug]?.length ?? 0;
}
`, 'utf8');

const total = entries.reduce((n, [, colours]) => n + colours.length, 0);
console.info(`garment-photos.ts оновлено — виробів ${entries.length}, кадрів ${total}`);
