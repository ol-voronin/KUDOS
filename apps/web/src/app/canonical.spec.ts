import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Кожна публічна сторінка має свій canonical.
 *
 * Без нього Google обирає канонічну сам — і 26.09.2026 для `/breeds/taksa`
 * він обрав чужий сайт. Абсолютну адресу дає `metadataBase` у layout, тут
 * перевіряється, що сторінка взагалі його задає, і задає чистий шлях: без
 * `?page=`, `?garmentType=`, `?sort=` — сторінки з фільтрами канонізуються
 * на адресу без параметрів.
 *
 * Службові сторінки (кошик, оформлення, пошук) свідомо без canonical: вони
 * закриті `noindex`. Статус замовлення закритий у robots.txt (`/order/`).
 */
const APP = __dirname;
const NOINDEX = new Set(['koshyk', 'oformlennya', 'search']);
const ROBOTS_DISALLOWED = new Set([join('order', '[id]')]);

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'admin' ? [] : pages(full);
    return name === 'page.tsx' ? [full] : [];
  });
}

describe('canonical на публічних сторінках', () => {
  const all = pages(APP);

  it('знайшли сторінки', () => {
    expect(all.length).toBeGreaterThan(15);
  });

  for (const file of all) {
    const route = relative(APP, file).replace(/[/\\]?page\.tsx$/, '');
    if (NOINDEX.has(route) || ROBOTS_DISALLOWED.has(route)) continue;

    it(`/${route}`, () => {
      const src = readFileSync(file, 'utf8');
      const match = src.match(/alternates:\s*\{\s*canonical:\s*([^}]+)\}/);
      expect(match, `немає alternates.canonical у ${route}/page.tsx`).not.toBeNull();
      expect(match?.[1]).not.toMatch(/\?/);
    });
  }

  it('службові сторінки закриті noindex', () => {
    for (const route of NOINDEX) {
      const src = readFileSync(join(APP, route, 'page.tsx'), 'utf8');
      expect(src, route).toMatch(/index:\s*false/);
    }
  });
});
