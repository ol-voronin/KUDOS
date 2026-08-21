import type { ColourDto, SizeDto, VariantDto } from '@dt/contracts';

/**
 * Which colours and sizes a customer may actually pick.
 *
 * The rule this encodes: a colour that exists on a swatch card is not the same
 * thing as a colour you can buy. Own production guarantees one colour in stock
 * and makes the rest to order, so the selector must show three states, not two
 * — available, made to order with a promised date, and out.
 *
 * Pure functions: no React, no fetching, fully unit-testable.
 */

export type Selectability = 'AVAILABLE' | 'MADE_TO_ORDER' | 'UNAVAILABLE';

export interface SelectableColour extends ColourDto {
  readonly state: Selectability;
  readonly leadTimeDays: number | null;
}

export interface SelectableSize extends SizeDto {
  readonly state: Selectability;
  readonly leadTimeDays: number | null;
}

const MAX_CART_LEAD_TIME_DAYS = 21;

function stateOf(variants: readonly VariantDto[]): { state: Selectability; leadTimeDays: number | null } {
  if (variants.some((v) => v.availability === 'IN_STOCK')) {
    return { state: 'AVAILABLE', leadTimeDays: null };
  }
  const mto = variants
    .filter((v) => v.availability === 'MADE_TO_ORDER' && v.leadTimeDays !== null)
    .map((v) => v.leadTimeDays as number)
    .filter((d) => d <= MAX_CART_LEAD_TIME_DAYS);

  if (mto.length > 0) {
    return { state: 'MADE_TO_ORDER', leadTimeDays: Math.min(...mto) };
  }
  return { state: 'UNAVAILABLE', leadTimeDays: null };
}

/** Colours for the chosen garment + fabric. Anything else is not shown. */
export function selectableColours(
  colours: readonly ColourDto[],
  variants: readonly VariantDto[],
  garmentId: string,
  fabricId: string,
): SelectableColour[] {
  const scoped = variants.filter((v) => v.garmentId === garmentId && v.fabricId === fabricId);
  const byColour = new Map<string, VariantDto[]>();
  for (const v of scoped) {
    const list = byColour.get(v.colourId);
    if (list) list.push(v);
    else byColour.set(v.colourId, [v]);
  }

  return colours
    .filter((c) => byColour.has(c.id))
    .map((c) => ({ ...c, ...stateOf(byColour.get(c.id) ?? []) }));
}

/** Sizes for the chosen garment + fabric + colour. */
export function selectableSizes(
  sizes: readonly SizeDto[],
  variants: readonly VariantDto[],
  garmentId: string,
  fabricId: string,
  colourId: string,
): SelectableSize[] {
  const scoped = variants.filter(
    (v) => v.garmentId === garmentId && v.fabricId === fabricId && v.colourId === colourId,
  );
  return sizes
    .map((s) => ({ ...s, ...stateOf(scoped.filter((v) => v.sizeId === s.id)) }))
    .filter((s) => s.state !== 'UNAVAILABLE' || scoped.some((v) => v.sizeId === s.id));
}

export function findVariant(
  variants: readonly VariantDto[],
  garmentId: string,
  fabricId: string,
  colourId: string,
  sizeId: string,
): VariantDto | undefined {
  return variants.find(
    (v) =>
      v.garmentId === garmentId &&
      v.fabricId === fabricId &&
      v.colourId === colourId &&
      v.sizeId === sizeId,
  );
}
