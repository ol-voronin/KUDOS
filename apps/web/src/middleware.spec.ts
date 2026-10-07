import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

/**
 * Превʼю дивиться в продовий API. Перевіряємо, що з превʼю неможливо
 * створити замовлення, заявку чи оплату, а читати — можна.
 */
function req(method: string, path: string): NextRequest {
  return new NextRequest(`https://preview.example${path}`, { method });
}

afterEach(() => { delete process.env['VERCEL_ENV']; });

describe('middleware на превʼю', () => {
  it('блокує оформлення замовлення, заявки й події', async () => {
    process.env['VERCEL_ENV'] = 'preview';
    for (const path of ['/api/v1/checkout/order', '/api/v1/leads', '/api/v1/custom-requests', '/api/v1/analytics/events', '/api/v1/auth/login']) {
      const res = middleware(req('POST', path));
      expect(res.status, path).toBe(403);
      expect(((await res.json()) as { code: string }).code).toBe('PREVIEW_READ_ONLY');
    }
  });

  it('пропускає читання і розрахунок кошика', () => {
    process.env['VERCEL_ENV'] = 'preview';
    expect(middleware(req('GET', '/api/v1/catalog/prints')).status).toBe(200);
    expect(middleware(req('POST', '/api/v1/cart/quote')).status).toBe(200);
  });

  it('у проді нічого не блокує', () => {
    process.env['VERCEL_ENV'] = 'production';
    expect(middleware(req('POST', '/api/v1/checkout/order')).status).toBe(200);
  });
});
