import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { OrderDraftRequestDto, OrderDraftResponseDto } from '@dt/contracts';
import { ErrorCode, minor } from '@dt/contracts';
import { attributionOf } from '../analytics/analytics.service';
import { PrismaService } from '../common/prisma.service';
import { sendToTelegram } from '../common/telegram';
import { CartPricingService } from './cart-pricing.service';
import { formatOrderPlaced } from './format-order-notification';

/**
 * Оформлення замовлення БЕЗ оплати.
 *
 * ── Чому оплата не тут ────────────────────────────────────────────────
 *
 * Раніше «Оплатити» створювало замовлення й рахунок Monobank одним рухом:
 * людина одразу їхала на сторінку оплати. Це чесно працює для магазину, у
 * якого все є на складі. У нас власне виробництво гарантує рівно один колір,
 * решта — під замовлення, і взяти гроші за те, чого може не бути, дорожче,
 * ніж зачекати годину до підтвердження.
 *
 * Тому замовлення народжується у стані `NEW`. Далі його бачить людина в
 * адмінці, звіряє наявність, пише покупцеві — і аж тоді виставляє рахунок
 * (`OrdersAdminService.createInvoice`).
 *
 * ── Порядок дій усередині ─────────────────────────────────────────────
 *
 * Спершу база, потім Telegram — той самий порядок, що й у заявок. Якщо
 * робити навпаки, падіння Telegram перетворюється на втрачене замовлення:
 * людина побачила помилку й пішла, а в базі нічого немає.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartPricingService,
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
        select: { id: true, number: true, totalMinor: true },
      });
    });

    this.logger.log(`order.placed №${order.number} позицій=${cart.lines.length}`);

    try {
      await sendToTelegram(formatOrderPlaced({
        orderNumber: order.number,
        customerName: dto.customer.name,
        customerPhone: dto.customer.phone,
        lines: cart.lines.map((l) => ({
          title: l.printTitle,
          garmentName: l.garmentName,
          colourName: l.colourName,
          sizeLabel: l.sizeLabel,
          quantity: l.quantity,
        })),
        totalMinor: minor(order.totalMinor),
        delivery: dto.delivery,
        note: dto.note,
      }));
    } catch (error) {
      // Замовлення вже в базі й видно в адмінці. Telegram — зручність, а не
      // місце зберігання: його падіння не має ставати помилкою покупцеві.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Замовлення №${order.number} не долетіло в Telegram: ${message}`);
    }

    return { orderId: order.id, orderNumber: order.number, totalMinor: order.totalMinor };
  }

  /** Публічний мінімум для сторінки подяки: ні контактів, ні позицій. */
  async getPublicStatus(orderId: string) {
    const order = await this.prisma.db.order.findUnique({
      where: { id: orderId },
      select: { number: true, status: true, totalMinor: true },
    });
    if (!order) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Замовлення не знайдено' });
    }
    return { orderNumber: order.number, status: order.status, totalMinor: order.totalMinor };
  }
}
