import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { OrderStatus, PaymentStatus } from '@dt/contracts';
import { minor } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { sendToTelegram } from '../common/telegram';
import { formatOrderPaid } from './format-order-notification';

/** The subset of Monobank's "Статус рахунку" shape this service reads. */
export interface MonobankWebhookBody {
  readonly invoiceId: string;
  readonly status: 'created' | 'processing' | 'hold' | 'success' | 'failure' | 'reversed' | 'expired';
  readonly failureReason?: string;
  /** Наш orderId — його ми клали в `reference` при створенні рахунку. */
  readonly reference?: string;
  /** Сума в копійках, як її бачить Monobank. Звіряємо з тим, що виставляли. */
  readonly amount?: number;
}

const STATUS_MAP: Record<MonobankWebhookBody['status'], PaymentStatus> = {
  created: 'CREATED',
  processing: 'PROCESSING',
  hold: 'HOLD',
  success: 'SUCCESS',
  failure: 'FAILURE',
  reversed: 'REVERSED',
  expired: 'EXPIRED',
};

/**
 * Порядок станів платежу. Monobank не гарантує порядок доставки вебхуків, тож
 * без рангу пізній `processing`, що доїхав після `success`, відкотив би платіж
 * назад — а наступний `success` надіслав би повідомлення вдруге.
 *
 * `reversed` вище за `success` навмисно: повернення коштів законно приходить
 * саме після успішної оплати.
 */
const RANK: Record<PaymentStatus, number> = {
  CREATED: 0,
  PROCESSING: 1,
  HOLD: 2,
  SUCCESS: 3,
  FAILURE: 3,
  EXPIRED: 3,
  REVERSED: 4,
};

/** Стани, з яких перехід у `next` є рухом уперед. */
export function statusesBelow(next: PaymentStatus): PaymentStatus[] {
  return (Object.keys(RANK) as PaymentStatus[]).filter((s) => RANK[s] < RANK[next]);
}

/** Only these payment outcomes move the order itself. Everything else (created/processing/hold) is in-flight. */
const ORDER_STATUS_FOR: Partial<Record<PaymentStatus, OrderStatus>> = {
  SUCCESS: 'PAID',
  FAILURE: 'CANCELLED',
  REVERSED: 'CANCELLED',
  EXPIRED: 'CANCELLED',
};

/**
 * The business logic behind the Monobank webhook. Kept separate from the
 * controller so signature verification (which must happen before this ever
 * runs) is not entangled with order/payment state transitions.
 */
@Injectable()
export class PaymentsWebhookService {
  private readonly logger = new Logger(PaymentsWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(body: MonobankWebhookBody): Promise<void> {
    const payment = await this.findPayment(body);
    if (!payment) {
      // Немає з чим звіряти — логуємо й підтверджуємо, щоб Monobank не ретраїв вічно.
      this.logger.warn(`webhook.unknown_invoice invoiceId=${body.invoiceId}`);
      return;
    }

    const nextStatus = STATUS_MAP[body.status];
    if (!nextStatus) {
      throw new BadRequestException(`Unknown Monobank status: ${String(body.status)}`);
    }

    // Сума не змінює рішення (рахунок виставляв сервер), але розбіжність —
    // це сигнал, який має бути видно, а не зникати мовчки.
    if (typeof body.amount === 'number' && body.amount !== payment.amountMinor) {
      this.logger.error(
        `webhook.amount_mismatch invoiceId=${body.invoiceId} ` +
        `expected=${payment.amountMinor} got=${body.amount}`,
      );
    }

    // Один атомарний перехід замість «прочитати → вирішити → записати».
    // Умова на статус робить і ідемпотентність, і заборону руху назад: два
    // одночасні `success` не пройдуть обидва, а спізнілий `processing` не
    // відкотить уже успішний платіж.
    const { count } = await this.prisma.db.payment.updateMany({
      where: { id: payment.id, status: { in: statusesBelow(nextStatus) } },
      data: {
        status: nextStatus,
        ...(body.failureReason ? { failureReason: body.failureReason } : {}),
        rawWebhook: body as unknown as Prisma.InputJsonValue,
      },
    });

    if (count === 0) {
      this.logger.log(
        `webhook.ignored invoiceId=${body.invoiceId} from=${payment.status} to=${nextStatus} ` +
        '(дубль або доставка не в порядку)',
      );
      return;
    }

    const orderStatus = ORDER_STATUS_FOR[nextStatus];
    if (orderStatus) {
      await this.prisma.db.order.update({ where: { id: payment.orderId }, data: { status: orderStatus } });
    }

    this.logger.log(
      `webhook.processed invoiceId=${body.invoiceId} paymentStatus=${nextStatus}` +
      (orderStatus ? ` orderStatus=${orderStatus}` : ''),
    );

    // Сюди можна дійти рівно один раз на платіж: перехід у SUCCESS відбувся
    // саме в цьому запиті, бо `count === 1`.
    if (nextStatus === 'SUCCESS') {
      await this.notifyPaid(payment.orderId);
    }
  }

  /**
   * Пошук платежу за invoiceId, із запасним шляхом через `reference`.
   *
   * Запасний шлях закриває вузьке вікно: рахунок у Monobank уже створено, а
   * записати його `invoiceId` у наш рядок Payment не встигли (падіння, розрив
   * звʼязку). Без нього клієнт платить, вебхук не знаходить платіж, і
   * замовлення назавжди лишається в PENDING_PAYMENT при списаних грошах.
   */
  private async findPayment(body: MonobankWebhookBody) {
    const byInvoice = await this.prisma.db.payment.findUnique({
      where: { invoiceId: body.invoiceId },
      select: { id: true, orderId: true, status: true, amountMinor: true },
    });
    if (byInvoice) return byInvoice;
    if (!body.reference) return null;

    const byReference = await this.prisma.db.payment.findFirst({
      where: { orderId: body.reference },
      orderBy: { createdAt: 'desc' },
      select: { id: true, orderId: true, status: true, amountMinor: true },
    });
    if (!byReference) return null;

    // Знайшли — доклеюємо invoiceId, щоб наступні вебхуки йшли прямим шляхом.
    await this.prisma.db.payment
      .update({ where: { id: byReference.id }, data: { invoiceId: body.invoiceId } })
      .catch(() => undefined);
    this.logger.warn(
      `webhook.recovered_by_reference invoiceId=${body.invoiceId} orderId=${body.reference}`,
    );
    return byReference;
  }

  private async notifyPaid(orderId: string): Promise<void> {
    const order = await this.prisma.db.order.findUnique({
      where: { id: orderId },
      select: {
        number: true,
        totalMinor: true,
        note: true,
        customer: { select: { name: true, phone: true } },
        _count: { select: { items: true } },
        items: {
          take: 1,
          select: {
            quantity: true,
            print: { select: { title: true } },
            variant: {
              select: {
                garment: { select: { name: true } },
                colour: { select: { name: true, supplierCode: true } },
                size: { select: { label: true } },
              },
            },
          },
        },
      },
    });
    const item = order?.items[0];
    if (!order || !item) return;

    // Повідомлення показує першу позицію. Сьогодні кошика немає й позиція
    // завжди одна — але коли зʼявиться друга, мовчазна неповна нотифікація
    // гірша за гучну. Хай краще буде видно в логах.
    if (order._count.items > 1) {
      this.logger.warn(
        `order.notification_truncated orderNumber=${order.number} items=${order._count.items} ` +
        '(у Telegram піде лише перша позиція)',
      );
    }

    try {
      await sendToTelegram(formatOrderPaid({
        orderNumber: order.number,
        customerName: order.customer.name,
        customerPhone: order.customer.phone,
        printTitle: item.print.title,
        garmentName: item.variant.garment.name,
        colourName: item.variant.colour.name ?? item.variant.colour.supplierCode,
        sizeLabel: item.variant.size.label,
        quantity: item.quantity,
        totalMinor: minor(order.totalMinor),
        ...(order.note ? { note: order.note } : {}),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Замовлення №${order.number} не долетіло в Telegram: ${message}`);
    }
  }
}
