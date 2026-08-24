import { afterEach, describe, expect, it, vi } from 'vitest';
import { MonobankService } from './monobank.service';

/**
 * Оточення задається явно.
 *
 * Раніше другий тест просто розраховував, що `MONOBANK_TOKEN` у оточенні
 * немає — і падав у того, хто перед запуском зробив `. ./.env` у тій самій
 * вкладці. Тест, результат якого залежить від того, що в чиїйсь оболонці
 * випадково не виявилось змінної, не перевіряє нічого: він перевіряє оболонку.
 */

const BASE_INVOICE = {
  amountMinor: 10000,
  reference: 'order-1',
  destination: 'Замовлення №1',
  redirectUrl: 'https://example.com/order/1',
  webHookUrl: 'https://example.com/webhook',
} as const;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('MonobankService.createInvoice', () => {
  it('відхиляє кошик, сума якого не сходиться з сумою рахунку', async () => {
    // Токен тут навмисно валідний: інакше незрозуміло, що саме спрацювало —
    // перевірка кошика чи відсутність токена.
    vi.stubEnv('MONOBANK_TOKEN', 'test-token');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      new MonobankService().createInvoice({
        ...BASE_INVOICE,
        basketOrder: [
          { name: 'Футболка з принтом', qty: 1, sum: 9000, total: 9000, code: 'variant-1', tax: [0] },
        ],
      }),
    ).rejects.toThrow(/basketOrder total.*invoice amount/);

    // Найважливіше в цьому тесті: до банку запит не пішов. Розбіжність у
    // фіскальному чеку має ловитись у нас, а не в податковій.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('без токена не йде в мережу, а падає зрозумілою помилкою', async () => {
    vi.stubEnv('MONOBANK_TOKEN', '');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      new MonobankService().createInvoice({
        ...BASE_INVOICE,
        basketOrder: [
          { name: 'Футболка з принтом', qty: 1, sum: 10000, total: 10000, code: 'variant-1', tax: [0] },
        ],
      }),
    ).rejects.toThrow(/MONOBANK_TOKEN/);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('плейсхолдер із .env.example вважається відсутнім токеном', async () => {
    // Інакше перший же запуск із незаповненим .env пішов би в банк із
    // рядком `__replace_me__` замість токена.
    vi.stubEnv('MONOBANK_TOKEN', '__replace_me__');

    await expect(
      new MonobankService().createInvoice({
        ...BASE_INVOICE,
        basketOrder: [
          { name: 'Футболка з принтом', qty: 1, sum: 10000, total: 10000, code: 'variant-1', tax: [0] },
        ],
      }),
    ).rejects.toThrow(/MONOBANK_TOKEN/);
  });

  it('кошик, сума якого сходиться, проходить перевірку й доходить до запиту', async () => {
    vi.stubEnv('MONOBANK_TOKEN', 'test-token');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ invoiceId: 'inv-1', pageUrl: 'https://pay.mbnk.biz/inv-1' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await new MonobankService().createInvoice({
      ...BASE_INVOICE,
      basketOrder: [
        { name: 'Футболка з принтом', qty: 2, sum: 5000, total: 10000, code: 'variant-1', tax: [0] },
      ],
    });

    expect(result).toEqual({ invoiceId: 'inv-1', pageUrl: 'https://pay.mbnk.biz/inv-1' });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
