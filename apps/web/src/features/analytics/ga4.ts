'use client';

/**
 * Електронна комерція в GA4.
 *
 * ── Чому окремо від `track()` ─────────────────────────────────────────
 *
 * Наша власна статистика має короткий, закритий перелік подій: він лежить у
 * базі колонкою-енумом, і кожна нова назва там коштує міграції. GA4 очікує
 * свій словник — `view_item`, `add_to_cart`, `begin_checkout`, `purchase`, —
 * і саме за цими іменами вмикає звіти про товари, кошик і дохід. Звести
 * обидва словники в один означало б або роздути наш енум чужими назвами,
 * або втратити ті самі звіти, заради яких GA4 і ставили.
 *
 * Тому дві системи лишаються паралельними: наша рахує воронку в нашій базі
 * й не залежить від згоди, GA4 — свою й вантажиться лише після згоди.
 *
 * ── Черга, і чому без неї половини подій не було ──────────────────────
 *
 * Скрипт Google вантажиться `afterInteractive`, тобто вже ПІСЛЯ гідрації.
 * А перегляд товару надсилається з ефекту, який спрацьовує саме в мить
 * гідрації. На звичайному заході — з пошуку, з реклами, з посилання в
 * Instagram — `gtag` у цей момент ще не існує, і подія йшла в нікуди.
 * Помітили це не одразу: при переходах усередині сайту все працювало, бо
 * там скрипт давно завантажений, і перевірка «клац-клац по меню» нічого не
 * показувала. Втрачалися рівно ті заходи, заради яких аналітику й ставлять.
 *
 * Тому подія, що не має куди піти, лягає в чергу, а черга виливається,
 * щойно `gtag` зʼявиться. Чекаємо обмежений час і потім забуваємо: якщо
 * людина не дала згоди, скрипт не зʼявиться ніколи, і накопичене має
 * зникнути разом зі сторінкою. Вилити чергу через хвилину, коли згоду
 * нарешті натиснули, було б тихим обходом самої згоди.
 *
 * ── Мовчазна відмова ──────────────────────────────────────────────────
 *
 * Ні кидків, ні логів. Статистика не та річ, заради якої можна зламати
 * кнопку «Додати в кошик».
 *
 * ── Гроші ─────────────────────────────────────────────────────────────
 *
 * Усередині ми скрізь рахуємо в копійках, GA4 очікує гривні дробом. Перехід
 * робиться рівно тут, одним місцем: розкидана по компонентах ділення на 100
 * рано чи пізно дає звіт, де дохід у сто разів більший за справжній.
 */

/** Товарна позиція у словнику GA4. */
export interface Ga4Item {
  readonly item_id: string;
  readonly item_name: string;
  /** «Принт» або «Базовий одяг» — щоб у звіті було видно два різні продукти. */
  readonly item_category?: string;
  /** Виріб, колір і розмір одним рядком. */
  readonly item_variant?: string;
  /** Гривні, не копійки. */
  readonly price?: number;
  readonly quantity?: number;
}

type Gtag = (...args: readonly unknown[]) => void;

const CURRENCY = 'UAH';

/** Скільки чекаємо на появу `gtag`, перш ніж забути накопичене. */
const WAIT_MS = 10_000;
/** Стеля черги: без згоди вона не виллється ніколи й не має рости вічно. */
const QUEUE_MAX = 20;

const pending: unknown[][] = [];
let waiting: ReturnType<typeof setInterval> | null = null;
let giveUpAt = 0;

function gtagNow(): Gtag | null {
  if (typeof window === 'undefined') return null;
  const fn = (window as unknown as { gtag?: Gtag }).gtag;
  return typeof fn === 'function' ? fn : null;
}

function stopWaiting(): void {
  if (waiting !== null) { clearInterval(waiting); waiting = null; }
  pending.length = 0;
}

/**
 * Надіслати виклик у gtag або відкласти до його появи.
 *
 * Експортується, бо конверсії Google Ads (`analytics/client`) чекають на той
 * самий скрипт і губилися так само — найчастіше на сторінці оплаченого
 * замовлення, яку відкривають переходом за посиланням, а не з каси.
 */
export function sendGtag(...args: readonly unknown[]): void {
  const fn = gtagNow();
  if (fn !== null) { fn(...args); return; }
  if (typeof window === 'undefined') return;

  if (pending.length < QUEUE_MAX) pending.push([...args]);
  giveUpAt = Date.now() + WAIT_MS;
  if (waiting !== null) return;

  waiting = setInterval(() => {
    const ready = gtagNow();
    if (ready !== null) {
      const queued = [...pending];
      stopWaiting();
      for (const call of queued) ready(...call);
      return;
    }
    if (Date.now() > giveUpAt) stopWaiting();
  }, 250);
}

/** Копійки → гривні. Єдине місце, де це перетворення взагалі відбувається. */
export function hryvnia(minorAmount: number): number {
  return Math.round(minorAmount) / 100;
}

function send(name: string, params: Record<string, unknown>): void {
  sendGtag('event', name, params);
}

function sum(items: readonly Ga4Item[]): number {
  return items.reduce((total, i) => total + (i.price ?? 0) * (i.quantity ?? 1), 0);
}

export function ga4ViewItem(item: Ga4Item): void {
  send('view_item', { currency: CURRENCY, value: sum([item]), items: [item] });
}

export function ga4AddToCart(item: Ga4Item): void {
  send('add_to_cart', { currency: CURRENCY, value: sum([item]), items: [item] });
}

export function ga4BeginCheckout(valueMinor: number, items: readonly Ga4Item[]): void {
  send('begin_checkout', { currency: CURRENCY, value: hryvnia(valueMinor), items: [...items] });
}

/**
 * Оплачене замовлення.
 *
 * `transaction_id` обовʼязковий і має бути тим самим при повторі: GA4 сам
 * відкидає дублі за ним, і це друга лінія оборони поверх оберега в
 * `sessionStorage` на сторінці статусу.
 */
export function ga4Purchase(
  transactionId: string,
  valueMinor: number,
  items: readonly Ga4Item[] = [],
): void {
  send('purchase', {
    transaction_id: transactionId,
    currency: CURRENCY,
    value: hryvnia(valueMinor),
    items: [...items],
  });
}
