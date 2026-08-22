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
    const payment = await this.prisma.payment.findUnique({
      where: { invoiceId: body.invoiceId },
      select: { id: true, orderId: true, status: true },
    });
    if (!payment) {
      // Nothing to reconcile against — log it, ack anyway so Monobank stops retrying.
      this.logger.warn(`webhook.unknown_invoice invoiceId=${body.invoiceId}`);
      return;
    }

    const nextStatus = STATUS_MAP[body.status];
    if (!nextStatus) {
      throw new BadRequestException(`Unknown Monobank status: ${String(body.status)}`);
    }
    const wasAlreadySuccess = payment.status === 'SUCCESS';

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        ...(body.failureReason ? { failureReason: body.failureReason } : {}),
        rawWebhook: body as unknown as Prisma.InputJsonValue,
      },
    });

    const orderStatus = ORDER_STATUS_FOR[nextStatus];
    if (orderStatus) {
      await this.prisma.order.update({ where: { id: payment.orderId }, data: { status: orderStatus } });
    }

    this.logger.log(
      `webhook.processed invoiceId=${body.invoiceId} paymentStatus=${nextStatus}` +
      (orderStatus ? ` orderStatus=${orderStatus}` : ''),
    );

    // Idempotency: only the first transition into SUCCESS notifies. Monobank
    // does not guarantee webhook delivery order, so this can arrive more than
    // once — a second "success" webhook must not send a second message.
    if (nextStatus === 'SUCCESS' && !wasAlreadySuccess) {
      await this.notifyPaid(payment.orderId);
    }
  }

  private async notifyPaid(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        number: true,
        totalMinor: true,
        note: true,
        customer: { select: { name: true, phone: true } },
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
