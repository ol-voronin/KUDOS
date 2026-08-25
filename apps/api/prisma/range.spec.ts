import { describe, expect, it } from 'vitest';
import { COLOURS, FABRICS, GARMENTS, PRINT_PRICES, garmentPhotoPath } from './range';

/**
 * Перевірки самого довідника, без бази.
 *
 * Сідер робить сотні upsert-ів у циклах; якщо в даних є суперечність, вона
 * випливе рядком «duplicate key» посеред заливки на живу Neon — тобто в
 * найгіршому місці й найпізніший момент. Усе, що можна впіймати читанням
 * масиву, ловиться тут за мілісекунду.
 */

const unique = <T>(xs: readonly T[]): boolean => new Set(xs).size === xs.length;

describe('довідник кольорів', () => {
  it('коди унікальні — код є ключем у базі й іменем файлу фото', () => {
    expect(unique(COLOURS.map((c) => c.code))).toBe(true);
  });

  it('назви унікальні — два різні коди з однією назвою нерозрізнимі в інтерфейсі', () => {
    expect(unique(COLOURS.map((c) => c.name))).toBe(true);
  });

  it('коди — латинський kebab-case, бо з них будується шлях до файлу', () => {
    for (const c of COLOURS) expect(c.code).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('гекси у форматі #RRGGBB — контракт валідує їх регуляркою', () => {
    for (const c of COLOURS) expect(c.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('«Темний синій» більше не існує: канонічна назва одна', () => {
    // Паспорти писали цей колір двома способами. Дві назви — це два рядки в
    // базі, два свотчі поруч і питання від покупця, чим вони відрізняються.
    const names = COLOURS.map((c) => c.name);
    expect(names).toContain('Темно синій');
    expect(names).not.toContain('Темний синій');
  });
});

describe('довідник тканин', () => {
  it('ключі та назви унікальні', () => {
    expect(unique(FABRICS.map((f) => f.key))).toBe(true);
    expect(unique(FABRICS.map((f) => f.name))).toBe(true);
  });

  it('строк виготовлення додатний і в межах, які приймає кошик', () => {
    // Понад 21 день кошик уже не пропускає — див. MAX_CART_LEAD_TIME_DAYS.
    for (const f of FABRICS) {
      expect(f.leadTimeDays).toBeGreaterThan(0);
      expect(f.leadTimeDays).toBeLessThanOrEqual(21);
    }
  });
});

describe('довідник виробів', () => {
  it('slug-и унікальні', () => {
    expect(unique(GARMENTS.map((g) => g.slug))).toBe(true);
  });

  it('пара тип+крій унікальна — саме на ній стоїть @@unique у схемі', () => {
    // Без цієї перевірки два вироби мовчки злилися б в один: upsert по
    // line_type_fit оновив би той самий рядок двічі.
    expect(unique(GARMENTS.map((g) => `${g.type}/${g.fit}`))).toBe(true);
  });

  it('кожен виріб посилається на наявну тканину', () => {
    const keys = new Set(FABRICS.map((f) => f.key));
    for (const g of GARMENTS) expect(keys.has(g.fabric)).toBe(true);
  });

  it('кожен колір виробу є в довіднику кольорів', () => {
    const codes = new Set(COLOURS.map((c) => c.code));
    for (const g of GARMENTS) {
      for (const code of g.colours) {
        expect(codes.has(code), `${g.slug}: невідомий колір ${code}`).toBe(true);
      }
    }
  });

  it('кольори в межах виробу не повторюються', () => {
    for (const g of GARMENTS) expect(unique(g.colours), g.slug).toBe(true);
  });

  it('мітки розмірів у межах виробу не повторюються', () => {
    // @@unique([garmentId, label]) — дубль упав би посеред заливки.
    for (const g of GARMENTS) expect(unique(g.sizes.map((s) => s.label)), g.slug).toBe(true);
  });

  it('усі виміри заповнені числом або діапазоном', () => {
    for (const g of GARMENTS) {
      for (const s of g.sizes) {
        for (const v of [s.length, s.width, s.sleeve]) {
          expect(v, `${g.slug}/${s.label}`).toMatch(/^\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?$/);
        }
      }
    }
  });

  it('розміри йдуть від меншого до більшого', () => {
    // Порядок у масиві стає `Size.position`, а position — це те, як розміри
    // стануть у ряд на сторінці. Переплутаний порядок читається як помилка
    // даних навіть тоді, коли самі числа правильні.
    for (const g of GARMENTS) {
      const widths = g.sizes.map((s) => Number(s.width));
      for (let i = 1; i < widths.length; i += 1) {
        expect(widths[i], `${g.slug}: ${g.sizes[i]?.label}`).toBeGreaterThan(widths[i - 1] as number);
      }
    }
  });

  it('XXL не використовується — канонічна мітка 2XL', () => {
    for (const g of GARMENTS) expect(g.sizes.map((s) => s.label)).not.toContain('XXL');
  });

  it('жоден колір не залишився без виробу', () => {
    // Колір без виробу — рядок у базі, який ніде не показується, і водночас
    // причина, чому сідер не знає, яке фото ставити йому обкладинкою.
    const used = new Set(GARMENTS.flatMap((g) => g.colours));
    for (const c of COLOURS) expect(used.has(c.code), `${c.name} не використовується`).toBe(true);
  });

  it('ціни додатні', () => {
    for (const g of GARMENTS) expect(g.basePriceMinor).toBeGreaterThan(0);
    for (const p of PRINT_PRICES) expect(p.priceMinor).toBeGreaterThan(0);
  });

  it('усі три рівні ціни друку заведені', () => {
    expect(PRINT_PRICES.map((p) => p.tier).sort()).toEqual(['MAXI', 'MEDIUM', 'MINI']);
  });
});

describe('шляхи до фото', () => {
  it('складається від кореня сайту', () => {
    expect(garmentPhotoPath('hudi-klasychnyi', 'temno-synii'))
      .toBe('/garments/hudi-klasychnyi/temno-synii.webp');
  });
});
