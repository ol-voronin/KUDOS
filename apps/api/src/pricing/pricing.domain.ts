/**
 * Pricing and purchasability rules.
 *
 * Pure functions, no Nest, no Prisma, no I/O. Everything here is decided from
 * its arguments, which is what makes it cheap to test exhaustively and safe to
 * call from a controller, a job, or a seed script.
 *
 * Two rules carry most of the weight:
 *
 *  1. Price is always `garment + print`, both integers, snapshotted at
 *     checkout. There is no percentage, no rate, no float.
 *
 *  2. A variant is purchasable only when the shop can actually ship it.
 *     Own-production guarantees exactly one colour in stock; everything else
 *     is "we'll sew it, delivery from another city takes longer". Selling that
 *     from a cart without a lead time is how you end up cancelling orders.
 */

import {
  addMinor,
  clampToZero,
  type Minor,
  minor,
  type PrintSizeTier,
  subMinor,
  type VariantAvailability,
} from '@dt/contracts';
import {
  garmentPriceWithModifiers,
  type ModifiedPrice,
  type PriceModifierRule,
  type PriceStep,
} from './price-rules';

/** Beyond this, we do not let a made-to-order item into the cart. */
export const MAX_CART_LEAD_TIME_DAYS = 21;

export interface PricingVariant {
  readonly id: string;
  readonly availability: VariantAvailability;
  readonly leadTimeDays: number | null;
  readonly priceOverrideMinor: Minor | null;
  /**
   * Ознаки, за якими шукаються надбавки. Обовʼязкові, хоч і можуть бути
   * `null`: якби вони були необовʼязковими полями, місце виклику, яке про
   * них забуло, продовжило б рахувати ціну — просто без надбавок. Помилку в
   * бік «дешевше, ніж має бути» ніхто не помічає, доки не зведе касу.
   */
  readonly sizeLabel: string | null;
  readonly fabricId: string | null;
  readonly colourId: string | null;
}

export interface PricingGarment {
  readonly id: string;
  readonly basePriceMinor: Minor;
  readonly isPublished: boolean;
}

export interface PricingPrint {
  readonly id: string;
  readonly sizeTier: PrintSizeTier;
  readonly isPublished: boolean;
}

export type PrintPriceTable = Readonly<Record<PrintSizeTier, Minor>>;

export interface PricedOffer {
  readonly variantId: string;
  readonly printId: string;
  readonly garmentPriceMinor: Minor;
  /** Розкладка ціни виробу: база й кожна надбавка окремим рядком. */
  readonly steps: readonly PriceStep[];
  readonly printPriceMinor: Minor;
  readonly totalMinor: Minor;
  readonly purchasable: boolean;
  readonly blockedReason: string | null;
  readonly leadTimeDays: number | null;
}

export type BlockReason =
  | 'GARMENT_UNPUBLISHED'
  | 'PRINT_UNPUBLISHED'
  | 'VARIANT_UNAVAILABLE'
  | 'MISSING_LEAD_TIME'
  | 'LEAD_TIME_TOO_LONG'
  | 'PRINT_NOT_OFFERED_ON_GARMENT'
  | 'COLOUR_NOT_OFFERED_FOR_PRINT';

/** Messages are shown to the customer verbatim, so they are written for them. */
const BLOCK_MESSAGES: Readonly<Record<BlockReason, string>> = {
  GARMENT_UNPUBLISHED: 'Цей виріб зараз недоступний.',
  PRINT_UNPUBLISHED: 'Цей принт зараз недоступний.',
  VARIANT_UNAVAILABLE: 'Цього кольору або розміру зараз немає.',
  MISSING_LEAD_TIME: 'Цю позицію шиємо під замовлення — напиши нам, і ми назвемо строк.',
  LEAD_TIME_TOO_LONG: 'Цю позицію шиємо під замовлення — напиши нам, і ми назвемо строк.',
  PRINT_NOT_OFFERED_ON_GARMENT: 'Цей принт не друкується на цьому виробі.',
  COLOUR_NOT_OFFERED_FOR_PRINT: 'Цей принт не друкується на цьому кольорі — обери інший.',
};

/**
 * Де принт дозволений.
 *
 * Обʼєкт із двома обовʼязковими полями, а не два boolean-аргументи: місце
 * виклику, яке забуло про кольори, не скомпілюється, замість того щоб
 * мовчки продати «песів у барі» на оранжевому.
 */
export interface OfferedOn {
  readonly onGarment: boolean;
  readonly onColour: boolean;
}

/**
 * Ціна виробу: ручна ціна варіанта, інакше база плюс надбавки.
 *
 * Правила передаються аргументом, а не читаються звідкись усередині, і це
 * головне, що тут є. Функція лишається чистою, тож калькулятор в адмінці,
 * вітрина й каса рахують однаково за визначенням, а не за домовленістю.
 */
export function garmentPriceFor(
  garment: PricingGarment,
  variant: PricingVariant,
  modifiers: readonly PriceModifierRule[],
): ModifiedPrice {
  return garmentPriceWithModifiers(
    garment.basePriceMinor,
    variant.priceOverrideMinor,
    {
      garmentId: garment.id,
      sizeLabel: variant.sizeLabel,
      fabricId: variant.fabricId,
      colourId: variant.colourId,
    },
    modifiers,
  );
}

export function printPriceFor(print: PricingPrint, table: PrintPriceTable): Minor {
  return table[print.sizeTier];
}

/**
 * Why a variant cannot be bought, or null when it can.
 *
 * `MISSING_LEAD_TIME` should never fire in production — the database has a
 * CHECK constraint for it. It is kept as a guard because a silent failure here
 * means selling something with no promised date, which is worse than an error.
 */
export function blockReasonFor(
  garment: PricingGarment,
  print: PricingPrint,
  variant: PricingVariant,
  offered: OfferedOn,
): BlockReason | null {
  if (!garment.isPublished) return 'GARMENT_UNPUBLISHED';
  if (!print.isPublished) return 'PRINT_UNPUBLISHED';
  if (!offered.onGarment) return 'PRINT_NOT_OFFERED_ON_GARMENT';
  if (!offered.onColour) return 'COLOUR_NOT_OFFERED_FOR_PRINT';

  return variantAvailabilityReason(variant);
}

/** Доступність самого варіанта — спільна для принта й базового одягу. */
function variantAvailabilityReason(variant: PricingVariant): BlockReason | null {
  switch (variant.availability) {
    case 'IN_STOCK':
      return null;
    case 'MADE_TO_ORDER':
      if (variant.leadTimeDays === null) return 'MISSING_LEAD_TIME';
      if (variant.leadTimeDays > MAX_CART_LEAD_TIME_DAYS) return 'LEAD_TIME_TOO_LONG';
      return null;
    case 'UNAVAILABLE':
      return 'VARIANT_UNAVAILABLE';
  }
}

export function priceOffer(
  garment: PricingGarment,
  print: PricingPrint,
  variant: PricingVariant,
  table: PrintPriceTable,
  offered: OfferedOn,
  modifiers: readonly PriceModifierRule[],
): PricedOffer {
  const garmentPrice = garmentPriceFor(garment, variant, modifiers);
  const garmentPriceMinor = garmentPrice.amountMinor;
  const printPriceMinor = printPriceFor(print, table);
  const reason = blockReasonFor(garment, print, variant, offered);

  return {
    variantId: variant.id,
    printId: print.id,
    garmentPriceMinor,
    steps: garmentPrice.steps,
    printPriceMinor,
    totalMinor: addMinor(garmentPriceMinor, printPriceMinor),
    purchasable: reason === null,
    blockedReason: reason === null ? null : BLOCK_MESSAGES[reason],
    leadTimeDays: variant.availability === 'MADE_TO_ORDER' ? variant.leadTimeDays : null,
  };
}

/**
 * Базовий одяг: виріб без принта.
 *
 * Та сама структура PricedOffer, щоб кошику було байдуже, з принтом рядок
 * чи ні: `printId` порожній рядок, ціна друку — нуль. Причини блокування —
 * тільки про виріб і варіант; правила принтів тут не існують.
 */
export function priceBlankOffer(
  garment: PricingGarment,
  variant: PricingVariant,
  modifiers: readonly PriceModifierRule[],
): PricedOffer {
  const garmentPrice = garmentPriceFor(garment, variant, modifiers);
  const garmentPriceMinor = garmentPrice.amountMinor;
  const reason = garment.isPublished ? variantAvailabilityReason(variant) : 'GARMENT_UNPUBLISHED';

  return {
    variantId: variant.id,
    printId: '',
    garmentPriceMinor,
    steps: garmentPrice.steps,
    printPriceMinor: minor(0),
    totalMinor: garmentPriceMinor,
    purchasable: reason === null,
    blockedReason: reason === null ? null : BLOCK_MESSAGES[reason],
    leadTimeDays: variant.availability === 'MADE_TO_ORDER' ? variant.leadTimeDays : null,
  };
}

export interface CartLine {
  readonly offer: PricedOffer;
  readonly quantity: number;
}

export interface CartTotals {
  readonly subtotalMinor: Minor;
  readonly maxLeadTimeDays: number;
}

/**
 * Sum of the lines. Throws on a non-purchasable line rather than silently
 * dropping it: a cart that quietly loses an item is a support ticket.
 */
export function totalCart(lines: readonly CartLine[]): CartTotals {
  let subtotal = minor(0);
  let maxLeadTime = 0;

  for (const line of lines) {
    if (!line.offer.purchasable) {
      throw new Error(`Line ${line.offer.variantId} is not purchasable: ${line.offer.blockedReason}`);
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new RangeError(`Quantity must be a positive integer, got ${line.quantity}`);
    }
    for (let i = 0; i < line.quantity; i += 1) {
      subtotal = addMinor(subtotal, line.offer.totalMinor);
    }
    maxLeadTime = Math.max(maxLeadTime, line.offer.leadTimeDays ?? 0);
  }

  return { subtotalMinor: subtotal, maxLeadTimeDays: maxLeadTime };
}

// ---------------------------------------------------------------------------
// "From zero" quoting — a different stream with a different shape.
// ---------------------------------------------------------------------------

export interface CustomQuoteInput {
  readonly garmentPriceMinor: Minor;
  readonly printPriceMinor: Minor;
  readonly designPriceMinor: Minor;
  readonly customerSuppliedArtwork: boolean;
  readonly suppliedArtworkDiscountMinor: Minor;
}

export interface CustomQuote {
  readonly garmentPriceMinor: Minor;
  readonly printPriceMinor: Minor;
  readonly designPriceMinor: Minor;
  readonly discountMinor: Minor;
  readonly totalMinor: Minor;
}

/**
 * The discount only applies when the customer actually brings artwork, and it
 * can never push the design line below zero. Clamping instead of allowing a
 * negative keeps the invariant "every component of a quote is >= 0", which is
 * what the database also enforces.
 */
export function quoteCustom(input: CustomQuoteInput): CustomQuote {
  const discount = input.customerSuppliedArtwork
    ? minor(Math.min(input.suppliedArtworkDiscountMinor, input.designPriceMinor))
    : minor(0);

  const design = clampToZero(subMinor(input.designPriceMinor, discount));

  return {
    garmentPriceMinor: input.garmentPriceMinor,
    printPriceMinor: input.printPriceMinor,
    designPriceMinor: design,
    discountMinor: discount,
    totalMinor: addMinor(input.garmentPriceMinor, input.printPriceMinor, design),
  };
}

/**
 * What one hour of design work has to be worth for a "from zero" job to pay.
 *
 * Not decoration: at the reported 16 hours per custom order, every 100 UAH/h
 * of intended earnings adds 1600 UAH to the price. Exposed as a function so
 * the number appears in the admin UI instead of in a conversation.
 */
export function designPriceForHours(hours: number, hourlyRateMinor: Minor): Minor {
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new RangeError(`Hours must be a positive number, got ${hours}`);
  }
  return minor(Math.round(hours * hourlyRateMinor));
}
