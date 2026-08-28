import { BadRequestException, Injectable } from '@nestjs/common';
import type { CartItemDto, CartQuoteDto, PrintMethod } from '@dt/contracts';
import { ErrorCode, minor, mulMinor } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { PriceBookService } from '../pricing/price-book.service';
import { bestDiscount } from '../pricing/price-rules';
import {
  priceOffer,
  type PricingGarment, type PricingPrint, type PricingVariant, type PrintPriceTable,
} from '../pricing/pricing.domain';

/**
 * Один-єдиний підрахунок кошика на весь застосунок.
 *
 * ── Навіщо окремий сервіс ─────────────────────────────────────────────
 *
 * Кошик рахують три різні місця: сторінка кошика (щоб показати суму),
 * оформлення (щоб створити замовлення) і адмінка (щоб виставити рахунок на
 * ту саму суму). Поки це була одна позиція, розрахунок жив прямо в
 * `CheckoutService`. Розмноживши його на три, ми гарантовано отримали б
 * три трохи різні відповіді — і питання «чому в кошику 2380, а в рахунку
 * 2350» без жодного способу відповісти.
 *
 * ── Знижка рахується ПОРЯДКОВО ────────────────────────────────────────
 *
 * Правило «−15 % на худі» стосується худі, а не всього кошика: якщо в
 * кошику худі й футболка, знижка має впасти на худі. Тому `bestDiscount`
 * викликається на кожен рядок окремо, а в замовлення пишеться сума знижок
 * і перелік їхніх назв.
 *
 * Альтернатива — одна знижка на весь кошик — виглядає простішою рівно доти,
 * доки в кошику один товар. На двох вона починає або дарувати зайве, або
 * недодавати обіцяне, і покупець помічає це раніше за нас.
 *
 * ── Ціну завжди рахує сервер ──────────────────────────────────────────
 *
 * Клієнт присилає `variantId`, `printSlug` і кількість. Більше нічого.
 * Акція, що скінчилася вчора, не діє, навіть якщо сторінку відкрили
 * позавчора й не перезавантажували: `now` береться тут, на сервері.
 */

export interface PricedCartLine {
  readonly printId: string;
  readonly printSlug: string;
  readonly printTitle: string;
  readonly previewUrl: string;
  readonly variantId: string;
  readonly garmentId: string;
  readonly garmentName: string;
  readonly colourName: string;
  readonly sizeLabel: string;
  readonly quantity: number;
  readonly printMethod: PrintMethod;
  readonly garmentPriceMinor: number;
  readonly printPriceMinor: number;
  readonly unitMinor: number;
  readonly lineSubtotalMinor: number;
  readonly discountName: string | null;
  readonly discountMinor: number;
  readonly lineTotalMinor: number;
  readonly leadTimeDays: number | null;
  readonly blockedReason: string | null;
}

export interface PricedCart {
  readonly lines: readonly PricedCartLine[];
  readonly subtotalMinor: number;
  readonly discountMinor: number;
  readonly discountNames: readonly string[];
  readonly shippingMinor: number;
  readonly freeShippingFromMinor: number;
  readonly totalMinor: number;
  readonly maxLeadTimeDays: number;
  readonly purchasable: boolean;
}

/**
 * Однакові позиції складаються в одну.
 *
 * Інакше «додав у кошик» двічі дає два рядки по одному, і знижка «від трьох
 * штук» не спрацьовує на трьох однакових футболках, доданих поштучно. Для
 * покупця це один товар у кількості три, і рахувати його треба так само.
 *
 * Окрема чиста функція — щоб це правило можна було перевірити тестом, не
 * піднімаючи базу.
 */
export function mergeCartItems(items: readonly CartItemDto[]): CartItemDto[] {
  const merged = new Map<string, CartItemDto>();
  for (const item of items) {
    const key = `${item.printSlug}|${item.variantId}|${item.printMethod}`;
    const seen = merged.get(key);
    merged.set(key, seen === undefined
      ? item
      : { ...seen, quantity: Math.min(MAX_QUANTITY, seen.quantity + item.quantity) });
  }
  return [...merged.values()];
}

/** Стеля кількості в одному рядку. Більше — це вже опт, і ціна там інша. */
const MAX_QUANTITY = 5;

@Injectable()
export class CartPricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceBook: PriceBookService,
  ) {}

  async price(items: readonly CartItemDto[]): Promise<PricedCart> {
    if (items.length === 0) {
      return {
        lines: [], subtotalMinor: 0, discountMinor: 0, discountNames: [],
        shippingMinor: 0, freeShippingFromMinor: await this.freeShippingFrom(),
        totalMinor: 0, maxLeadTimeDays: 0, purchasable: false,
      };
    }

    /*
     * Однакові позиції складаються в одну.
     *
     * Інакше «додав у кошик» двічі дає два рядки по одному, і знижка «від
     * трьох штук» не спрацьовує на трьох однакових футболках, доданих
     * поштучно. Для покупця це один товар у кількості три, і рахувати його
     * треба так само.
     */
    const cart = mergeCartItems(items);

    const [prints, variants, priceRows, modifiers, discounts, rules, exclusions, freeFrom] = await Promise.all([
      this.prisma.db.print.findMany({
        where: { slug: { in: cart.map((i) => i.printSlug) }, isPublished: true },
        select: {
          id: true, slug: true, title: true, sizeTier: true, previewUrl: true, isPublished: true,
          collections: { select: { collectionId: true } },
        },
      }),
      this.prisma.db.variant.findMany({
        where: { id: { in: cart.map((i) => i.variantId) } },
        select: {
          id: true, garmentId: true, fabricId: true, colourId: true,
          availability: true, leadTimeDays: true, priceOverrideMinor: true,
          garment: { select: { id: true, name: true, basePriceMinor: true, isPublished: true } },
          // Кольори власного виробництва часто не мають назви — тільки номер
          // на фізичній палітрі. Тому `supplierCode` тут не про запас: без
          // нього половина варіантів у кошику лишилася б без підпису.
          colour: { select: { name: true, supplierCode: true } },
          size: { select: { label: true } },
        },
      }),
      this.prisma.db.printPrice.findMany({ select: { tier: true, priceMinor: true } }),
      this.priceBook.modifiers(),
      this.priceBook.discounts(),
      this.prisma.db.printGarmentRule.findMany({ select: { collectionId: true, garmentId: true } }),
      this.prisma.db.printGarmentExclusion.findMany({ select: { printId: true, garmentId: true } }),
      this.freeShippingFrom(),
    ]);

    const priceTable = Object.fromEntries(
      priceRows.map((r: { tier: string; priceMinor: number }) => [r.tier, r.priceMinor]),
    ) as PrintPriceTable;

    const printBySlug = new Map(prints.map((p) => [p.slug, p]));
    const variantById = new Map(variants.map((v) => [v.id, v]));
    const excluded = new Set(
      (exclusions as Array<{ printId: string; garmentId: string }>).map((e) => `${e.printId}|${e.garmentId}`),
    );
    const now = new Date();

    const lines: PricedCartLine[] = [];
    let subtotalMinor = 0;
    let discountMinor = 0;
    let maxLeadTimeDays = 0;
    const discountNames = new Set<string>();

    for (const item of cart) {
      const print = printBySlug.get(item.printSlug);
      const variant = variantById.get(item.variantId);

      /*
       * Зниклий принт чи варіант — не помилка запиту, а звичайне життя
       * кошика: товар зняли з продажу, поки він там лежав. Кидати 404 на
       * весь кошик означало б показати людині порожній екран замість
       * пʼяти справних позицій і однієї зниклої.
       */
      if (print === undefined || variant === undefined) {
        lines.push(missingLine(item));
        continue;
      }

      const collectionIds = print.collections.map((c: { collectionId: string }) => c.collectionId);
      // Те саме правило, що й у каталозі: друкуємо на всьому, доки колекція
      // явно не звузила вибір; точкова заборона прибирає окремий виріб.
      const restricting = (rules as Array<{ collectionId: string; garmentId: string }>)
        .filter((r) => collectionIds.includes(r.collectionId));
      const offerable = !excluded.has(`${print.id}|${variant.garmentId}`)
        && (restricting.length === 0 || restricting.some((r) => r.garmentId === variant.garmentId));

      const pricingGarment: PricingGarment = {
        id: variant.garment.id,
        basePriceMinor: minor(variant.garment.basePriceMinor),
        isPublished: variant.garment.isPublished,
      };
      const pricingPrint: PricingPrint = {
        id: print.id, sizeTier: print.sizeTier, isPublished: print.isPublished,
      };
      const pricingVariant: PricingVariant = {
        id: variant.id,
        availability: variant.availability,
        leadTimeDays: variant.leadTimeDays,
        priceOverrideMinor: variant.priceOverrideMinor === null ? null : minor(variant.priceOverrideMinor),
        sizeLabel: variant.size.label,
        fabricId: variant.fabricId,
        colourId: variant.colourId,
      };

      const offer = priceOffer(pricingGarment, pricingPrint, pricingVariant, priceTable, offerable, modifiers);
      const lineSubtotal = mulMinor(offer.totalMinor, item.quantity);

      const discount = offer.purchasable
        ? bestDiscount(
          discounts,
          { garmentId: variant.garmentId, collectionIds, quantity: item.quantity, now },
          lineSubtotal,
        )
        : null;
      if (discount !== null) discountNames.add(discount.name);

      const line: PricedCartLine = {
        printId: print.id,
        printSlug: print.slug,
        printTitle: print.title,
        previewUrl: print.previewUrl,
        variantId: variant.id,
        garmentId: variant.garmentId,
        garmentName: variant.garment.name,
        colourName: variant.colour.name ?? variant.colour.supplierCode,
        sizeLabel: variant.size.label,
        quantity: item.quantity,
        printMethod: item.printMethod,
        garmentPriceMinor: offer.garmentPriceMinor,
        printPriceMinor: offer.printPriceMinor,
        unitMinor: offer.totalMinor,
        lineSubtotalMinor: lineSubtotal,
        discountName: discount?.name ?? null,
        discountMinor: discount?.amountMinor ?? 0,
        lineTotalMinor: lineSubtotal - (discount?.amountMinor ?? 0),
        leadTimeDays: offer.leadTimeDays,
        blockedReason: offer.purchasable ? null : (offer.blockedReason ?? 'Цю позицію не можна купити зараз'),
      };
      lines.push(line);

      if (line.blockedReason === null) {
        subtotalMinor += line.lineSubtotalMinor;
        discountMinor += line.discountMinor;
        maxLeadTimeDays = Math.max(maxLeadTimeDays, line.leadTimeDays ?? 0);
      }
    }

    const purchasable = lines.length > 0 && lines.every((l) => l.blockedReason === null);

    /*
     * Доставка поки завжди нуль, і це не забутий код.
     *
     * Тариф Нової Пошти залежить від ваги, обʼєму й напрямку, і дізнатися
     * його можна лише з їхнього API після створення накладної. Поставити
     * тут вигадану цифру означало б показати покупцеві суму, яка не
     * збігається з тим, що він заплатить на відділенні. Тому сторінка
     * каже правду: «за тарифами перевізника», а вище порогу — «за наш
     * рахунок». `freeShippingFromMinor` віддаємо, щоб їй було з чим
     * порівнювати.
     */
    const shippingMinor = 0;

    return {
      lines,
      subtotalMinor,
      discountMinor,
      discountNames: [...discountNames],
      shippingMinor,
      freeShippingFromMinor: freeFrom,
      totalMinor: subtotalMinor - discountMinor + shippingMinor,
      maxLeadTimeDays,
      purchasable,
    };
  }

  /** Те саме, але падає, якщо кошик неможливо оформити. Для каси. */
  async priceForCheckout(items: readonly CartItemDto[]): Promise<PricedCart> {
    const cart = await this.price(items);
    if (!cart.purchasable) {
      const blocked = cart.lines.find((l) => l.blockedReason !== null);
      throw new BadRequestException({
        code: ErrorCode.VARIANT_NOT_PURCHASABLE,
        message: blocked?.blockedReason ?? 'Кошик порожній',
      });
    }
    return cart;
  }

  private async freeShippingFrom(): Promise<number> {
    const row = await this.prisma.db.siteSettings.findFirst({ select: { freeShippingFromMinor: true } });
    return row?.freeShippingFromMinor ?? 0;
  }
}

/** Рядок, товару з якого більше немає. Показуємо з причиною, не ховаємо. */
function missingLine(item: CartItemDto): PricedCartLine {
  return {
    printId: '', printSlug: item.printSlug, printTitle: 'Товар більше недоступний',
    previewUrl: '', variantId: item.variantId, garmentId: '',
    garmentName: '', colourName: '', sizeLabel: '',
    quantity: item.quantity, printMethod: item.printMethod,
    garmentPriceMinor: 0, printPriceMinor: 0, unitMinor: 0, lineSubtotalMinor: 0,
    discountName: null, discountMinor: 0, lineTotalMinor: 0, leadTimeDays: null,
    blockedReason: 'Цю позицію зняли з продажу — прибери її з кошика',
  };
}

/** Формат, у якому кошик їде на сторінку. */
export function toCartQuote(cart: PricedCart): CartQuoteDto {
  return {
    lines: cart.lines.map((l) => ({
      printSlug: l.printSlug,
      variantId: l.variantId,
      quantity: l.quantity,
      title: l.printTitle,
      garmentName: l.garmentName,
      colourName: l.colourName,
      sizeLabel: l.sizeLabel,
      previewUrl: l.previewUrl,
      unitMinor: l.unitMinor,
      lineTotalMinor: l.lineTotalMinor,
      discountName: l.discountName,
      discountMinor: l.discountMinor,
      blockedReason: l.blockedReason,
      leadTimeDays: l.leadTimeDays,
    })),
    subtotalMinor: cart.subtotalMinor,
    discountMinor: cart.discountMinor,
    shippingMinor: cart.shippingMinor,
    freeShippingFromMinor: cart.freeShippingFromMinor,
    totalMinor: cart.totalMinor,
    maxLeadTimeDays: cart.maxLeadTimeDays,
    purchasable: cart.purchasable,
  };
}
