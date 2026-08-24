import { describe, expect, it } from 'vitest';
import { fromUAH } from '@dt/contracts';
import { garmentsFor, garmentTypesFor, toPrintCard, type OfferableGarment, type PrintRow } from './print-card';
import type { PrintPriceTable } from '../pricing/pricing.domain';

const PRICES: PrintPriceTable = { MINI: fromUAH(500), MEDIUM: fromUAH(600), MAXI: fromUAH(700) };

const tee: OfferableGarment = {
  id: 'g-tee', basePriceMinor: fromUAH(590), type: 'TSHIRT',
  collectionIds: ['c-portraits'], hasStock: true,
};
const hoodie: OfferableGarment = {
  id: 'g-hoodie', basePriceMinor: fromUAH(1600), type: 'HOODIE',
  collectionIds: ['c-portraits', 'c-bar'], hasStock: false,
};

const print = (over: Partial<PrintRow> = {}): PrintRow => ({
  id: 'p1', slug: 'korhi', title: 'Коргі', sizeTier: 'MEDIUM',
  previewUrl: 'https://example.com/1.jpg', collectionIds: ['c-portraits'], ...over,
});

describe('toPrintCard', () => {
  it('бере найдешевший виріб, на якому принт дозволений, і додає друк', () => {
    // 590 футболка + 600 друк MEDIUM = 1190, а не 1600 худі.
    expect(toPrintCard(print(), [tee, hoodie], PRICES).fromPriceMinor).toBe(fromUAH(1190));
  });

  it('рахує ціну від того виробу, який реально дозволений колекцією', () => {
    // Колекція «в барі» має лише худі — футболки в ній немає.
    const card = toPrintCard(print({ collectionIds: ['c-bar'] }), [tee, hoodie], PRICES);
    expect(card.fromPriceMinor).toBe(fromUAH(2200));
  });

  it('віддає null, а не нуль, коли принт нікуди не привʼязаний', () => {
    // Нуль на картці читався б як «безкоштовно» — гірше за відсутність ціни.
    expect(toPrintCard(print({ collectionIds: [] }), [tee, hoodie], PRICES).fromPriceMinor).toBeNull();
  });

  it('враховує розмір принта, а не лише виріб', () => {
    const mini = toPrintCard(print({ sizeTier: 'MINI' }), [tee], PRICES).fromPriceMinor;
    const maxi = toPrintCard(print({ sizeTier: 'MAXI' }), [tee], PRICES).fromPriceMinor;
    expect(maxi! - mini!).toBe(fromUAH(200));
  });

  it('«в наявності» — якщо хоч один дозволений виріб має склад', () => {
    expect(toPrintCard(print(), [tee, hoodie], PRICES).inStock).toBe(true);
    expect(toPrintCard(print({ collectionIds: ['c-bar'] }), [tee, hoodie], PRICES).inStock).toBe(false);
  });
});

describe('garmentsFor', () => {
  it('порожньо, коли принт без колекцій — купити його ніде', () => {
    expect(garmentsFor(print({ collectionIds: [] }), [tee, hoodie])).toEqual([]);
  });

  it('не дублює виріб, дозволений двома колекціями принта', () => {
    const both = garmentsFor(print({ collectionIds: ['c-portraits', 'c-bar'] }), [tee, hoodie]);
    expect(both.map((g) => g.id)).toEqual(['g-tee', 'g-hoodie']);
  });
});

describe('garmentTypesFor', () => {
  it('збирає типи виробів по всіх принтах, без повторів', () => {
    expect(garmentTypesFor([print(), print({ id: 'p2', collectionIds: ['c-bar'] })], [tee, hoodie]))
      .toEqual(['HOODIE', 'TSHIRT']);
  });
});
