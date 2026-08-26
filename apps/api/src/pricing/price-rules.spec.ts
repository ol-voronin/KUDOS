import { minor } from '@dt/contracts';
import { describe, expect, it } from 'vitest';
import {
  bestDiscount, discountApplies, discountAmountFor,
  garmentPriceWithModifiers, modifierApplies, quoteLine,
  type DiscountRule, type ModifierSubject, type PriceModifierRule,
} from './price-rules';

const SIZE = { garmentId: 'g1', sizeLabel: '2XL', fabricId: 'f1', colourId: 'c1' } as const satisfies ModifierSubject;

function mod(over: Partial<PriceModifierRule> = {}): PriceModifierRule {
  return {
    id: 'm1', name: 'Великі розміри', target: 'SIZE_LABEL',
    sizeLabel: '2XL', fabricId: null, colourId: null, garmentId: null,
    kind: 'DELTA', amount: 5_000, isActive: true,
    ...over,
  };
}

function disc(over: Partial<DiscountRule> = {}): DiscountRule {
  return {
    id: 'd1', name: 'Опт', scope: 'ALL', garmentId: null, collectionId: null,
    kind: 'PERCENT', amount: 1_000, minQty: 1,
    startsAt: null, endsAt: null, isActive: true,
    ...over,
  };
}

const NOW = new Date('2026-08-26T09:00:00.000Z');
const BASE = minor(55_000);

describe('modifierApplies', () => {
  it('вмикається за написом розміру, а не за виробом', () => {
    expect(modifierApplies(mod(), SIZE)).toBe(true);
    expect(modifierApplies(mod(), { ...SIZE, sizeLabel: 'M' })).toBe(false);
  });

  it('звужене до виробу правило не чіпає інші вироби', () => {
    expect(modifierApplies(mod({ garmentId: 'g1' }), SIZE)).toBe(true);
    expect(modifierApplies(mod({ garmentId: 'g2' }), SIZE)).toBe(false);
  });

  it('вимкнене правило не діє', () => {
    expect(modifierApplies(mod({ isActive: false }), SIZE)).toBe(false);
  });

  it('правило на тканину не спрацьовує від збігу кольору', () => {
    const fabricRule = mod({ target: 'FABRIC', sizeLabel: null, fabricId: 'f1' });
    expect(modifierApplies(fabricRule, SIZE)).toBe(true);
    expect(modifierApplies(fabricRule, { ...SIZE, fabricId: 'f9' })).toBe(false);
  });

  it('не спрацьовує, коли ознака варіанта невідома', () => {
    expect(modifierApplies(mod(), { ...SIZE, sizeLabel: null })).toBe(false);
  });
});

describe('garmentPriceWithModifiers', () => {
  it('складає надбавки й показує кожну окремим рядком', () => {
    const result = garmentPriceWithModifiers(BASE, null, SIZE, [
      mod(),
      mod({ id: 'm2', name: 'Начіс', target: 'FABRIC', sizeLabel: null, fabricId: 'f1', amount: 3_000 }),
    ]);

    expect(result.amountMinor).toBe(63_000);
    expect(result.steps.map((s) => s.label)).toEqual(['База', 'Великі розміри', 'Начіс']);
    expect(result.steps.map((s) => s.amountMinor)).toEqual([55_000, 5_000, 3_000]);
  });

  it('рахує відсотки від бази, а не одне від одного', () => {
    const both = garmentPriceWithModifiers(BASE, null, SIZE, [
      mod({ kind: 'PERCENT', amount: 1_000 }),
      mod({ id: 'm2', name: 'Начіс', target: 'FABRIC', sizeLabel: null, fabricId: 'f1', kind: 'PERCENT', amount: 1_000 }),
    ]);

    // 55000 + 10% + 10% від БАЗИ = 66000. Якби відсотки накладалися один на
    // одний, вийшло б 66550 — і сума залежала б від порядку правил.
    expect(both.amountMinor).toBe(66_000);
  });

  it('не залежить від порядку правил у масиві', () => {
    const a = mod();
    const b = mod({ id: 'm2', name: 'Начіс', target: 'FABRIC', sizeLabel: null, fabricId: 'f1', kind: 'PERCENT', amount: 1_000 });
    const one = garmentPriceWithModifiers(BASE, null, SIZE, [a, b]);
    const two = garmentPriceWithModifiers(BASE, null, SIZE, [b, a]);

    expect(one.amountMinor).toBe(two.amountMinor);
    expect(one.steps).toEqual(two.steps);
  });

  it('ручна ціна варіанта перекриває всі правила', () => {
    const result = garmentPriceWithModifiers(BASE, minor(99_900), SIZE, [mod()]);

    expect(result.amountMinor).toBe(99_900);
    expect(result.steps).toHaveLength(1);
  });

  it('не опускає ціну нижче нуля', () => {
    const result = garmentPriceWithModifiers(BASE, null, SIZE, [mod({ amount: -99_000 })]);
    expect(result.amountMinor).toBe(0);
  });

  it('надбавка в нуль не засмічує розкладку', () => {
    const result = garmentPriceWithModifiers(BASE, null, SIZE, [mod({ amount: 0 })]);
    expect(result.steps).toHaveLength(1);
  });
});

describe('discountApplies', () => {
  it('оптова знижка вмикається з потрібної кількості', () => {
    const rule = disc({ minQty: 10 });
    const subject = { garmentId: 'g1', collectionIds: [], now: NOW };

    expect(discountApplies(rule, { ...subject, quantity: 9 })).toBe(false);
    expect(discountApplies(rule, { ...subject, quantity: 10 })).toBe(true);
  });

  it('вікно дії закрите справа: у момент закінчення знижка вже не діє', () => {
    const rule = disc({ startsAt: new Date('2026-08-01'), endsAt: NOW });
    expect(discountApplies(rule, { garmentId: 'g1', collectionIds: [], quantity: 1, now: NOW })).toBe(false);
  });

  it('знижка на колекцію діє лише для принта з цієї колекції', () => {
    const rule = disc({ scope: 'COLLECTION', collectionId: 'col1' });
    const base = { garmentId: 'g1', quantity: 1, now: NOW };

    expect(discountApplies(rule, { ...base, collectionIds: ['col1'] })).toBe(true);
    expect(discountApplies(rule, { ...base, collectionIds: ['col2'] })).toBe(false);
  });
});

describe('discountAmountFor', () => {
  it('фіксована знижка множиться на кількість', () => {
    expect(discountAmountFor(disc({ kind: 'DELTA', amount: 5_000 }), minor(200_000), 4)).toBe(20_000);
  });

  it('не може перевищити суму рядка', () => {
    expect(discountAmountFor(disc({ kind: 'DELTA', amount: 500_000 }), minor(70_000), 1)).toBe(70_000);
  });
});

describe('bestDiscount', () => {
  const subject = { garmentId: 'g1', collectionIds: [], quantity: 10, now: NOW };

  it('бере одну найвигіднішу, а не суму всіх', () => {
    const best = bestDiscount(
      [disc({ id: 'a', name: 'Опт 10 %', amount: 1_000 }), disc({ id: 'b', name: 'Акція 20 %', amount: 2_000 })],
      subject,
      minor(700_000),
    );

    expect(best?.id).toBe('b');
    expect(best?.amountMinor).toBe(140_000);
  });

  it('за рівних сум результат не залежить від порядку', () => {
    const x = disc({ id: 'a', name: 'Акція' });
    const y = disc({ id: 'b', name: 'Опт' });

    expect(bestDiscount([x, y], subject, minor(700_000))?.id)
      .toBe(bestDiscount([y, x], subject, minor(700_000))?.id);
  });

  it('повертає null, коли нічого не підходить', () => {
    expect(bestDiscount([disc({ minQty: 50 })], subject, minor(700_000))).toBeNull();
  });
});

describe('quoteLine', () => {
  it('рахує повний рядок і пояснює кожну складову', () => {
    const line = quoteLine({
      basePriceMinor: BASE,
      priceOverrideMinor: null,
      printPriceMinor: minor(15_000),
      printLabel: 'Друк (середній)',
      subject: SIZE,
      modifiers: [mod()],
      discounts: [disc({ name: 'Опт від 10', amount: 1_000, minQty: 10 })],
      discountSubject: { garmentId: 'g1', collectionIds: [], quantity: 10, now: NOW },
    });

    // 55000 + 5000 = 60000 виріб; +15000 друк = 75000 одиниця; ×10 = 750000;
    // −10 % = 75000 знижки; до сплати 675000.
    expect(line.unitMinor).toBe(75_000);
    expect(line.subtotalMinor).toBe(750_000);
    expect(line.discount?.amountMinor).toBe(75_000);
    expect(line.totalMinor).toBe(675_000);
    expect(line.steps.map((s) => s.label)).toEqual(['База', 'Великі розміри', 'Друк (середній)']);
  });

  it('без друку рядка про друк немає', () => {
    const line = quoteLine({
      basePriceMinor: BASE,
      priceOverrideMinor: null,
      printPriceMinor: null,
      printLabel: 'Друк',
      subject: SIZE,
      modifiers: [],
      discounts: [],
      discountSubject: { garmentId: 'g1', collectionIds: [], quantity: 1, now: NOW },
    });

    expect(line.steps).toHaveLength(1);
    expect(line.totalMinor).toBe(55_000);
  });

  it('сума рядків розкладки дорівнює ціні одиниці', () => {
    const line = quoteLine({
      basePriceMinor: BASE,
      priceOverrideMinor: null,
      printPriceMinor: minor(15_000),
      printLabel: 'Друк',
      subject: SIZE,
      modifiers: [
        mod(),
        mod({ id: 'm2', name: 'Начіс', target: 'FABRIC', sizeLabel: null, fabricId: 'f1', kind: 'PERCENT', amount: 500 }),
        mod({ id: 'm3', name: 'Непопулярний колір', target: 'COLOUR', sizeLabel: null, colourId: 'c1', amount: -2_000 }),
      ],
      discounts: [],
      discountSubject: { garmentId: 'g1', collectionIds: [], quantity: 1, now: NOW },
    });

    const sum = line.steps.reduce((acc, s) => acc + s.amountMinor, 0);
    expect(sum).toBe(line.unitMinor);
  });
});
