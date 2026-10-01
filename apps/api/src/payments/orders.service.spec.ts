import { BadGatewayException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OrderDraftRequestDto } from '@dt/contracts';
import { OrdersAdminService } from './orders-admin.service';
import { canPayAtCheckout, OrdersService } from './orders.service';

vi.mock('../common/telegram', () => ({
  sendToTelegram: vi.fn(async () => undefined),
  escapeHtml: (v: string) => v,
}));

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const PAGE_URL = 'https://pay.mbnk.biz/inv-1';

type Line = { printId: string | null; printSlug: string | null; printMethod: 'DTF' | null };

const readyPrint: Line = { printId: 'p-1', printSlug: 'boss-lab', printMethod: 'DTF' };
const blank: Line = { printId: null, printSlug: null, printMethod: null };

function pricedLine(over: Line) {
  return {
    ...over,
    variantId: 'v-1', quantity: 1, printTitle: 'Boss lab', garmentName: 'Футболка',
    colourName: 'Чорний', sizeLabel: 'L',
    garmentPriceMinor: 50000, printPriceMinor: 20000, lineTotalMinor: 70000, leadTimeDays: 3,
  };
}

const dto: OrderDraftRequestDto = {
  items: [{ printSlug: 'boss-lab', variantId: '22222222-2222-4222-8222-222222222222', printMethod: 'DTF', quantity: 1 }],
  customer: { name: 'Оля', phone: '+380671234567', marketingConsent: false },
  delivery: { method: 'PICKUP', city: '', branch: '', recipientName: '', recipientPhone: '' },
  note: '',
};

/**
 * Заглушки. `prisma.db` — та сама форма, що в `PrismaService`: транзакція
 * отримує `tx` з моделями customer/order.
 */
function setup(opts: {
  configured: boolean;
  lines?: Line[];
  stream?: string;
  invoice?: () => Promise<{ pageUrl: string; invoiceId: string }>;
}) {
  const orderCreate = vi.fn(async () => ({
    id: ORDER_ID, number: 7, totalMinor: 70000, stream: opts.stream ?? 'READY_PRINT',
  }));
  const tx = {
    customer: { upsert: vi.fn(async () => ({ id: 'c-1' })) },
    order: { create: orderCreate },
  };
  const prisma = { db: { $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)) } };
  const cart = {
    priceForCheckout: vi.fn(async () => ({
      lines: (opts.lines ?? [readyPrint]).map(pricedLine),
      subtotalMinor: 70000, discountMinor: 0, discountNames: [], shippingMinor: 0, totalMinor: 70000,
    })),
  };
  const ordersAdmin = {
    createInvoice: vi.fn(opts.invoice ?? (async () => ({ pageUrl: PAGE_URL, invoiceId: 'inv-1' }))),
  };
  const monobank = { isConfigured: vi.fn(() => opts.configured) };
  const service = new OrdersService(prisma as never, cart as never, ordersAdmin as never, monobank as never);
  return { service, ordersAdmin, orderCreate };
}

describe('OrdersService.createDraft — рахунок одразу при оформленні', () => {
  it('з токеном виставляє рахунок і повертає paymentPageUrl', async () => {
    const { service, ordersAdmin } = setup({ configured: true });

    const result = await service.createDraft(dto);

    expect(ordersAdmin.createInvoice).toHaveBeenCalledWith(ORDER_ID);
    expect(result).toEqual({ orderId: ORDER_ID, orderNumber: 7, totalMinor: 70000, paymentPageUrl: PAGE_URL });
  });

  it('базовий одяг разом із готовим принтом теж отримує рахунок', async () => {
    const { service, ordersAdmin } = setup({ configured: true, lines: [readyPrint, blank] });

    const result = await service.createDraft(dto);

    expect(ordersAdmin.createInvoice).toHaveBeenCalledOnce();
    expect(result.paymentPageUrl).toBe(PAGE_URL);
  });

  it('без токена створює замовлення без рахунку, як раніше', async () => {
    const { service, ordersAdmin, orderCreate } = setup({ configured: false });

    const result = await service.createDraft(dto);

    expect(orderCreate).toHaveBeenCalledOnce();
    expect(ordersAdmin.createInvoice).not.toHaveBeenCalled();
    expect(result).toEqual({ orderId: ORDER_ID, orderNumber: 7, totalMinor: 70000 });
    expect('paymentPageUrl' in result).toBe(false);
  });

  it('помилка Monobank не ламає замовлення: відповідь без paymentPageUrl', async () => {
    const { service, ordersAdmin, orderCreate } = setup({
      configured: true,
      invoice: async () => { throw new BadGatewayException('Monobank 500'); },
    });

    const result = await service.createDraft(dto);

    expect(orderCreate).toHaveBeenCalledOnce();
    expect(ordersAdmin.createInvoice).toHaveBeenCalledOnce();
    expect(result).toEqual({ orderId: ORDER_ID, orderNumber: 7, totalMinor: 70000 });
  });

  it('кастомний потік рахунку одразу не отримує', async () => {
    const { service, ordersAdmin } = setup({ configured: true, stream: 'CUSTOMISATION' });

    const result = await service.createDraft(dto);

    expect(ordersAdmin.createInvoice).not.toHaveBeenCalled();
    expect(result.paymentPageUrl).toBeUndefined();
  });
});

describe('canPayAtCheckout', () => {
  it('готові принти й базовий одяг у кошиковому потоці — так', () => {
    expect(canPayAtCheckout('READY_PRINT', [readyPrint])).toBe(true);
    expect(canPayAtCheckout('READY_PRINT', [blank])).toBe(true);
    expect(canPayAtCheckout('READY_PRINT', [readyPrint, blank])).toBe(true);
  });

  it('кастомізація і «принт з нуля» — ні', () => {
    expect(canPayAtCheckout('CUSTOMISATION', [readyPrint])).toBe(false);
    expect(canPayAtCheckout('FROM_ZERO', [blank])).toBe(false);
  });

  it('рядок із принтом, якого немає в каталозі, — ні', () => {
    expect(canPayAtCheckout('READY_PRINT', [readyPrint, { printId: null, printSlug: 'my-dog', printMethod: 'DTF' }]))
      .toBe(false);
  });

  it('порожній кошик — ні', () => {
    expect(canPayAtCheckout('READY_PRINT', [])).toBe(false);
  });
});

describe('OrdersAdminService.createInvoice — те, що викликає оформлення', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  function fakeDb() {
    return {
      db: {
        order: {
          findUnique: vi.fn(async () => ({
            id: ORDER_ID, number: 7, status: 'NEW', totalMinor: 70000, payments: [],
            items: [{
              quantity: 1, lineTotalMinor: 70000, variantId: 'v-1',
              print: { title: 'Boss lab' }, variant: { garment: { name: 'Футболка' } },
            }],
          })),
          update: vi.fn(),
        },
        payment: { create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) },
        $transaction: vi.fn(async () => []),
      },
    };
  }

  it('рахунок HOLD з basketOrder, redirect на «дякуємо» і вебхуком', async () => {
    vi.stubEnv('WEB_PUBLIC_URL', 'https://babaka.shop/');
    vi.stubEnv('API_PUBLIC_URL', 'https://api.example');
    const prisma = fakeDb();
    const monobank = { createInvoice: vi.fn(async () => ({ invoiceId: 'inv-1', pageUrl: PAGE_URL })) };

    const result = await new OrdersAdminService(prisma as never, monobank as never).createInvoice(ORDER_ID);

    expect(result.pageUrl).toBe(PAGE_URL);
    expect(monobank.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      amountMinor: 70000,
      paymentType: 'hold',
      redirectUrl: `https://babaka.shop/order/${ORDER_ID}`,
      webHookUrl: 'https://api.example/api/v1/payments/monobank/webhook',
      basketOrder: [expect.objectContaining({ total: 70000, qty: 1 })],
    }));
  });

  it('без WEB_PUBLIC_URL падає до запису платежу — заготовка в базі не лишається', async () => {
    vi.stubEnv('WEB_PUBLIC_URL', '');
    vi.stubEnv('API_PUBLIC_URL', 'https://api.example');
    const prisma = fakeDb();
    const monobank = { createInvoice: vi.fn() };

    await expect(new OrdersAdminService(prisma as never, monobank as never).createInvoice(ORDER_ID))
      .rejects.toThrow('WEB_PUBLIC_URL');
    expect(prisma.db.payment.create).not.toHaveBeenCalled();
    expect(monobank.createInvoice).not.toHaveBeenCalled();
  });

  it('помилка Monobank позначає заготовку платежу як FAILURE і кидає далі', async () => {
    vi.stubEnv('WEB_PUBLIC_URL', 'https://babaka.shop');
    vi.stubEnv('API_PUBLIC_URL', 'https://api.example');
    const prisma = fakeDb();
    const monobank = { createInvoice: vi.fn(async () => { throw new BadGatewayException('x'); }) };

    await expect(new OrdersAdminService(prisma as never, monobank as never).createInvoice(ORDER_ID))
      .rejects.toThrow();
    expect(prisma.db.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'FAILURE' }),
    }));
  });
});
