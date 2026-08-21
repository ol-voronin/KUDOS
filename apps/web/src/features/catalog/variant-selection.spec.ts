import { describe, expect, it } from 'vitest';
import type { ColourDto, SizeDto, VariantDto } from '@dt/contracts';
import { selectableColours, selectableSizes } from './variant-selection';

const colour = (id: string, name: string): ColourDto => ({
  id, name, supplierCode: name, hex: null, imageUrl: null,
});

const size = (id: string, label: string, position: number): SizeDto => ({
  id, label, position, measurements: [],
});

const variant = (over: Partial<VariantDto> & Pick<VariantDto, 'id'>): VariantDto => ({
  sku: over.id,
  garmentId: 'g1',
  fabricId: 'f1',
  colourId: 'c1',
  sizeId: 's1',
  availability: 'IN_STOCK',
  leadTimeDays: null,
  priceOverrideMinor: null,
  ...over,
} as VariantDto);

describe('selectableColours', () => {
  const colours = [colour('c1', 'Чорний'), colour('c2', 'Мандариновий'), colour('c3', 'Аквамарин')];

  it('marks a stocked colour available', () => {
    const result = selectableColours(colours, [variant({ id: 'v1', colourId: 'c1' })], 'g1', 'f1');
    expect(result).toHaveLength(1);
    expect(result[0]?.state).toBe('AVAILABLE');
  });

  it('marks a made-to-order colour with its shortest lead time', () => {
    const result = selectableColours(
      colours,
      [
        variant({ id: 'v1', colourId: 'c2', availability: 'MADE_TO_ORDER', leadTimeDays: 14 }),
        variant({ id: 'v2', colourId: 'c2', sizeId: 's2', availability: 'MADE_TO_ORDER', leadTimeDays: 10 }),
      ],
      'g1', 'f1',
    );
    expect(result[0]?.state).toBe('MADE_TO_ORDER');
    expect(result[0]?.leadTimeDays).toBe(10);
  });

  it('treats made-to-order without a lead time as unavailable', () => {
    const result = selectableColours(
      colours,
      [variant({ id: 'v1', colourId: 'c3', availability: 'MADE_TO_ORDER', leadTimeDays: null })],
      'g1', 'f1',
    );
    expect(result[0]?.state).toBe('UNAVAILABLE');
  });

  it('treats an over-long lead time as unavailable rather than sellable', () => {
    const result = selectableColours(
      colours,
      [variant({ id: 'v1', colourId: 'c3', availability: 'MADE_TO_ORDER', leadTimeDays: 45 })],
      'g1', 'f1',
    );
    expect(result[0]?.state).toBe('UNAVAILABLE');
  });

  it('hides colours that do not exist in the chosen fabric', () => {
    const result = selectableColours(colours, [variant({ id: 'v1', colourId: 'c1', fabricId: 'f2' })], 'g1', 'f1');
    expect(result).toHaveLength(0);
  });

  it('prefers in-stock when a colour has both states', () => {
    const result = selectableColours(
      colours,
      [
        variant({ id: 'v1', colourId: 'c1', availability: 'MADE_TO_ORDER', leadTimeDays: 7 }),
        variant({ id: 'v2', colourId: 'c1', sizeId: 's2', availability: 'IN_STOCK' }),
      ],
      'g1', 'f1',
    );
    expect(result[0]?.state).toBe('AVAILABLE');
  });
});

describe('selectableSizes', () => {
  const sizes = [size('s1', 'XS', 0), size('s2', 'S', 1), size('s3', 'M', 2)];

  it('scopes sizes to the chosen colour', () => {
    const result = selectableSizes(
      sizes,
      [variant({ id: 'v1', sizeId: 's1' }), variant({ id: 'v2', sizeId: 's2', colourId: 'c2' })],
      'g1', 'f1', 'c1',
    );
    expect(result.find((s) => s.label === 'XS')?.state).toBe('AVAILABLE');
    expect(result.find((s) => s.label === 'S')).toBeUndefined();
  });
});
