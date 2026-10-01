import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  AdminOrderDto, AdminOrderInvoiceResponseDto, AdminOrderListDto, OrderStatus,
} from '@dt/contracts';
import { ErrorCode } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { MonobankService } from './monobank.service';

function publicUrl(name: 'WEB_PUBLIC_URL' | 'API_PUBLIC_URL'): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} не задано — без нього неможливо виставити рахунок.`);
  return value.replace(/\/$/, '');
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Monobank сам скасовує незавершений HOLD через стільки днів. */
const HOLD_MAX_DAYS = 9;

const ORDER_SELECT = {
  id: true, number: true, status: true, note: true,
  subtotalMinor: true, discountMinor: true, discountName: true,
  shippingMinor: true, totalMinor: true,
  deliveryMethod: true, deliveryCity: true, deliveryBranch: true,
  recipientName: true, recipientPhone: true,
  utmSource: true, utmCampaign: true, placedAt: true,
  customer: { select: { name: true, phone: true } },
  items: {
    select: {
      quantity: true, lineTotalMinor: true, promisedLeadTimeDays: true,
      print: { select: { title: true, slug: true } },
      variant: {
        select: {
          size: { select: { label: true } },
          garment: { select: { name: true } },
          colour: { select: { name: true, supplierCode: true } },
        },
      },
    },
  },
  payments: {
    select: { invoiceId: true, status: true },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
} as const satisfies Prisma.OrderSelect;

/**
 * Замовлення в адмінці.
 *
 * ── Чому цей екран зʼявився разом із кошиком ──────────────────────────
 *
 * Доки «Оплатити» вело просто на Monobank, замовлення могло жити без
 * інтерфейсу: гроші приходили, сповіщення прилітало в Telegram, решта була
 * листуванням. Щойно між замовленням і оплатою став людський крок, це
 * перестало працювати: замовлення в стані `NEW` не має ні рахунку, ні
 * нагадування про себе. Без екрана воно просто губиться.
 *
 * ── Рахунок виставляється ПО ЗНІМКУ, а не за поточними цінами ─────────
 *
 * Сума береться з `order.totalMinor` — того, що людина бачила й на що
 * погодилась. Перерахувати кошик заново в цей момент означало б, що
 * учорашня акція, яка вже скінчилась, тихо підвищить рахунок; покупець
 * отримає посилання на суму, якої не бачив.
 */
@Injectable()
export class OrdersAdminService {
  private readonly logger = new Logger(OrdersAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly monobank: MonobankService,
  ) {}

  async list(query: { status?: OrderStatus; page: number; perPage: number }): Promise<AdminOrderListDto> {
    const where = query.status === undefined ? {} : { status: query.status };

    const [rows, total] = await this.prisma.db.$transaction([
      this.prisma.db.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
        select: {
          id: true, number: true, status: true, totalMinor: true, placedAt: true,
          customer: { select: { name: true, phone: true } },
          _count: { select: { items: true } },
          payments: { select: { invoiceId: true }, take: 1 },
        },
      }),
      this.prisma.db.order.count({ where }),
    ]);

    return {
      items: rows.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        customerName: o.customer.name,
        customerPhone: o.customer.phone,
        itemCount: o._count.items,
        totalMinor: o.totalMinor,
        // «pending:» — тимчасовий номер, який ставиться до відповіді
        // Monobank. Рахунком він ще не є, і кнопка має лишатися активною.
        hasInvoice: o.payments.some((p) => !p.invoiceId.startsWith('pending:')),
        placedAt: o.placedAt,
      })),
      total,
      page: query.page,
      perPage: query.perPage,
    };
  }

  async get(id: string): Promise<AdminOrderDto> {
    const order = await this.prisma.db.order.findUnique({ where: { id }, select: ORDER_SELECT });
    if (!order) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Замовлення не знайдено' });
    }
    return toAdminOrder(order);
  }

  async updateStatus(id: string, status: OrderStatus): Promise<AdminOrderDto> {
    const existing = await this.prisma.db.order.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Замовлення не знайдено' });
    }
    const updated = await this.prisma.db.order.update({
      where: { id },
      data: { status },
      select: ORDER_SELECT,
    });
    this.logger.log(`order.status №${updated.number} → ${status}`);
    return toAdminOrder(updated);
  }

  /**
   * Виставити рахунок на вже наявне замовлення.
   *
   * `HOLD`, а не `DEBIT`: гроші блокуються, а списуються після того, як
   * замовлення зібрали. Це та сама поведінка, що була в старій касі, і саме
   * вона робить крок «підтвердження» безпечним для покупця.
   */
  async createInvoice(id: string): Promise<AdminOrderInvoiceResponseDto> {
    const order = await this.prisma.db.order.findUnique({
      where: { id },
      select: {
        id: true, number: true, status: true, totalMinor: true,
        items: {
          select: {
            quantity: true, lineTotalMinor: true, variantId: true,
            print: { select: { title: true } },
            variant: { select: { garment: { select: { name: true } } } },
          },
        },
        payments: { select: { invoiceId: true, status: true } },
      },
    });
    if (!order) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Замовлення не знайдено' });
    }
    if (order.status === 'CANCELLED') {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Замовлення скасоване — рахунок виставити не можна',
      });
    }
    const live = order.payments.find(
      (p) => !p.invoiceId.startsWith('pending:') && !['FAILURE', 'EXPIRED', 'REVERSED'].includes(p.status),
    );
    if (live !== undefined) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'На це замовлення вже виставлений рахунок',
      });
    }

    // Адреси — до запису платежу: без них рахунок однаково не виставити,
    // а порожній `pending:` рядок у базі нікому не потрібен.
    const webBase = publicUrl('WEB_PUBLIC_URL');
    const apiBase = publicUrl('API_PUBLIC_URL');

    const pendingInvoiceId = `pending:${randomUUID()}`;
    await this.prisma.db.payment.create({
      data: {
        orderId: order.id,
        invoiceId: pendingInvoiceId,
        status: 'CREATED',
        paymentType: 'HOLD',
        amountMinor: order.totalMinor,
        holdExpiresAt: new Date(Date.now() + HOLD_MAX_DAYS * MS_PER_DAY),
      },
    });

    let invoice: { invoiceId: string; pageUrl: string };
    try {
      invoice = await this.monobank.createInvoice({
        amountMinor: order.totalMinor,
        reference: order.id,
        destination: `Замовлення №${order.number}`,
        redirectUrl: `${webBase}/order/${order.id}`,
        webHookUrl: `${apiBase}/api/v1/payments/monobank/webhook`,
        paymentType: 'hold',
        basketOrder: order.items.map((item) => ({
          name: item.print === null
            ? `${item.variant.garment.name} — без принта`
            : `${item.variant.garment.name} — ${item.print.title}`,
          qty: item.quantity,
          sum: Math.round(item.lineTotalMinor / item.quantity),
          total: item.lineTotalMinor,
          code: item.variantId,
          tax: [0],
        })),
      });
    } catch (error) {
      // Рахунок не створився — прибираємо порожній платіж, інакше кнопка
      // «Виставити рахунок» назавжди вважатиме, що рахунок уже є.
      await this.prisma.db.payment
        .update({
          where: { invoiceId: pendingInvoiceId },
          data: { status: 'FAILURE', failureReason: 'Рахунок не створено' },
        })
        .catch(() => undefined);
      throw error;
    }

    await this.prisma.db.$transaction([
      this.prisma.db.payment.update({
        where: { invoiceId: pendingInvoiceId },
        data: { invoiceId: invoice.invoiceId },
      }),
      this.prisma.db.order.update({
        where: { id: order.id },
        data: { status: 'PENDING_PAYMENT' },
      }),
    ]);

    this.logger.log(`order.invoiced №${order.number} invoice=${invoice.invoiceId}`);
    return { pageUrl: invoice.pageUrl, invoiceId: invoice.invoiceId };
  }
}

type OrderRow = {
  id: string; number: number; status: OrderStatus; note: string | null;
  subtotalMinor: number; discountMinor: number; discountName: string | null;
  shippingMinor: number; totalMinor: number;
  deliveryMethod: AdminOrderDto['delivery']['method'];
  deliveryCity: string; deliveryBranch: string;
  recipientName: string; recipientPhone: string;
  utmSource: string; utmCampaign: string; placedAt: Date;
  customer: { name: string; phone: string };
  items: Array<{
    quantity: number; lineTotalMinor: number; promisedLeadTimeDays: number | null;
    /** null — базовий одяг: рядок замовлення без принта. */
    print: { title: string; slug: string } | null;
    variant: {
      size: { label: string };
      garment: { name: string };
      colour: { name: string | null; supplierCode: string };
    };
  }>;
  payments: Array<{ invoiceId: string; status: string }>;
};

function toAdminOrder(order: OrderRow): AdminOrderDto {
  const payment = order.payments.find((p) => !p.invoiceId.startsWith('pending:'));
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    customer: order.customer,
    delivery: {
      method: order.deliveryMethod,
      city: order.deliveryCity,
      branch: order.deliveryBranch,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
    },
    note: order.note ?? '',
    items: order.items.map((item) => ({
      // Базовий одяг: замість назви принта — чесне «без принта», щоб в
      // адмінці ніхто не шукав макет, якого не існує.
      printTitle: item.print?.title ?? 'Без принта',
      printSlug: item.print?.slug ?? null,
      garmentName: item.variant.garment.name,
      colourName: item.variant.colour.name ?? item.variant.colour.supplierCode,
      sizeLabel: item.variant.size.label,
      quantity: item.quantity,
      lineTotalMinor: item.lineTotalMinor,
      promisedLeadTimeDays: item.promisedLeadTimeDays,
    })),
    subtotalMinor: order.subtotalMinor,
    discountMinor: order.discountMinor,
    discountName: order.discountName,
    shippingMinor: order.shippingMinor,
    totalMinor: order.totalMinor,
    // Адресу сторінки оплати Monobank не віддає повторно, тож збираємо її з
    // номера рахунку — це стабільний формат їхньої каси.
    paymentPageUrl: payment === undefined ? null : `https://pay.mbnk.biz/${payment.invoiceId}`,
    paymentStatus: payment?.status ?? null,
    placedAt: order.placedAt,
    utmSource: order.utmSource,
    utmCampaign: order.utmCampaign,
  };
}
