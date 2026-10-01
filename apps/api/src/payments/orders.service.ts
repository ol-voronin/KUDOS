import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { OrderDraftRequestDto, OrderDraftResponseDto } from '@dt/contracts';
import { ErrorCode, minor } from '@dt/contracts';
import { attributionOf } from '../analytics/analytics.service';
import { PrismaService } from '../common/prisma.service';
import { sendToTelegram } from '../common/telegram';
import { CartPricingService, type PricedCartLine } from './cart-pricing.service';
import { formatOrderPlaced } from './format-order-notification';
import { MonobankService } from './monobank.service';
import { OrdersAdminService } from './orders-admin.service';

type CheckoutLine = Pick<PricedCartLine, 'printId' | 'printSlug' | 'printMethod'>;

/**
 * Чи можна виставити рахунок одразу при оформленні.
 *
 * Лише кошиковий потік (`READY_PRINT`) і лише рядки двох видів: базовий
 * одяг без принта або опублікований готовий принт. Кастомізація й «принт з
 * нуля» — це заявки з обговоренням ціни, рахунок на них лишається ручним.
 * Сьогодні кастом через кошик не проходить узагалі; перевірка тут, щоб так
 * і лишилось, якщо колись проходитиме.
 */
export function canPayAtCheckout(stream: string, lines: readonly CheckoutLine[]): boolean {
  if (stream !== 'READY_PRINT' || lines.length === 0) return false;
  return lines.every((l) => (l.printSlug === null
    ? l.printId === null && l.printMethod === null
    : l.printId !== null));
}

/**
 * Оформлення замовлення й (коли можна) одразу рахунок Monobank.
 *
 * ── Чому рахунок HOLD, а не звичайна оплата ───────────────────────────
 *
 * Власне виробництво гарантує рівно один колір на складі, решта — під
 * замовлення, і взяти гроші за те, чого може не бути, дорожче, ніж
 * зачекати. Тому рахунок, який виставляється одразу при оформленні, — той
 * самий HOLD, що й з адмінки (`OrdersAdminService.createInvoice`): гроші
 * блокуються на картці, а списуються лише після звірки наявності
 * (`finalize`). Не підтвердили — hold знімається, нічого не списано.
 *
 * ── Коли рахунку одразу НЕ буде ───────────────────────────────────────
 *
 * - `MONOBANK_TOKEN` не задано;
 * - Monobank (чи будь-що дорогою) відповів помилкою;
 * - у замовленні щось, крім базового одягу й готових принтів.
 *
 * У всіх трьох випадках замовлення однаково створюється у стані `NEW`, і
 * рахунок виставляє людина з адмінки, як раніше. Помилка оплати ніколи не
 * має ставати втраченим замовленням.
 *
 * ── Порядок дій усередині ─────────────────────────────────────────────
 *
 * Спершу база, потім рахунок, потім Telegram. Якщо робити навпаки, падіння
 * Telegram перетворюється на втрачене замовлення: людина побачила помилку
 * й пішла, а в базі нічого немає. Рахунок — перед Telegram, щоб у
 * повідомленні було видно, чи виставляти його вручну.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartPricingService,
    private readonly ordersAdmin: OrdersAdminService,
    private readonly monobank: MonobankService,
  ) {}

  async createDraft(dto: OrderDraftRequestDto): Promise<OrderDraftResponseDto> {
    // Ціна рахується тут і тільки тут. Клієнт прислав перелік ідентифікаторів
    // і кількість; скільки це коштує, він не знає й знати не мусить.
    const cart = await this.cart.priceForCheckout(dto.items);

    const order = await this.prisma.db.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { phone: dto.customer.phone },
        update: {
          name: dto.customer.name,
          ...(dto.customer.marketingConsent ? { marketingConsent: true, marketingConsentAt: new Date() } : {}),
        },
        create: {
          phone: dto.customer.phone,
          name: dto.customer.name,
          marketingConsent: dto.customer.marketingConsent,
          ...(dto.customer.marketingConsent ? { marketingConsentAt: new Date() } : {}),
        },
        select: { id: true },
      });

      return tx.order.create({
        data: {
          customerId: customer.id,
          stream: 'READY_PRINT',
          status: 'NEW',
          subtotalMinor: cart.subtotalMinor,
          discountMinor: cart.discountMinor,
          // Назви знижок через кому: у замовленні їх може бути кілька, по
          // одній на рядок. Це знімок на момент замовлення — правило потім
          // перейменують або вимкнуть, а питання «чому тут −15 %» ставлять
          // через півроку.
          discountName: cart.discountNames.length === 0 ? null : cart.discountNames.join(', '),
          shippingMinor: cart.shippingMinor,
          totalMinor: cart.totalMinor,
          note: dto.note === '' ? null : dto.note,
          deliveryMethod: dto.delivery.method,
          deliveryCity: dto.delivery.city,
          deliveryBranch: dto.delivery.branch,
          recipientName: dto.delivery.recipientName,
          recipientPhone: dto.delivery.recipientPhone,
          ...attributionOf(dto.attribution),
          items: {
            create: cart.lines.map((line) => ({
              variantId: line.variantId,
              printId: line.printId,
              quantity: line.quantity,
              printMethod: line.printMethod,
              // Знімки цін. Ніколи не приєднуємось до поточних цін, щоб
              // показати старе замовлення: сьогоднішня акція не має
              // переписувати те, за чим людина погодилась учора.
              garmentPriceMinor: line.garmentPriceMinor,
              printPriceMinor: line.printPriceMinor,
              lineTotalMinor: line.lineTotalMinor,
              promisedLeadTimeDays: line.leadTimeDays,
            })),
          },
        },
        select: { id: true, number: true, totalMinor: true, stream: true },
      });
    });

    this.logger.log(`order.placed №${order.number} позицій=${cart.lines.length}`);

    const paymentPageUrl = await this.startPayment(order, cart.lines);

    try {
      await sendToTelegram(formatOrderPlaced({
        orderNumber: order.number,
        customerName: dto.customer.name,
        customerPhone: dto.customer.phone,
        lines: cart.lines.map((l) => ({
          // Для базового одягу printTitle і так дорівнює назві виробу; кажемо
          // «без принта» явно, щоб у цеху ніхто не шукав неіснуючий макет.
          title: l.printSlug === null ? `${l.printTitle} (без принта)` : l.printTitle,
          garmentName: l.garmentName,
          colourName: l.colourName,
          sizeLabel: l.sizeLabel,
          quantity: l.quantity,
        })),
        totalMinor: minor(order.totalMinor),
        delivery: dto.delivery,
        note: dto.note,
        invoiceSent: paymentPageUrl !== undefined,
      }));
    } catch (error) {
      // Замовлення вже в базі й видно в адмінці. Telegram — зручність, а не
      // місце зберігання: його падіння не має ставати помилкою покупцеві.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Замовлення №${order.number} не долетіло в Telegram: ${message}`);
    }

    return {
      orderId: order.id,
      orderNumber: order.number,
      totalMinor: order.totalMinor,
      ...(paymentPageUrl === undefined ? {} : { paymentPageUrl }),
    };
  }

  /**
   * Рахунок одразу при оформленні. Повертає адресу сторінки оплати або
   * `undefined` — тоді замовлення чекає на ручний рахунок. Ніколи не кидає:
   * замовлення вже в базі, і помилка оплати не має його «скасувати» в
   * очах покупця.
   */
  private async startPayment(
    order: { id: string; number: number; stream: string },
    lines: readonly CheckoutLine[],
  ): Promise<string | undefined> {
    if (!this.monobank.isConfigured()) return undefined;
    if (!canPayAtCheckout(order.stream, lines)) return undefined;
    try {
      const { pageUrl } = await this.ordersAdmin.createInvoice(order.id);
      return pageUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Рахунок на замовлення №${order.number} одразу не виставився, лишається на ручний: ${message}`,
      );
      return undefined;
    }
  }

  /** Публічний мінімум для сторінки подяки: ні контактів, ні позицій. */
  async getPublicStatus(orderId: string) {
    const order = await this.prisma.db.order.findUnique({
      where: { id: orderId },
      select: {
        number: true, status: true, totalMinor: true,
        payments: { select: { invoiceId: true, status: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Замовлення не знайдено' });
    }
    // `pending:` — заготовка до відповіді Monobank, рахунком вона ще не є.
    const payment = order.payments.find((p) => !p.invoiceId.startsWith('pending:'));
    return {
      orderNumber: order.number,
      status: order.status,
      totalMinor: order.totalMinor,
      paymentStatus: payment?.status ?? null,
    };
  }
}
