import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { ReadyPrintCheckoutRequestDto } from '@dt/contracts';
import { ErrorCode, minor, mulMinor } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import {
  priceOffer, totalCart,
  type PricingGarment, type PricingPrint, type PricingVariant, type PrintPriceTable,
} from '../pricing/pricing.domain';
import { MonobankService } from './monobank.service';

function publicUrl(name: 'WEB_PUBLIC_URL' | 'API_PUBLIC_URL'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} не задано — оплата готовими принтами вимагає публічної адреси для redirectUrl/webHookUrl.`,
    );
  }
  return value.replace(/\/$/, '');
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Monobank auto-cancels an un-finalized HOLD after this many days. */
const HOLD_MAX_DAYS = 9;

/**
 * The READY_PRINT checkout: order + Monobank invoice, no cart.
 *
 * Price is always recomputed here from `variantId`/`printId` through the same
 * pricing domain the catalogue uses — the client only ever sends *what* it
 * wants to buy, never *how much* it costs. CUSTOMISATION and FROM_ZERO never
 * reach this service; they stay on the lead/custom-request path.
 */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly monobank: MonobankService,
  ) {}

  async createReadyPrintCheckout(dto: ReadyPrintCheckoutRequestDto) {
    const print = await this.prisma.print.findFirst({
      where: { slug: dto.printSlug, isPublished: true },
      select: {
        id: true, title: true, sizeTier: true, isPublished: true,
        collections: { select: { collectionId: true } },
      },
    });
    if (!print) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Принт не знайдено' });
    }

    const variant = await this.prisma.variant.findUnique({
      where: { id: dto.variantId },
      select: {
        id: true, garmentId: true, availability: true, leadTimeDays: true, priceOverrideMinor: true,
        garment: { select: { id: true, name: true, basePriceMinor: true, isPublished: true } },
        colour: { select: { name: true } },
        size: { select: { label: true } },
      },
    });
    if (!variant) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Варіант не знайдено' });
    }

    // Same structural check as the catalogue read: a print is only offerable
    // on a garment through an explicit PrintGarmentRule.
    const collectionIds = print.collections.map((c: { collectionId: string }) => c.collectionId);
    const rule = collectionIds.length === 0 ? null : await this.prisma.printGarmentRule.findFirst({
      where: { garmentId: variant.garmentId, collectionId: { in: collectionIds } },
      select: { id: true },
    });

    const priceRows = await this.prisma.printPrice.findMany({ select: { tier: true, priceMinor: true } });
    const priceTable = Object.fromEntries(
      priceRows.map((r: { tier: string; priceMinor: number }) => [r.tier, r.priceMinor]),
    ) as PrintPriceTable;

    const pricingGarment: PricingGarment = {
      id: variant.garment.id,
      basePriceMinor: minor(variant.garment.basePriceMinor),
      isPublished: variant.garment.isPublished,
    };
    const pricingPrint: PricingPrint = { id: print.id, sizeTier: print.sizeTier, isPublished: print.isPublished };
    const pricingVariant: PricingVariant = {
      id: variant.id,
      availability: variant.availability,
      leadTimeDays: variant.leadTimeDays,
      priceOverrideMinor: variant.priceOverrideMinor === null ? null : minor(variant.priceOverrideMinor),
    };

    const offer = priceOffer(pricingGarment, pricingPrint, pricingVariant, priceTable, rule !== null);
    if (!offer.purchasable) {
      throw new BadRequestException({
        code: ErrorCode.VARIANT_NOT_PURCHASABLE,
        message: offer.blockedReason ?? 'Цю позицію не можна купити зараз',
      });
    }

    const totals = totalCart([{ offer, quantity: dto.quantity }]);

    const order = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
          status: 'PENDING_PAYMENT',
          subtotalMinor: totals.subtotalMinor,
          totalMinor: totals.subtotalMinor,
          ...(dto.note ? { note: dto.note } : {}),
          items: {
            create: {
              variantId: variant.id,
              printId: print.id,
              quantity: dto.quantity,
              printMethod: dto.printMethod,
              garmentPriceMinor: offer.garmentPriceMinor,
              printPriceMinor: offer.printPriceMinor,
              lineTotalMinor: mulMinor(offer.totalMinor, dto.quantity),
              promisedLeadTimeDays: offer.leadTimeDays,
            },
          },
        },
        select: { id: true, number: true, totalMinor: true },
      });
    });

    const webBase = publicUrl('WEB_PUBLIC_URL');
    const apiBase = publicUrl('API_PUBLIC_URL');

    let invoice: { invoiceId: string; pageUrl: string };
    try {
      invoice = await this.monobank.createInvoice({
        amountMinor: order.totalMinor,
        reference: order.id,
        destination: `Замовлення №${order.number} — ${print.title}`,
        redirectUrl: `${webBase}/order/${order.id}`,
        webHookUrl: `${apiBase}/api/v1/payments/monobank/webhook`,
        paymentType: dto.paymentType === 'HOLD' ? 'hold' : 'debit',
      });
    } catch (error) {
      // No invoice means no way to pay — do not leave an order sitting in
      // PENDING_PAYMENT that the customer can never actually pay for.
      await this.prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } }).catch(() => {});
      throw error;
    }

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        invoiceId: invoice.invoiceId,
        status: 'CREATED',
        paymentType: dto.paymentType,
        amountMinor: order.totalMinor,
        ...(dto.paymentType === 'HOLD'
          ? { holdExpiresAt: new Date(Date.now() + HOLD_MAX_DAYS * MS_PER_DAY) }
          : {}),
      },
    });

    this.logger.log(`checkout.created order=${order.number} invoice=${invoice.invoiceId}`);

    return { orderId: order.id, orderNumber: order.number, pageUrl: invoice.pageUrl };
  }

  /** Public, minimal status for the post-payment "thank you" page. */
  async getPublicOrderStatus(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { number: true, status: true, totalMinor: true },
    });
    if (!order) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Замовлення не знайдено' });
    }
    return { orderNumber: order.number, status: order.status, totalMinor: order.totalMinor };
  }
}
