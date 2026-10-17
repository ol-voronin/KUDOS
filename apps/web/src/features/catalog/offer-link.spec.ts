import { describe, expect, it } from 'vitest';
import type { GarmentDto, PrintOfferDto } from '@dt/contracts';
import { printOfferPath, resolvePreselect } from './offer-link';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const garment = (n: number, slug: string, sizes: string[]): GarmentDto => ({
  id: uuid(n), slug, line: 'OWN_PRODUCTION', type: 'TSHIRT', fit: 'CLASSIC', name: slug,
  lengthAdjustable: false, basePriceMinor: 59_000, description: '',
  fabrics: [{ id: uuid(n + 50), name: 'f', weightGsm: 180, composition: 'c', origin: null }],
  sizes: sizes.map((label, i) => ({ id: uuid(n * 100 + i), label, position: i, measurements: [] })),
});

const TEE = garment(1, 'futbolka-klasychna', ['S', 'M']);
const HOODIE = garment(2, 'hudi-klasychnyi', ['M', 'XXS/XS']);
const BLACK = { id: uuid(901), name: 'Чорний', supplierCode: 'chornyi', hex: null, imageUrl: null };
const WHITE = { id: uuid(902), name: 'Білий', supplierCode: 'bilyi', hex: null, imageUrl: null };

let n = 1000;
const v = (g: GarmentDto, colourId: string, sizeIndex: number) => ({
  id: uuid(n++), sku: `${g.slug}-${colourId}-${sizeIndex}`, garmentId: g.id, fabricId: g.fabrics[0]!.id,
  colourId, sizeId: g.sizes[sizeIndex]!.id, availability: 'IN_STOCK' as const, leadTimeDays: null,
  priceOverrideMinor: null, priceMinor: g.basePriceMinor,
});

const OFFER: Pick<PrintOfferDto, 'garments' | 'colours' | 'variants'> = {
  garments: [TEE, HOODIE],
  colours: [BLACK, WHITE],
  variants: [v(TEE, BLACK.id, 0), v(TEE, BLACK.id, 1), v(HOODIE, BLACK.id, 0), v(HOODIE, BLACK.id, 1), v(HOODIE, WHITE.id, 0)],
};

const params = (path: string) => new URL(`https://babaka.shop${path}`).searchParams;

describe('printOfferPath / resolvePreselect', () => {
  it('адреса з фіду відкриває саме той виріб, колір і розмір', () => {
    const path = printOfferPath('polo-shpits', { garmentSlug: 'hudi-klasychnyi', colourCode: 'chornyi', sizeLabel: 'XXS/XS' });
    expect(path).toBe('/prints/polo-shpits?garment=hudi-klasychnyi&colour=chornyi&size=XXS%2FXS');
    expect(resolvePreselect(OFFER, params(path))).toEqual({
      garmentId: HOODIE.id, fabricId: HOODIE.fabrics[0]!.id, colourId: BLACK.id, sizeId: HOODIE.sizes[1]!.id,
    });
  });

  it('без параметрів або з чужим виробом — нічого не обирає', () => {
    expect(resolvePreselect(OFFER, params('/prints/x'))).toBeNull();
    expect(resolvePreselect(OFFER, params('/prints/x?garment=nema'))).toBeNull();
  });

  it('колір, якого немає на виробі, відкидається, виріб лишається', () => {
    const pick = resolvePreselect(OFFER, params('/prints/x?garment=futbolka-klasychna&colour=bilyi&size=M'));
    expect(pick).toEqual({ garmentId: TEE.id, fabricId: TEE.fabrics[0]!.id, colourId: null, sizeId: null });
  });

  it('розмір, якого немає в цьому кольорі, відкидається, колір лишається', () => {
    const pick = resolvePreselect(OFFER, params('/prints/x?garment=hudi-klasychnyi&colour=bilyi&size=XXS%2FXS'));
    expect(pick).toEqual({ garmentId: HOODIE.id, fabricId: HOODIE.fabrics[0]!.id, colourId: WHITE.id, sizeId: null });
  });
});
