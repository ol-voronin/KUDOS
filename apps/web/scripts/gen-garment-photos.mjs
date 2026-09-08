#!/usr/bin/env node
/**
 * Перегенеровує реєстр фото виробів зі вмісту `public/garments`.
 *
 * Реєстр існує, щоб компонент знав про наявність кадру ДО того, як спробує
 * його завантажити. Тримати такий список вручну — гарантія розбіжності, тому
 * тут він читається з диска.
 *
 * Два види кадрів:
 *   <виріб>/<колір>.webp                 — «паспортний» кадр: свотчі, картки,
 *                                          підкладка авто-мокапів;
 *   <виріб>/views/<колір>/<ракурс>.webp — знімальні кадри для галереї PDP
 *                                          (на моделі, спинка, розкладка).
 *
 * Запуск: pnpm --filter @dt/web run gen:garment-photos
 */

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url));
const PHOTO_DIR = join(WEB_ROOT, 'public', 'garments');
const TARGET = join(WEB_ROOT, 'src', 'features', 'catalog', 'garment-photos.ts');

const garments = readdirSync(PHOTO_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const photoEntries = [];
const viewEntries = [];

for (const garment of garments) {
  const dir = join(PHOTO_DIR, garment);
  const colours = readdirSync(dir)
    .filter((f) => f.endsWith('.webp'))
    .map((f) => f.slice(0, -'.webp'.length))
    .sort();
  photoEntries.push([garment, colours]);

  const viewsDir = join(dir, 'views');
  if (!existsSync(viewsDir)) continue;
  const byColour = readdirSync(viewsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => [
      e.name,
      readdirSync(join(viewsDir, e.name))
        .filter((f) => f.endsWith('.webp'))
        .map((f) => f.slice(0, -'.webp'.length))
        .sort((a, b) => viewWeight(a) - viewWeight(b) || a.localeCompare(b)),
    ])
    .sort(([a], [b]) => a.localeCompare(b));
  if (byColour.length > 0) viewEntries.push([garment, byColour]);
}

/** Порядок ракурсів у галереї: людина спершу, розкладка наприкінці. */
function viewWeight(view) {
  const order = ['manfront', 'man', 'front', 'ladyfront', 'lady', 'manback', 'back', 'ladyback', 'nopeople'];
  const i = order.indexOf(view);
  return i === -1 ? order.length : i;
}

const photosBody = photoEntries
  .map(([garment, colours]) => `  '${garment}': [${colours.map((c) => `'${c}'`).join(', ')}],`)
  .join('\n');

const viewsBody = viewEntries
  .map(([garment, byColour]) => {
    const inner = byColour
      .map(([colour, views]) => `    '${colour}': [${views.map((v) => `'${v}'`).join(', ')}],`)
      .join('\n');
    return `  '${garment}': {\n${inner}\n  },`;
  })
  .join('\n');

writeFileSync(TARGET, `/**
 * Які фото виробів у нас справді є.
 *
 * Паспортні кадри лежать у \`public/garments/<виріб>/<колір>.webp\`, знімальні —
 * у \`public/garments/<виріб>/views/<колір>/<ракурс>.webp\`. Реєстр згенеровано
 * зі вмісту теки, а не написано вручну, і саме тому він тут потрібен: без
 * нього компонент мусив би пробувати шлях і ловити \`onError\`, тобто малювати
 * зламану картинку, щоб дізнатися, що її немає. Дешевше знати заздалегідь.
 *
 * Оновити після додавання фото: \`pnpm --filter @dt/web run gen:garment-photos\`.
 */

/* eslint-disable */
// ЗГЕНЕРОВАНО. Не редагувати руками.
const PHOTOS: Readonly<Record<string, readonly string[]>> = {
${photosBody}
};

const VIEWS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
${viewsBody}
};

/** Шлях до паспортного фото виробу в кольорі, або null — якщо кадру немає. */
export function garmentPhoto(garmentSlug: string, colourCode: string): string | null {
  return PHOTOS[garmentSlug]?.includes(colourCode) === true
    ? \`/garments/\${garmentSlug}/\${colourCode}.webp\`
    : null;
}

/** Скільки кольорів виробу ми можемо показати кадром. */
export function garmentPhotoCount(garmentSlug: string): number {
  return PHOTOS[garmentSlug]?.length ?? 0;
}

export interface GarmentView {
  readonly view: string;
  readonly src: string;
}

/** Знімальні кадри виробу в кольорі, вже у правильному порядку показу. */
export function garmentViews(garmentSlug: string, colourCode: string): readonly GarmentView[] {
  const views = VIEWS[garmentSlug]?.[colourCode] ?? [];
  return views.map((view) => ({
    view,
    src: \`/garments/\${garmentSlug}/views/\${colourCode}/\${view}.webp\`,
  }));
}

/** Головний кадр картки: знімальний, якщо є, інакше паспортний. */
export function garmentCardPhoto(garmentSlug: string, colourCode: string): string | null {
  return garmentViews(garmentSlug, colourCode)[0]?.src ?? garmentPhoto(garmentSlug, colourCode);
}

/** Людські підписи ракурсів для галереї та alt-текстів. */
export function viewLabel(view: string): string {
  switch (view) {
    case 'man':
    case 'manfront': return 'На ньому';
    case 'lady':
    case 'ladyfront': return 'На ній';
    case 'front': return 'Спереду';
    case 'back':
    case 'manback': return 'Спина';
    case 'ladyback': return 'Спина, на ній';
    case 'nopeople': return 'Річ';
    default: return view;
  }
}
`, 'utf8');

const totalPhotos = photoEntries.reduce((n, [, colours]) => n + colours.length, 0);
const totalViews = viewEntries.reduce(
  (n, [, byColour]) => n + byColour.reduce((m, [, views]) => m + views.length, 0),
  0,
);
console.info(`garment-photos.ts оновлено — виробів ${photoEntries.length}, паспортних ${totalPhotos}, знімальних ${totalViews}`);
