import type { PrintCardDto, PrintSizeTier } from '@dt/contracts';
import type { PrintPriceTable } from '../pricing/pricing.domain';

/**
 * Складання плитки принта для будь-якої сітки.
 *
 * Винесено в чисту функцію з однієї причини: «від скількох» і «чи є в
 * наявності» рахуються не з полів принта, а з ланцюжка
 * `принт → колекції → правила → вироби → варіанти`. Робити це запитом на
 * кожен принт — рівно той N+1, через який сторінка каталогу перетворюється
 * на сорок запитів. Тому контекст вантажиться один раз, а тут відбувається
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

/**
 * Усе, що потрібно знати про пропозицію, зібране одним запитом на сторінку.
 *
 * `restrictedCollectionIds` існує окремо від `OfferableGarment.collectionIds`
 * навмисно. Без нього неможливо відрізнити два різні стани: «колекція нічого
 * не обмежує» (правил немає — друкуємо на всьому) і «колекція обмежує, але
 * жоден дозволений виріб зараз не опублікований» (продавати нема на чому).
 * Перший стан має відкривати весь асортимент, другий — не відкривати нічого,
 * і плутати їх не можна.
 */
export interface OfferContext {
  readonly garments: readonly OfferableGarment[];
  readonly restrictedCollectionIds: ReadonlySet<string>;
  /** printId → вироби, заборонені точково на цьому принті. */
  readonly exclusionsByPrint: ReadonlyMap<string, ReadonlySet<string>>;
}

export interface PrintRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly sizeTier: PrintSizeTier;
  readonly previewUrl: string;
  readonly collectionIds: readonly string[];
}

/**
 * Вироби, на яких цей принт можна надрукувати.
 *
 * За замовчуванням — усі опубліковані. Колекційне правило звужує вибір лише
 * тоді, коли воно справді заведене; точкова заборона прибирає окремий виріб.
 * Раніше було навпаки — дозвіл вимагався явно, і принт без колекції не
 * продавався ніде, хоч у базі з ним усе було гаразд.
 */
export function garmentsFor(print: PrintRow, ctx: OfferContext): OfferableGarment[] {
  const restricting = print.collectionIds.filter((id) => ctx.restrictedCollectionIds.has(id));

  const base = restricting.length === 0
    ? [...ctx.garments]
    : ctx.garments.filter((g) => g.collectionIds.some((id) => restricting.includes(id)));

  const banned = ctx.exclusionsByPrint.get(print.id);
  return banned === undefined ? base : base.filter((g) => !banned.has(g.id));
}

export function toPrintCard(
  print: PrintRow,
  ctx: OfferContext,
  printPrices: PrintPriceTable,
): PrintCardDto {
  const offerable = garmentsFor(print, ctx);
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
export function garmentTypesFor(prints: readonly PrintRow[], ctx: OfferContext): string[] {
  const types = new Set<string>();
  for (const print of prints) {
    for (const garment of garmentsFor(print, ctx)) types.add(garment.type);
  }
  return [...types].sort();
}
