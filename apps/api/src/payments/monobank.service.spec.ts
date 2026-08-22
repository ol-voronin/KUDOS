import { describe, expect, it } from 'vitest';
import { MonobankService } from './monobank.service';

describe('MonobankService.createInvoice basketOrder guard', () => {
  it('rejects a basketOrder whose totals do not add up to the invoice amount', async () => {
    const service = new MonobankService();

    await expect(
      service.createInvoice({
        amountMinor: 10000,
        reference: 'order-1',
        destination: 'Замовлення №1',
        redirectUrl: 'https://example.com/order/1',
        webHookUrl: 'https://example.com/webhook',
        basketOrder: [
          { name: 'Футболка з принтом', qty: 1, sum: 9000, total: 9000, code: 'variant-1', tax: [0] },
        ],
      }),
    ).rejects.toThrow(/basketOrder total.*invoice amount/);
  });

  it('accepts a basketOrder whose totals add up exactly (fails later only on the missing token)', async () => {
    const service = new MonobankService();

    // Passes the basket-total guard, then fails on the *next* check
    // (no MONOBANK_TOKEN in the test environment) — proves the guard itself
    // isn't the blocker once the numbers are correct.
    await expect(
      service.createInvoice({
        amountMinor: 10000,
        reference: 'order-1',
        destination: 'Замовлення №1',
        redirectUrl: 'https://example.com/order/1',
        webHookUrl: 'https://example.com/webhook',
        basketOrder: [
          { name: 'Футболка з принтом', qty: 1, sum: 10000, total: 10000, code: 'variant-1', tax: [0] },
        ],
      }),
    ).rejects.toThrow(/MONOBANK_TOKEN/);
  });
});
