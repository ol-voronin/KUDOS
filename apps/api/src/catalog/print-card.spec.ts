import { describe, expect, it } from 'vitest';
import { fromUAH } from '@dt/contracts';
import {
  garmentsFor, garmentTypesFor, toPrintCard,
  type OfferContext, type OfferableGarment, type PrintRow,
} from './print-card';
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

/**
 * Контекст за замовчуванням: обидві колекції реально щось обмежують, заборон
 * немає. Тести, яким потрібен інший стан, перевизначають поле явно — так
 * видно, яка саме умова перевіряється.
 */
const ctx = (over: Partial<OfferContext> = {}): OfferContext => ({
  garments: [tee, hoodie],
  restrictedCollectionIds: new Set(['c-portraits', 'c-bar']),
  exclusionsByPrint: new Map(),
  ...over,
});

const print = (over: Partial<PrintRow> = {}): PrintRow => ({
  id: 'p1', slug: 'korhi', title: 'Коргі', sizeTier: 'MEDIUM',
  previewUrl: 'https://example.com/1.jpg', collectionIds: ['c-portraits'], ...over,
});

describe('toPrintCard', () => {
  it('бере найдешевший виріб, на якому принт дозволений, і додає друк', () => {
    // 590 футболка + 600 друк MEDIUM = 1190, а не 1600 худі.
    expect(toPrintCard(print(), ctx(), PRICES).fromPriceMinor).toBe(fromUAH(1190));
  });

  it('рахує ціну від того виробу, який реально дозволений колекцією', () => {
    // Колекція «в барі» має лише худі — футболки в ній немає.
    const card = toPrintCard(print({ collectionIds: ['c-bar'] }), ctx(), PRICES);
    expect(card.fromPriceMinor).toBe(fromUAH(2200));
  });

  it('друкує на всьому, коли принт не привʼязаний до колекції', () => {
    // Це та сама ситуація, через яку сторінка принта відкривалася порожньою:
    // раніше тут була відповідь null. Принт без колекції — це принт без
    // жанру, а не принт без товару.
    const card = toPrintCard(print({ collectionIds: [] }), ctx(), PRICES);
    expect(card.fromPriceMinor).toBe(fromUAH(1190));
  });

  it('друкує на всьому, коли колекція принта нічого не обмежує', () => {
    const card = toPrintCard(print({ collectionIds: ['c-bar'] }), ctx({ restrictedCollectionIds: new Set() }), PRICES);
    expect(card.fromPriceMinor).toBe(fromUAH(1190));
  });

  it('віддає null, коли обмеження є, але жоден виріб під нього не підпадає', () => {
    // Колекція обмежує на виріб, якого зараз немає у вітрині. Продати нема
    // на чому — і це не те саме, що «обмежень немає».
    const card = toPrintCard(
      print({ collectionIds: ['c-gone'] }),
      ctx({ restrictedCollectionIds: new Set(['c-gone']) }),
      PRICES,
    );
    expect(card.fromPriceMinor).toBeNull();
  });

  it('точкова заборона прибирає окремий виріб', () => {
    const card = toPrintCard(
      print(),
      ctx({ exclusionsByPrint: new Map([['p1', new Set(['g-tee'])]]) }),
      PRICES,
    );
    expect(card.fromPriceMinor).toBe(fromUAH(2200));
  });

  it('заборона стосується лише свого принта', () => {
    const card = toPrintCard(
      print({ id: 'p2' }),
      ctx({ exclusionsByPrint: new Map([['p1', new Set(['g-tee'])]]) }),
      PRICES,
    );
    expect(card.fromPriceMinor).toBe(fromUAH(1190));
  });

  it('враховує розмір принта, а не лише виріб', () => {
    const only = ctx({ garments: [tee] });
    const mini = toPrintCard(print({ sizeTier: 'MINI' }), only, PRICES).fromPriceMinor;
    const maxi = toPrintCard(print({ sizeTier: 'MAXI' }), only, PRICES).fromPriceMinor;
    expect(maxi! - mini!).toBe(fromUAH(200));
  });

  it('«в наявності» — якщо хоч один дозволений виріб має склад', () => {
    expect(toPrintCard(print(), ctx(), PRICES).inStock).toBe(true);
    expect(toPrintCard(print({ collectionIds: ['c-bar'] }), ctx(), PRICES).inStock).toBe(false);
  });
});

describe('garmentsFor', () => {
  it('увесь асортимент, коли принт без колекцій', () => {
    expect(garmentsFor(print({ collectionIds: [] }), ctx()).map((g) => g.id))
      .toEqual(['g-tee', 'g-hoodie']);
  });

  it('не дублює виріб, дозволений двома колекціями принта', () => {
    const both = garmentsFor(print({ collectionIds: ['c-portraits', 'c-bar'] }), ctx());
    expect(both.map((g) => g.id)).toEqual(['g-tee', 'g-hoodie']);
  });
});

describe('garmentTypesFor', () => {
  it('збирає типи виробів по всіх принтах, без повторів', () => {
    expect(garmentTypesFor([print(), print({ id: 'p2', collectionIds: ['c-bar'] })], ctx()))
      .toEqual(['HOODIE', 'TSHIRT']);
  });
});
