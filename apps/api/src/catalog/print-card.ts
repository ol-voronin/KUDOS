import type { PrintCardDto, PrintSizeTier } from '@dt/contracts';
import type { PrintPriceTable } from '../pricing/pricing.domain';

/**
 * Складання плитки принта для будь-якої сітки.
 *
 * Винесено в чисту функцію з однієї причини: «від скількох» і «чи є в
 * наявності» рахуються не з полів принта, а з ланцюжка
 * `принт → колекції → правила → вироби → варіанти`. Робити це запитом на
 * кожен принт — рівно той N+1, через який сторінка каталогу перетворюється
 * на сорок запитів. Тому вироби вантажаться один раз, а тут відбувається
 * лише арифметика.
 */

export interface OfferableGarment {
  readonly id: string;
  readonly basePriceMinor: number;
  readonly type: string;
  /** Колекції, на яких цей виріб дозволений правилом. */
  readonly collectionIds: readonly string[];
  /** Чи є хоч один варіант цього виробу в наявності. */
  readonly hasStock: boolean;
}

export interface PrintRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly sizeTier: PrintSizeTier;
  readonly previewUrl: string;
  readonly collectionIds: readonly string[];
}

/** Вироби, на яких цей принт узагалі можна надрукувати. */
export function garmentsFor(print: PrintRow, garments: readonly OfferableGarment[]): OfferableGarment[] {
  if (print.collectionIds.length === 0) return [];
  const wanted = new Set(print.collectionIds);
  return garments.filter((g) => g.collectionIds.some((id) => wanted.has(id)));
}

export function toPrintCard(
  print: PrintRow,
  garments: readonly OfferableGarment[],
  printPrices: PrintPriceTable,
): PrintCardDto {
  const offerable = garmentsFor(print, garments);
  const printPrice = printPrices[print.sizeTier];

  // Ціни немає, коли принт нікуди не привʼязаний — і це не нуль, а «невідомо».
  // Нуль на картці означав би «безкоштовно», що гірше за відсутність цифри.
  const cheapest = offerable.length === 0
    ? null
    : Math.min(...offerable.map((g) => g.basePriceMinor));

  return {
    id: print.id,
    slug: print.slug,
    title: print.title,
    sizeTier: print.sizeTier,
    previewUrl: print.previewUrl,
    fromPriceMinor: cheapest === null || printPrice === undefined ? null : cheapest + printPrice,
    inStock: offerable.some((g) => g.hasStock),
  };
}

/** Типи виробів, доступних для набору принтів — для фільтра на породній сторінці. */
export function garmentTypesFor(
  prints: readonly PrintRow[],
  garments: readonly OfferableGarment[],
): string[] {
  const types = new Set<string>();
  for (const print of prints) {
    for (const garment of garmentsFor(print, garments)) types.add(garment.type);
  }
  return [...types].sort();
}
