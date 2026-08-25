import { describe, expect, it } from 'vitest';
import { slugify } from './pages-table';

describe('slugify', () => {
  it('перекладає кирилицю в латиницю', () => {
    expect(slugify('Доставка і оплата')).toBe('dostavka-i-oplata');
  });

  it('прибирає апострофи, а не перетворює їх на риску', () => {
    expect(slugify("Мʼякі тканини")).toBe('miaki-tkanyny');
  });

  it('не лишає риски по краях', () => {
    expect(slugify('  Про нас!  ')).toBe('pro-nas');
  });

  it('не робить подвійних рисок', () => {
    expect(slugify('Опт — і роздріб')).toBe('opt-i-rozdrib');
  });

  it('обрізає надто довгу назву', () => {
    expect(slugify('а'.repeat(200)).length).toBeLessThanOrEqual(60);
  });

  it('результат проходить перевірку kebab-case', () => {
    for (const title of ['Ціни та строки', 'FAQ по доставці', 'Худі 350 г/м²']) {
      expect(slugify(title)).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });
});
