import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Payment } from '@prisma/client';
import { type PaymentAdminDto, ErrorCode } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { MonobankService } from './monobank.service';

const HOLD_FINALIZE_SAFE_WINDOW_DAYS = 8; // 1-day margin before Monobank's own 9-day hold auto-cancel.

function toAdminDto(payment: Payment): PaymentAdminDto {
  return {
    invoiceId: payment.invoiceId,
    status: payment.status,
    paymentType: payment.paymentType,
    amountMinor: payment.amountMinor,
    holdExpiresAt: payment.holdExpiresAt?.toISOString() ?? null,
    finalizedAt: payment.finalizedAt?.toISOString() ?? null,
  };
}

/**
 * Admin-triggered capture/refund on a HOLD payment. Only requests the action
 * against Monobank and records that it was requested — the authoritative
 * status change (HOLD -> SUCCESS/REVERSED) only lands via the webhook, same
 * as every other payment transition (see `PaymentsWebhookService`).
 */
@Injectable()
export class PaymentsAdminService {
  private readonly logger = new Logger(PaymentsAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly monobank: MonobankService,
  ) {}

  private async findPayment(invoiceId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({ where: { invoiceId } });
    if (!payment) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Платіж не знайдено' });
    }
    return payment;
  }

  /** Captures a HOLD invoice — the order shipped, take the money. */
  async finalize(invoiceId: string, amountMinor?: number): Promise<PaymentAdminDto> {
    const payment = await this.findPayment(invoiceId);

    if (payment.paymentType !== 'HOLD') {
      throw new BadRequestException('Це не hold-платіж — кошти вже зняті при створенні рахунку.');
    }
    if (payment.status !== 'HOLD') {
      throw new BadRequestException(`Платіж у статусі ${payment.status} — фіналізувати можна лише HOLD.`);
    }
    const daysSinceCreated = (Date.now() - payment.createdAt.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceCreated >= HOLD_FINALIZE_SAFE_WINDOW_DAYS) {
      throw new BadRequestException(
        'Hold триває вже 8+ днів і скоро автоматично скасується Monobank — фіналізація ненадійна.',
      );
    }
    if (amountMinor !== undefined && amountMinor > payment.amountMinor) {
      throw new BadRequestException('Сума фіналізації не може перевищувати заблоковану суму.');
    }

    await this.monobank.finalizeInvoice(invoiceId, amountMinor);
    const updated = await this.prisma.payment.update({
      where: { invoiceId },
      data: { finalizedAt: new Date() },
    });
    this.logger.log(`payment.finalize_requested invoiceId=${invoiceId}`);
    return toAdminDto(updated);
  }

  /** Refunds an already-captured (SUCCESS) invoice — not valid on a HOLD. */
  async cancel(invoiceId: string, amountMinor?: number): Promise<PaymentAdminDto> {
    const payment = await this.findPayment(invoiceId);

    if (payment.status !== 'SUCCESS') {
      throw new BadRequestException(
        `cancel діє лише на оплачені (SUCCESS) платежі, поточний статус: ${payment.status}.`,
      );
    }
    if (amountMinor !== undefined && amountMinor > payment.amountMinor) {
      throw new BadRequestException('Сума повернення не може перевищувати сплачену суму.');
    }

    await this.monobank.cancelInvoice(invoiceId, amountMinor);
    this.logger.log(`payment.cancel_requested invoiceId=${invoiceId}`);
    return toAdminDto(payment);
  }
}
