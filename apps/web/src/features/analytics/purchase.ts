/**
 * Коли замовлення вважається покупкою для тегів (GA4 і Google Ads).
 *
 * ── Чому не лише `PAID` ───────────────────────────────────────────────
 *
 * Оплата йде через Monobank у режимі HOLD: гроші блокуються на картці, а
 * списуються вручну, коли адмін звірив наявність. До цього замовлення
 * лишається в `PENDING_PAYMENT` з рахунком у стані `HOLD`, а `PAID` воно
 * отримує через години чи дні — коли людина давно закрила сторінку. Подія
 * покупки, привʼязана лише до `PAID`, на практиці не надсилалась ніколи, і
 * Google Ads бачив нуль покупок: кампанії не мали на чому вчитися.
 *
 * З боку покупця HOLD — це вже успішна оплата: він ввів картку, банк гроші
 * заблокував. Тому покупкою рахуємо HOLD і будь-який стан після оплати.
 * Скасування після HOLD трапляється рідко; якщо стане помітним — його
 * коригують у Google Ads завантаженням коригувань за `transaction_id`.
 */
const PAID_OR_LATER: ReadonlySet<string> = new Set(['PAID', 'IN_PRODUCTION', 'SHIPPED', 'COMPLETED']);

export function isPurchaseConfirmed(status: string, paymentStatus: string | null | undefined): boolean {
  if (PAID_OR_LATER.has(status)) return true;
  return status === 'PENDING_PAYMENT' && (paymentStatus === 'HOLD' || paymentStatus === 'SUCCESS');
}

/**
 * Оберіг «одна покупка на замовлення на цей браузер».
 *
 * `localStorage`, а не `sessionStorage`: сторінку статусу відкривають ще раз
 * із закладки чи з повідомлення в іншій вкладці, і кожне таке відкриття
 * інакше ставало б новою конверсією. Друга лінія оборони — `transaction_id`,
 * за яким дублі відкидають і GA4, і Google Ads.
 *
 * Повертає `true`, якщо подію треба надіслати зараз (і одразу позначає її
 * надісланою). Сховище недоступне — надсилаємо: дубль відфільтрує
 * `transaction_id`, а втрачена покупка не відновиться ніяк.
 */
export function claimPurchaseOnce(orderId: string, storage: Storage | undefined = safeLocalStorage()): boolean {
  const key = `dt.purchase.${orderId}`;
  try {
    if (storage === undefined) return true;
    if (storage.getItem(key) !== null) return false;
    storage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
