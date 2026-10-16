'use client';

/**
 * Meta Pixel (Instagram і Facebook реклама).
 *
 * ── Навіщо ────────────────────────────────────────────────────────────
 *
 * Реклама в Meta оптимізується під подію на сайті: без пікселя алгоритм не
 * знає, хто поклав товар у кошик і хто купив, і шукає просто тих, хто
 * клікає. Попередні кампанії в Meta йшли на «Повідомлення» — розмови в
 * Direct по 220–380 ₴, з яких купували рідко (Олексій, 16.10). Тепер ведемо
 * на сайт і вчимо Meta на покупках.
 *
 * ── ID ────────────────────────────────────────────────────────────────
 *
 * ID пікселя — публічне число, воно все одно видне в коді будь-якої
 * сторінки, тому живе тут, а не в секретах. Порожній рядок — піксель
 * вимкнено повністю: скрипт не вантажиться, події нікуди не йдуть.
 *
 * ── Згода ─────────────────────────────────────────────────────────────
 *
 * Правило те саме, що для Google (`analytics.tsx`): хто колись натиснув
 * «Не треба» в старому банері, тому піксель не вантажимо взагалі.
 *
 * ── Події ─────────────────────────────────────────────────────────────
 *
 * Стандартні назви Meta, бо саме під них є оптимізація кампаній:
 * PageView, ViewContent, AddToCart, InitiateCheckout, Purchase. Purchase
 * іде в ту ж мить, що й у Google Ads, — коли Monobank тримає гроші (HOLD),
 * з `eventID` = номер замовлення, щоб Meta відкидала дублі.
 */
export const META_PIXEL_ID = '';

type Fbq = (...args: unknown[]) => void;

function fbqNow(): Fbq | null {
  if (typeof window === 'undefined') return null;
  const fn = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof fn === 'function' ? fn : null;
}

/**
 * Базовий код Meta, переписаний без мініфікації. Він одразу створює чергу
 * `fbq`, тож події, надіслані до завантаження `fbevents.js`, не губляться.
 */
export function metaPixelInit(pixelId: string): string {
  return `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');`;
}

function send(name: string, params: Record<string, unknown>, eventId?: string): void {
  if (META_PIXEL_ID === '') return;
  const fn = fbqNow();
  if (fn === null) return;
  if (eventId === undefined) fn('track', name, params);
  else fn('track', name, params, { eventID: eventId });
}

export function metaPageView(): void {
  if (META_PIXEL_ID === '') return;
  fbqNow()?.('track', 'PageView');
}

interface MetaItem {
  readonly item_id: string;
  readonly price?: number;
  readonly quantity?: number;
}

function contents(items: readonly MetaItem[]) {
  return {
    content_type: 'product',
    content_ids: items.map((i) => i.item_id),
    contents: items.map((i) => ({ id: i.item_id, quantity: i.quantity ?? 1, item_price: i.price })),
  };
}

export function metaViewContent(item: MetaItem, value: number): void {
  send('ViewContent', { ...contents([item]), currency: 'UAH', value });
}

export function metaAddToCart(item: MetaItem, value: number): void {
  send('AddToCart', { ...contents([item]), currency: 'UAH', value });
}

export function metaInitiateCheckout(items: readonly MetaItem[], value: number): void {
  send('InitiateCheckout', { ...contents(items), currency: 'UAH', value, num_items: items.length });
}

export function metaPurchase(transactionId: string, items: readonly MetaItem[], value: number): void {
  send('Purchase', { ...contents(items), currency: 'UAH', value }, transactionId);
}
