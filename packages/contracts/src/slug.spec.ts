import { describe, expect, it } from 'vitest';
import { slugify, SLUG_PATTERN, transliterate } from './slug';

describe('slugify', () => {
  it('перетворює українську назву на адресу, яку не соромно кинути в Telegram', () => {
    expect(slugify('Коргі у стилі ренесанс')).toBe('korhi-u-styli-renesans');
    expect(slugify('Хаскі на обкладинці Vogue')).toBe('khaski-na-obkladyntsi-vogue');
  });

  it('читає початок слова інакше, ніж середину', () => {
    // «Я» на початку — ya, всередині — ia. Інакше «Ярик» стає «iaryk».
    expect(slugify('Ярик')).toBe('yaryk');
    expect(slugify('Мася')).toBe('masia');
  });

  it('усе, що виходить, придатне як URL', () => {
    for (const title of ['Джек-рассел №1', '  Бультерʼєр  ', 'Собаки у барі 2.0', 'ЩЕНЯ']) {
      const slug = slugify(title);
      expect(slug).toMatch(SLUG_PATTERN);
      expect(slug).not.toMatch(/[^a-z0-9-]/);
    }
  });

  it('не лишає дефісів по краях і не склеює їх у ланцюжки', () => {
    expect(slugify('---Пес---і---кіт---')).toBe('pes-i-kit');
  });

  it('повертає порожнє, коли транслітерувати нічого — це сигнал попросити slug руками', () => {
    expect(slugify('🐕🐕🐕')).toBe('');
    expect(slugify('   ')).toBe('');
  });

  it('обрізає довгі назви, не лишаючи хвостового дефіса', () => {
    const slug = slugify('Дуже довга назва принта '.repeat(10));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug).toMatch(SLUG_PATTERN);
  });
});

describe('transliterate', () => {
  it('не чіпає латиницю й цифри', () => {
    expect(transliterate('Vogue 2026')).toBe('Vogue 2026');
  });
});
