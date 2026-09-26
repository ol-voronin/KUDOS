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
 * ── Мовчазна відмова ──────────────────────────────────────────────────
 *
 * Якщо `gtag` не завантажений — а це нормальний стан сайту без згоди або
 * без ідентифікатора, — усі функції нижче нічого не роблять. Не кидають, не
 * логують, не чекають. Статистика не та річ, заради якої можна зламати
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

/** Копійки → гривні. Єдине місце, де це перетворення взагалі відбувається. */
export function hryvnia(minorAmount: number): number {
  return Math.round(minorAmount) / 100;
}

function send(name: string, params: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag !== 'function') return;
  gtag('event', name, params);
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
