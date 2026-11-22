import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

/**
 * Conversions API Meta — покупка з сервера.
 *
 * ── Навіщо, якщо піксель уже стоїть у браузері ────────────────────────
 *
 * Та сама причина, з якої оплата пишеться у власну статистику з вебхука:
 * тег на сторінці «дякуємо» не спрацює, якщо людина закрила вкладку, сиділа
 * через блокер чи в Instagram-браузері з обрізаними cookie. А реклама в
 * Instagram вчиться саме на покупках — без них вона оптимізується на кліки.
 *
 * ── Дублів немає ──────────────────────────────────────────────────────
 *
 * Браузер і сервер надсилають ту саму подію з тим самим `event_id`
 * (`order-<номер>`). Meta склеює пару в одну покупку.
 *
 * ── Згода ─────────────────────────────────────────────────────────────
 *
 * Надсилаємо лише замовлення з `metaSignals`: їх пише каса тільки тоді, коли
 * піксель налаштований і людина не відмовлялась від аналітики. Відмова —
 * отже, сервер теж мовчить.
 *
 * ── Налаштування ──────────────────────────────────────────────────────
 *
 * `META_PIXEL_ID` і `META_CAPI_TOKEN` в env API (токен — секрет, у базі йому
 * не місце). Без будь-якого з двох сервіс нічого не робить.
 * `META_TEST_EVENT_CODE` — необовʼязковий, для вкладки «Тестові події».
 */
const GRAPH_VERSION = 'v21.0';

export interface MetaSignals {
  fbp?: string;
  fbc?: string;
  ip?: string;
  ua?: string;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Meta хоче телефон цифрами з кодом країни, без «+»: 380XXXXXXXXX. */
export function metaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (/^0\d{9}$/.test(digits)) return `38${digits}`;
  return digits;
}

/** Імʼя — перше слово, малими літерами, як вимагає Meta для хешу. */
export function metaFirstName(name: string): string {
  return (name.trim().split(/\s+/)[0] ?? '').toLowerCase();
}

export function purchaseEventId(orderNumber: number): string {
  return `order-${orderNumber}`;
}

@Injectable()
export class MetaCapiService {
  private readonly log = new Logger(MetaCapiService.name);

  constructor(private readonly prisma: PrismaService) {}

  private configured(): { pixelId: string; token: string } | null {
    const pixelId = process.env['META_PIXEL_ID'] ?? '';
    const token = process.env['META_CAPI_TOKEN'] ?? '';
    return pixelId !== '' && token !== '' ? { pixelId, token } : null;
  }

  /**
   * Покупка. Ніколи не кидає: вебхук Monobank не має падати через рекламу.
   */
  async sendPurchase(orderId: string): Promise<void> {
    const conf = this.configured();
    if (conf === null) return;

    try {
      const order = await this.prisma.db.order.findUnique({
        where: { id: orderId },
        select: {
          number: true, totalMinor: true, shippingMinor: true, placedAt: true,
          metaSignals: true, customerId: true,
          customer: { select: { phone: true, name: true } },
          items: { select: { quantity: true, printId: true, variantId: true } },
        },
      });
      if (!order || order.metaSignals === null) return;

      const signals = order.metaSignals as MetaSignals;
      const webUrl = (process.env['WEB_PUBLIC_URL'] ?? '').replace(/\/$/, '');

      const userData: Record<string, unknown> = {
        ph: [sha256(metaPhone(order.customer.phone))],
        external_id: [sha256(order.customerId)],
        country: [sha256('ua')],
      };
      const fn = metaFirstName(order.customer.name);
      if (fn !== '') userData['fn'] = [sha256(fn)];
      if (signals.fbp) userData['fbp'] = signals.fbp;
      if (signals.fbc) userData['fbc'] = signals.fbc;
      if (signals.ip) userData['client_ip_address'] = signals.ip;
      if (signals.ua) userData['client_user_agent'] = signals.ua;

      const body: Record<string, unknown> = {
        data: [{
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          event_id: purchaseEventId(order.number),
          action_source: 'website',
          ...(webUrl !== '' ? { event_source_url: `${webUrl}/order/${orderId}` } : {}),
          user_data: userData,
          custom_data: {
            currency: 'UAH',
            // Без доставки — так само, як у Google Ads: ставки рахуються від
            // виручки за товар, а не від чужої пересилки.
            value: (order.totalMinor - order.shippingMinor) / 100,
            order_id: String(order.number),
            content_type: 'product',
            contents: order.items.map((i) => ({ id: i.printId ?? i.variantId, quantity: i.quantity })),
            num_items: order.items.reduce((s, i) => s + i.quantity, 0),
          },
        }],
      };
      const testCode = process.env['META_TEST_EVENT_CODE'] ?? '';
      if (testCode !== '') body['test_event_code'] = testCode;

      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${conf.pixelId}/events?access_token=${encodeURIComponent(conf.token)}`,
        { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
      );
      if (!res.ok) {
        // Не логуємо URL — у ньому токен.
        this.log.error(`meta.capi.failed order=${order.number} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
        return;
      }
      this.log.log(`meta.capi.purchase order=${order.number}`);
    } catch (error: unknown) {
      this.log.error(`meta.capi.error ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
