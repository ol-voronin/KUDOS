import { describe, expect, it } from 'vitest';
import { BlockList, type PageDto } from '@dt/contracts';
import { applyLegalPatches } from './legal-patches';

function page(slug: string, p8Text: string) {
  const blocks = BlockList.parse([
      { id: 'hero', type: 'hero', heading: 'Політика', footnote: 'Редакція від 25 серпня 2026 року' },
      { id: 'p5', type: 'legal', number: 5, heading: 'Кому', items: [{ n: '5.1.', text: 'Telegram' }, { n: '5.5.', text: 'Не передаємо рекламним мережам' }] },
      { id: 'p8', type: 'legal', number: 8, heading: 'Cookie', items: [{ n: '8.1.', text: p8Text }] },
  ]);
  return { slug, blocks } as unknown as PageDto;
}

describe('applyLegalPatches', () => {
  it('замінює застарілі розділи 5 і 8 та дату редакції', () => {
    const out = applyLegalPatches(page('pryvatnist', 'Сайт не використовує рекламні чи аналітичні cookie й не має лічильників.'));
    const text = JSON.stringify(out.blocks);
    expect(text).toContain('Google Analytics 4');
    expect(text).toContain('Редакція від 15 жовтня 2026 року');
    expect(text).not.toContain('не використовує рекламні чи аналітичні cookie');
    expect(text).toContain('Telegram');
  });

  it('замінює редакцію 13.10 з банером згоди на плашку', () => {
    const out = applyLegalPatches(page('pryvatnist', 'Поки ви не натиснули «Погоджуюсь», аналітичні й рекламні cookie не ставляться.'));
    const text = JSON.stringify(out.blocks);
    expect(text).toContain('плашці внизу екрана');
    expect(text).not.toContain('Поки ви не натиснули «Погоджуюсь»');
  });

  it('не чіпає вже оновлену політику та інші сторінки', () => {
    const fresh = page('pryvatnist', 'Сайт використовує Google Analytics 4.');
    expect(applyLegalPatches(fresh)).toBe(fresh);
    const other = page('oferta', 'Сайт не використовує рекламні чи аналітичні cookie.');
    expect(applyLegalPatches(other)).toBe(other);
  });
});
