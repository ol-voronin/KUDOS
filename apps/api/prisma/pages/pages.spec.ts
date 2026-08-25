import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AnyBlock, BlockList, unknownTokens } from '@dt/contracts';
import { MARKETING_PAGES } from './marketing';

/**
 * Перевірки перенесеного вмісту.
 *
 * Це і є гейт першого етапу, зафіксований тестом. Юридичні сторінки
 * згенеровані конвертером із наявного JSX, а згенероване має властивість
 * ламатися тихо: у JSON нікому нічого не підкреслює. Тут перевіряється те,
 * що не видно очима на 70 пунктах тексту.
 */

const legal = JSON.parse(
  readFileSync(join(__dirname, 'legal.json'), 'utf8'),
) as Record<string, { title: string; seoTitle: string; seoDescription: string; blocks: unknown[] }>;

const allSeeds = [
  ...Object.entries(legal).map(([slug, d]) => ({ slug, title: d.title, blocks: d.blocks })),
  ...MARKETING_PAGES.map((p) => ({ slug: p.slug, title: p.title, blocks: p.blocks as unknown[] })),
];

/** Усі рядки, які побачить читач: щоб перевіряти текст, а не структуру. */
function textsOf(blocks: unknown[]): string[] {
  const out: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === 'string') { out.push(value); return; }
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (value !== null && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(blocks);
  return out;
}

describe('перенесені сторінки', () => {
  it('усі чотири на місці', () => {
    expect(allSeeds.map((s) => s.slug).sort())
      .toEqual(['oferta', 'pryvatnist', 'spivpratsia', 'svoya-ideya']);
  });

  it.each(allSeeds)('$slug — блоки проходять схему', ({ blocks }) => {
    const parsed = BlockList.safeParse(blocks);
    // Повідомлення zod довге, але саме воно каже, який блок і яке поле.
    expect(parsed.success ? '' : parsed.error.message).toBe('');
  });

  it.each(allSeeds)('$slug — id блоків унікальні', ({ blocks }) => {
    // id — це ключ у React і майбутній порядок в адмінці. Дубль тут дає
    // блоки, що переставляються разом, і це знаходять руками, а не в логах.
    const ids = BlockList.parse(blocks).map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(allSeeds)('$slug — жодної невідомої підстановки', ({ blocks }) => {
    const bad = textsOf(blocks).flatMap(unknownTokens);
    expect(bad).toEqual([]);
  });

  it.each(allSeeds)('$slug — у тексті не лишилося JSX', ({ blocks }) => {
    // Конвертер міг не впізнати конструкцію й лишити її як є. Кутова дужка
    // або фігурна поза `{{підстановкою}}` — саме такий випадок.
    const leftovers = textsOf(blocks)
      .map((t) => t.replace(/\{\{\w+\}\}/g, ''))
      .filter((t) => /[<>{}]/.test(t) || t.includes('site.'));
    expect(leftovers).toEqual([]);
  });

  it('юридичні розділи нумеруються підряд від одиниці', () => {
    // На пункт «7.2» посилаються і в самому документі, і в переписці з
    // покупцем. Пропущений номер — це посилання в нікуди.
    for (const [slug, doc] of Object.entries(legal)) {
      const numbers = BlockList.parse(doc.blocks)
        .flatMap((b) => (b.type === 'legal' ? [b.number] : []));
      expect(numbers, slug).toEqual(numbers.map((_, i) => i + 1));
    }
  });

  it('оферта зберегла всі одинадцять розділів', () => {
    const legalBlocks = BlockList.parse(legal['oferta']?.blocks ?? [])
      .filter((b) => b.type === 'legal');
    expect(legalBlocks).toHaveLength(11);
  });

  it('політика зберегла всі десять розділів', () => {
    const legalBlocks = BlockList.parse(legal['pryvatnist']?.blocks ?? [])
      .filter((b) => b.type === 'legal');
    expect(legalBlocks).toHaveLength(10);
  });

  it('кожна сторінка починається з героя', () => {
    for (const seed of allSeeds) {
      const first = AnyBlock.parse((seed.blocks as unknown[])[0]);
      expect(first.type, seed.slug).toBe('hero');
    }
  });

  it('посилання ведуть кудись дозволеним способом', () => {
    // Схема це вже перевіряє, але тут ідеться про інше: щоб серед перенесених
    // сторінок не було внутрішнього посилання на сторінку, якої немає.
    const internal = new Set(['/', '/prints', '/collections', '/breeds', '/vyroby', '/zayavka',
      '/search', '/oferta', '/pryvatnist', '/spivpratsia', '/svoya-ideya']);
    for (const seed of allSeeds) {
      for (const block of BlockList.parse(seed.blocks)) {
        const links = 'links' in block ? block.links : [];
        for (const l of links) {
          if (!l.href.startsWith('/')) continue;
          expect(internal.has(l.href), `${seed.slug} → ${l.href}`).toBe(true);
        }
      }
    }
  });
});
