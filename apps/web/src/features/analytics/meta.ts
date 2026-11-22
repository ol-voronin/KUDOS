'use client';

/**
 * Піксель Meta (Instagram і Facebook).
 *
 * ── Навіщо ────────────────────────────────────────────────────────────
 *
 * Реклама в Instagram без пікселя бачить лише кліки й повідомлення. Вона не
 * знає, хто купив, і тому оптимізується на тих, хто клікає, — а клік нічого
 * не вартий. З пікселем кампанію можна вести на покупки, а аудиторії
 * ретаргетингу («дивились худі, не купили») збираються самі.
 *
 * ── Події ─────────────────────────────────────────────────────────────
 *
 * Стандартні назви Meta, бо саме за ними вмикаються оптимізація й звіти:
 *   page_view → PageView, view_item → ViewContent, add_to_cart → AddToCart,
 *   checkout_started → InitiateCheckout, lead_submitted → Lead,
 *   покупка → Purchase з `eventID` = `order-<номер>` — тим самим, що шле
 *   сервер через Conversions API, щоб Meta склеїла пару в одну покупку.
 *
 * ── Черга ─────────────────────────────────────────────────────────────
 *
 * Та сама проблема, що з gtag (див. `ga4.ts`): скрипт вантажиться після
 * гідрації, а перший перегляд товару надсилається саме в мить гідрації.
 * Тож подія, якій нема куди піти, чекає в черзі обмежений час. Якщо скрипт
 * так і не зʼявився (людина колись відмовилась від аналітики) — черга
 * зникає разом зі сторінкою.
 */

type Fbq = (...args: readonly unknown[]) => void;

const WAIT_MS = 10_000;
const QUEUE_MAX = 30;

const pending: unknown[][] = [];
let waiting: ReturnType<typeof setInterval> | null = null;
let giveUpAt = 0;

function fbqNow(): Fbq | null {
  if (typeof window === 'undefined') return null;
  const fn = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof fn === 'function' ? fn : null;
}

export function sendFbq(...args: readonly unknown[]): void {
  const fn = fbqNow();
  if (fn !== null) {
    try { fn(...args); } catch { /* мовчки */ }
    return;
  }
  if (typeof window === 'undefined') return;
  if (pending.length < QUEUE_MAX) pending.push([...args]);
  giveUpAt = Date.now() + WAIT_MS;
  if (waiting !== null) return;
  waiting = setInterval(() => {
    const ready = fbqNow();
    if (ready !== null) {
      for (const call of pending.splice(0)) {
        try { ready(...call); } catch { /* мовчки */ }
      }
    }
    if (ready !== null || Date.now() > giveUpAt) {
      if (waiting !== null) { clearInterval(waiting); waiting = null; }
      pending.length = 0;
    }
  }, 250);
}

/**
 * Чи завантажено піксель — ставиться з `Analytics`. Події від нього не
 * залежать (без скрипта черга просто згасне), а сигнали для каси — так:
 * без пікселя чи після відмови сервер не має чого передавати в Meta.
 */
let enabled = false;
export function setMetaEnabled(value: boolean): void { enabled = value; }
export function metaEnabled(): boolean { return enabled; }

const STANDARD: Readonly<Record<string, string>> = {
  page_view: 'PageView',
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  checkout_started: 'InitiateCheckout',
  lead_submitted: 'Lead',
};

/** Подія з нашого словника → стандартна подія Meta. Покупка — окремо. */
export function metaTrack(name: string, valueMinor?: number): void {
  const event = STANDARD[name];
  if (event === undefined) return;
  const params = valueMinor !== undefined && Number.isFinite(valueMinor)
    ? { value: valueMinor / 100, currency: 'UAH' }
    : {};
  sendFbq('track', event, params);
}

/** Покупка. `orderNumber` дає той самий event_id, що й сервер. */
export function metaPurchase(orderNumber: number, valueMinor: number): void {
  sendFbq('track', 'Purchase', { value: valueMinor / 100, currency: 'UAH' }, { eventID: `order-${orderNumber}` });
}

function cookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return match === undefined ? '' : decodeURIComponent(match.slice(name.length + 1));
}

/**
 * `_fbp` і `_fbc` для Conversions API — лише коли піксель увімкнено.
 *
 * `_fbc` ставить сам піксель, коли людина прийшла з реклами з `fbclid` в
 * адресі. Якщо cookie ще немає (піксель не встиг) — збираємо з `fbclid` самі
 * у форматі Meta: `fb.1.<час>.<fbclid>`.
 */
export function metaSignals(): { fbp: string; fbc: string } | undefined {
  if (!enabled) return undefined;
  let fbc = cookie('_fbc');
  if (fbc === '') {
    try {
      const fbclid = new URLSearchParams(window.location.search).get('fbclid')
        ?? window.localStorage.getItem('dt.fbclid');
      if (fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
    } catch { /* нічого */ }
  }
  return { fbp: cookie('_fbp'), fbc };
}

/** Запамʼятати `fbclid` із першої сторінки: до каси людина дійде вже без нього в адресі. */
export function rememberFbclid(): void {
  try {
    const fbclid = new URLSearchParams(window.location.search).get('fbclid');
    if (fbclid) window.localStorage.setItem('dt.fbclid', fbclid);
  } catch { /* нічого */ }
}

/** Базовий код Meta з їхньої документації — без автоматичного PageView. */
export function metaInitScript(pixelId: string): string {
  return `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');`;
}
