import { describe, expect, it } from 'vitest';
import { fromUAH, minor, type Minor, type PrintSizeTier } from '@dt/contracts';
import {
  blockReasonFor,
  designPriceForHours,
  MAX_CART_LEAD_TIME_DAYS,
  type OfferedOn,
  priceBlankOffer,
  priceOffer,
  type PricingGarment,
  type PricingPrint,
  type PricingVariant,
  type PrintPriceTable,
  quoteCustom,
  totalCart,
} from './pricing.domain';

/** «Дозволено всюди» — найчастіший випадок у тестах. */
const OFFERED: OfferedOn = { onGarment: true, onColour: true };

const PRINT_PRICES: PrintPriceTable = {
  MINI: fromUAH(500),
  MEDIUM: fromUAH(600),
  MAXI: fromUAH(700),
};

const garment = (over: Partial<PricingGarment> = {}): PricingGarment => ({
  id: 'g1',
  basePriceMinor: fromUAH(1600),
  isPublished: true,
  ...over,
});

const print = (over: Partial<PricingPrint> = {}): PricingPrint => ({
  id: 'p1',
  sizeTier: 'MEDIUM' as PrintSizeTier,
  isPublished: true,
  ...over,
});

const variant = (over: Partial<PricingVariant> = {}): PricingVariant => ({
  id: 'v1',
  availability: 'IN_STOCK',
  leadTimeDays: null,
  priceOverrideMinor: null,
  sizeLabel: 'M',
  fabricId: 'f1',
  colourId: 'c1',
  ...over,
});

describe('priceOffer', () => {
  it('adds the garment price and the print price', () => {
    const offer = priceOffer(garment(), print(), variant(), PRINT_PRICES, OFFERED, []);
    expect(offer.garmentPriceMinor).toBe(160_000);
    expect(offer.printPriceMinor).toBe(60_000);
    expect(offer.totalMinor).toBe(220_000);
    expect(offer.purchasable).toBe(true);
    expect(offer.blockedReason).toBeNull();
  });

  it('prefers the variant price override over the garment base price', () => {
    const offer = priceOffer(
      garment(),
      print(),
      variant({ priceOverrideMinor: fromUAH(1850) }),
      PRINT_PRICES,
      OFFERED,
      [],
    );
    expect(offer.garmentPriceMinor).toBe(185_000);
    expect(offer.totalMinor).toBe(245_000);
  });

  it('prices each tier from the table rather than from the print method', () => {
    const tiers: PrintSizeTier[] = ['MINI', 'MEDIUM', 'MAXI'];
    const totals = tiers.map(
      (t) => priceOffer(garment(), print({ sizeTier: t }), variant(), PRINT_PRICES, OFFERED, []).printPriceMinor,
    );
    expect(totals).toEqual([50_000, 60_000, 70_000]);
  });

  it('застосовує надбавки й повертає розкладку', () => {
    const offer = priceOffer(garment(), print(), variant({ sizeLabel: '2XL' }), PRINT_PRICES, OFFERED, [{
      id: 'm1', name: 'Великі розміри', target: 'SIZE_LABEL',
      sizeLabel: '2XL', fabricId: null, colourId: null, garmentId: null,
      kind: 'DELTA', amount: 5_000, isActive: true,
    }]);

    expect(offer.garmentPriceMinor).toBe(165_000);
    expect(offer.totalMinor).toBe(225_000);
    expect(offer.steps.map((s) => s.label)).toEqual(['База', 'Великі розміри']);
  });

  it('reports the lead time only for made-to-order variants', () => {
    const inStock = priceOffer(garment(), print(), variant(), PRINT_PRICES, OFFERED, []);
    expect(inStock.leadTimeDays).toBeNull();

    const mto = priceOffer(
      garment(),
      print(),
      variant({ availability: 'MADE_TO_ORDER', leadTimeDays: 10 }),
      PRINT_PRICES,
      OFFERED,
      [],
    );
    expect(mto.leadTimeDays).toBe(10);
    expect(mto.purchasable).toBe(true);
  });
});

describe('blockReasonFor', () => {
  it('allows an in-stock variant', () => {
    expect(blockReasonFor(garment(), print(), variant(), OFFERED)).toBeNull();
  });

  it('blocks an unavailable variant', () => {
    expect(blockReasonFor(garment(), print(), variant({ availability: 'UNAVAILABLE' }), OFFERED))
      .toBe('VARIANT_UNAVAILABLE');
  });

  it('blocks made-to-order with no lead time — the data-bug guard', () => {
    expect(
      blockReasonFor(garment(), print(), variant({ availability: 'MADE_TO_ORDER', leadTimeDays: null }), OFFERED),
    ).toBe('MISSING_LEAD_TIME');
  });

  it('accepts a lead time exactly on the boundary', () => {
    expect(
      blockReasonFor(
        garment(), print(),
        variant({ availability: 'MADE_TO_ORDER', leadTimeDays: MAX_CART_LEAD_TIME_DAYS }),
        OFFERED,
      ),
    ).toBeNull();
  });

  it('blocks a lead time one day past the boundary', () => {
    expect(
      blockReasonFor(
        garment(), print(),
        variant({ availability: 'MADE_TO_ORDER', leadTimeDays: MAX_CART_LEAD_TIME_DAYS + 1 }),
        OFFERED,
      ),
    ).toBe('LEAD_TIME_TOO_LONG');
  });

  it('blocks a print that the collection does not offer on this garment', () => {
    expect(blockReasonFor(garment(), print(), variant(), { onGarment: false, onColour: true }))
      .toBe('PRINT_NOT_OFFERED_ON_GARMENT');
  });

  it('blocks a colour the print is excluded from — песи в барі не на оранжевому', () => {
    expect(blockReasonFor(garment(), print(), variant(), { onGarment: true, onColour: false }))
      .toBe('COLOUR_NOT_OFFERED_FOR_PRINT');
  });

  it('checks publication before availability', () => {
    expect(
      blockReasonFor(garment({ isPublished: false }), print(), variant({ availability: 'UNAVAILABLE' }), OFFERED),
    ).toBe('GARMENT_UNPUBLISHED');
  });
});

describe('priceBlankOffer', () => {
  it('charges the garment only — no print line at all', () => {
    const offer = priceBlankOffer(garment(), variant(), []);
    expect(offer.garmentPriceMinor).toBe(160_000);
    expect(offer.printPriceMinor).toBe(0);
    expect(offer.totalMinor).toBe(160_000);
    expect(offer.printId).toBe('');
    expect(offer.purchasable).toBe(true);
  });

  it('applies size modifiers the same way the printed offer does', () => {
    const offer = priceBlankOffer(garment(), variant({ sizeLabel: '2XL' }), [{
      id: 'm1', name: 'Великі розміри', target: 'SIZE_LABEL',
      sizeLabel: '2XL', fabricId: null, colourId: null, garmentId: null,
      kind: 'DELTA', amount: 5_000, isActive: true,
    }]);
    expect(offer.totalMinor).toBe(165_000);
  });

  it('blocks an unpublished garment and an unavailable variant', () => {
    expect(priceBlankOffer(garment({ isPublished: false }), variant(), []).purchasable).toBe(false);
    const gone = priceBlankOffer(garment(), variant({ availability: 'UNAVAILABLE' }), []);
    expect(gone.purchasable).toBe(false);
    expect(gone.blockedReason).toMatch(/кольору або розміру/);
  });
});

describe('totalCart', () => {
  const ok = priceOffer(garment(), print(), variant(), PRINT_PRICES, OFFERED, []);

  it('multiplies by quantity without floating point drift', () => {
    const { subtotalMinor } = totalCart([{ offer: ok, quantity: 3 }]);
    expect(subtotalMinor).toBe(660_000);
  });

  it('returns the longest lead time across the cart', () => {
    const slow = priceOffer(
      garment(), print(),
      variant({ id: 'v2', availability: 'MADE_TO_ORDER', leadTimeDays: 14 }),
      PRINT_PRICES, OFFERED, [],
    );
    const { maxLeadTimeDays } = totalCart([
      { offer: ok, quantity: 1 },
      { offer: slow, quantity: 1 },
    ]);
    expect(maxLeadTimeDays).toBe(14);
  });

  it('throws rather than silently dropping a non-purchasable line', () => {
    const blocked = priceOffer(
      garment(), print(), variant({ availability: 'UNAVAILABLE' }), PRINT_PRICES, OFFERED, [],
    );
    expect(() => totalCart([{ offer: blocked, quantity: 1 }])).toThrow(/not purchasable/);
  });

  it('rejects a zero or fractional quantity', () => {
    expect(() => totalCart([{ offer: ok, quantity: 0 }])).toThrow(RangeError);
    expect(() => totalCart([{ offer: ok, quantity: 1.5 }])).toThrow(RangeError);
  });

  it('is empty-safe', () => {
    expect(totalCart([])).toEqual({ subtotalMinor: 0, maxLeadTimeDays: 0 });
  });
});

describe('quoteCustom', () => {
  const base = {
    garmentPriceMinor: fromUAH(1700),
    printPriceMinor: fromUAH(700),
    designPriceMinor: fromUAH(3200),
    suppliedArtworkDiscountMinor: fromUAH(150),
  };

  it('applies no discount when the customer brings nothing', () => {
    const q = quoteCustom({ ...base, customerSuppliedArtwork: false });
    expect(q.discountMinor).toBe(0);
    expect(q.totalMinor).toBe(560_000);
  });

  it('applies the 150 UAH discount when the customer brings artwork', () => {
    const q = quoteCustom({ ...base, customerSuppliedArtwork: true });
    expect(q.discountMinor).toBe(15_000);
    expect(q.designPriceMinor).toBe(305_000);
    expect(q.totalMinor).toBe(545_000);
  });

  it('never drives the design line negative', () => {
    const q = quoteCustom({
      ...base,
      designPriceMinor: fromUAH(100),
      customerSuppliedArtwork: true,
    });
    expect(q.designPriceMinor).toBe(0);
    expect(q.discountMinor).toBe(10_000);
    expect(q.totalMinor).toBe(240_000);
  });
});

describe('designPriceForHours', () => {
  it('turns the 16-hour reality into a number', () => {
    // Every 100 UAH/h adds 1600 UAH to the price of a from-zero job.
    expect(designPriceForHours(16, fromUAH(100))).toBe(160_000);
    expect(designPriceForHours(16, fromUAH(200))).toBe(320_000);
  });

  it('rejects nonsense input', () => {
    expect(() => designPriceForHours(0, fromUAH(100))).toThrow(RangeError);
    expect(() => designPriceForHours(-1, fromUAH(100))).toThrow(RangeError);
  });
});

describe('money guards', () => {
  it('refuses a fractional kopiyka', () => {
    expect(() => minor(1.5)).toThrow(TypeError);
  });

  it('refuses sub-kopiyka UAH input', () => {
    expect(() => fromUAH(10.001)).toThrow(RangeError);
  });

  it('accepts two decimal places', () => {
    const m: Minor = fromUAH(1599.99);
    expect(m).toBe(159_999);
  });
});
