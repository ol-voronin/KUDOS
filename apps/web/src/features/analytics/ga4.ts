'use client';

import type { CartLineDto } from '@dt/contracts';
import type { ListName } from './lists';

export { LIST, type ListName } from './lists';

/**
 * Електронна комерція в GA4.
 *
 * ── Чому окремо від `track()` ─────────────────────────────────────────
 *
 * Наша власна статистика має короткий, закритий перелік подій: він лежить у
 * базі колонкою-енумом, і кожна нова назва там коштує міграції. GA4 очікує
 * свій словник — і саме за цими іменами вмикає звіти про товари, кошик і
 * дохід. Звести обидва словники в один означало б або роздути наш енум
 * чужими назвами, або втратити ті самі звіти, заради яких GA4 і ставили.
 *
 * ── Чому подій багато ─────────────────────────────────────────────────
 *
 * Спокуса обмежитись переглядом і покупкою велика, і вона дорого коштує:
 * така пара показує, СКІЛЬКИ втрачено, і не показує ДЕ. Повний ланцюг —
 * список → картка → кошик → доставка → оплата — перетворює «конверсія
 * 1,2%» на «з кошика в оформлення доходить троє з десяти, а з оформлення
 * в оплату — дев'ятеро», і це вже діагноз, а не симптом.
 *
 * Те саме з полями товару. `item_list_name` відповідає на питання, яка
 * вітрина продає: породна сторінка, колекція чи головна. `item_category2`
 * тримає колекцію окремо від типу товару. `index` дає позицію в списку —
 * без неї неможливо сказати, чи справа в товарі, чи в тому, що він
 * дев'ятий. Дописати поле пізніше не можна: історія не переписується.
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
 */

type Gtag = (...args: readonly unknown[]) => void;

const CURRENCY = 'UAH';
const BRAND = 'БАБАКА';

/** Скільки чекаємо на появу `gtag`, перш ніж забути накопичене. */
const WAIT_MS = 10_000;
/** Стеля черги: без згоди вона не виллється ніколи й не має рости вічно. */
const QUEUE_MAX = 30;

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

// ---------------------------------------------------------------------------
// Товарна позиція
// ---------------------------------------------------------------------------

/**
 * Позиція у словнику GA4.
 *
 * Товаром вважається ПРИНТ, а виріб, колір і розмір — його варіант: у звіті
 * потрібно бачити, який малюнок продається, а не те, що «футболок продано
 * сорок». Базовий одяг без принта — окрема категорія, інакше два різні
 * продукти злипнуться в один рядок.
 */
export interface Ga4Item {
  readonly item_id: string;
  readonly item_name: string;
  readonly item_brand?: string;
  /** «Принт» або «Базовий одяг». */
  readonly item_category?: string;
  /** Колекція для принта, тип виробу для базового одягу. */
  readonly item_category2?: string;
  /** Виріб, колір і розмір одним рядком. */
  readonly item_variant?: string;
  /*
   * Три параметри нижче — не словник GA4, а наші власні. У звітах вони
   * зʼявляються лише після того, як їх зареєструють як виміри рівня товару
   * в адмінці, і лише для подій, що прийшли ПІСЛЯ реєстрації. Заднім числом
   * жоден із них не наповнюється — тому вони й додані до першого трафіку.
   *
   * `breed` відповідає на головне питання цього бізнесу: яка порода приносить
   * гроші. Породних сторінок у нас більше, ніж будь-яких інших, і вся
   * пошукова архітектура тримається на них.
   *
   * Принт із двома породами («такса і йорк») не розкладається на дві — виміри
   * GA4 скалярні. Такі принти склеюються через `+` і читаються як окремий вид
   * товару, яким вони по суті й є.
   */
  readonly breed?: string;
  readonly collection?: string;
  /** Тип виробу окремо від кольору й розміру — щоб можна було групувати. */
  readonly garment?: string;
  /** Гривні, не копійки. */
  readonly price?: number;
  /** Знижка на одиницю, гривні. */
  readonly discount?: number;
  readonly quantity?: number;
  /** Позиція в списку, з нуля. */
  readonly index?: number;
  readonly item_list_id?: string;
  readonly item_list_name?: string;
}

/**
 * Кілька слагів в одне значення виміру.
 *
 * Порожньо — `undefined`, а не порожній рядок: GA4 показує порожній рядок як
 * повноцінне значення «», і в звіті зʼявляється рядок-привид.
 */
function joinSlugs(slugs: readonly string[]): string | undefined {
  return slugs.length === 0 ? undefined : [...slugs].sort().join('+');
}

/** Рядок кошика → позиція GA4. Одне місце на кошик, касу й покупку. */
export function itemFromCartLine(line: CartLineDto, index: number): Ga4Item {
  const isPrint = line.printSlug !== null;
  return {
    item_id: line.printSlug ?? line.garmentSlug,
    item_name: line.title,
    item_brand: BRAND,
    item_category: isPrint ? 'Принт' : 'Базовий одяг',
    item_category2: isPrint ? joinSlugs(line.collectionSlugs) : line.garmentName,
    breed: isPrint ? joinSlugs(line.breedSlugs) : undefined,
    collection: isPrint ? joinSlugs(line.collectionSlugs) : undefined,
    garment: line.garmentName,
    item_variant: [line.garmentName, line.colourName, line.sizeLabel]
      .filter((part) => part !== '').join(' · '),
    price: hryvnia(line.unitMinor),
    discount: hryvnia(line.discountMinor) / Math.max(1, line.quantity),
    quantity: line.quantity,
  };
}

/** Проставити бренд там, де його не вказали руками. */
function withBrand(item: Ga4Item): Ga4Item {
  return item.item_brand === undefined ? { ...item, item_brand: BRAND } : item;
}

function send(name: string, params: Record<string, unknown>): void {
  sendGtag('event', name, params);
}

function total(items: readonly Ga4Item[]): number {
  const sum = items.reduce(
    (acc, i) => acc + ((i.price ?? 0) - (i.discount ?? 0)) * (i.quantity ?? 1),
    0,
  );
  return Math.round(sum * 100) / 100;
}

// ---------------------------------------------------------------------------
// Згода
// ---------------------------------------------------------------------------

/**
 * Consent Mode v2.
 *
 * `ad_user_data` тут не для галочки: без нього Enhanced Conversions не
 * спрацьовують ВЗАГАЛІ — не гірше, а ніяк. Це найтихіша з відомих поломок
 * вимірювання, бо в інтерфейсі все виглядає ввімкненим.
 *
 * Ми працюємо в базовому режимі: до згоди не вантажиться нічого. Це коштує
 * нам моделювання пропусків, яке дає розширений режим, і ця ціна свідома —
 * розширений режим означає запит на сервер Google до згоди, а пояснити цю
 * різницю в політиці складніше, ніж вона того варта на нашому обсязі.
 * Команди нижче все одно надсилаються: вони роблять стан явним і
 * знадобляться в ту хвилину, коли ми поїдемо на ЄС.
 */
export function ga4ConsentGranted(): void {
  sendGtag('consent', 'update', {
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
    analytics_storage: 'granted',
  });
}

// ---------------------------------------------------------------------------
// Події
// ---------------------------------------------------------------------------

/*
 * `item_list_name` каже ВИД вітрини — «Порода», «Колекція». Сам по собі він не
 * каже, ЯКА саме порода, а це і є питання, заради якого породні сторінки
 * писалися. Тому поруч їде `item_list_id` зі слагом конкретної сторінки:
 * це стандартний вимір GA4, його не треба нічого реєструвати, і він одразу
 * розкладає список на рядки «taksa», «korhi», «mops».
 */
export function ga4ViewItemList(
  listName: ListName, items: readonly Ga4Item[], listId?: string,
): void {
  if (items.length === 0) return;
  send('view_item_list', {
    item_list_name: listName,
    item_list_id: listId,
    items: items.map((i, index) => ({
      ...withBrand(i), index, item_list_name: listName, item_list_id: listId,
    })),
  });
}

export function ga4SelectItem(
  listName: ListName, item: Ga4Item, index: number, listId?: string,
): void {
  send('select_item', {
    item_list_name: listName,
    item_list_id: listId,
    items: [{ ...withBrand(item), index, item_list_name: listName, item_list_id: listId }],
  });
}

export function ga4ViewItem(item: Ga4Item): void {
  send('view_item', { currency: CURRENCY, value: total([item]), items: [withBrand(item)] });
}

export function ga4AddToCart(item: Ga4Item): void {
  send('add_to_cart', { currency: CURRENCY, value: total([item]), items: [withBrand(item)] });
}

export function ga4RemoveFromCart(item: Ga4Item): void {
  send('remove_from_cart', { currency: CURRENCY, value: total([item]), items: [withBrand(item)] });
}

export function ga4ViewCart(items: readonly Ga4Item[]): void {
  if (items.length === 0) return;
  send('view_cart', { currency: CURRENCY, value: total(items), items: [...items] });
}

export function ga4BeginCheckout(items: readonly Ga4Item[]): void {
  if (items.length === 0) return;
  send('begin_checkout', { currency: CURRENCY, value: total(items), items: [...items] });
}

/** `shipping_tier` — спосіб доставки словами, як його обрала людина. */
export function ga4AddShippingInfo(tier: string, items: readonly Ga4Item[]): void {
  send('add_shipping_info', {
    currency: CURRENCY, value: total(items), shipping_tier: tier, items: [...items],
  });
}

export function ga4AddPaymentInfo(method: string, items: readonly Ga4Item[]): void {
  send('add_payment_info', {
    currency: CURRENCY, value: total(items), payment_type: method, items: [...items],
  });
}

/**
 * Оплачене замовлення.
 *
 * `transaction_id` обовʼязковий і має бути тим самим при повторі: GA4 сам
 * відкидає дублі за ним, і це друга лінія оборони поверх оберега в
 * `sessionStorage` на сторінці статусу.
 *
 * `value` — повна сума замовлення разом із доставкою, як того й чекає GA4;
 * доставка при цьому йде окремим полем, щоб її було видно в звіті. А от у
 * Google Ads як цінність конверсії передається сума БЕЗ доставки: платити
 * за клік, розраховуючи маржу з чужої пересилки, — найшвидший спосіб
 * зробити прибуткову кампанію збитковою.
 */
export function ga4Purchase(input: {
  transactionId: string;
  valueMinor: number;
  shippingMinor?: number;
  items?: readonly Ga4Item[];
}): void {
  // Знижки на рівні замовлення тут свідомо немає: у GA4 знижка живе на
  // позиції (`discount` у кожному товарі), і її вже проставляє
  // `itemFromCartLine`. Додати ще й загальну означало б порахувати її двічі.
  send('purchase', {
    transaction_id: input.transactionId,
    currency: CURRENCY,
    value: hryvnia(input.valueMinor),
    ...(input.shippingMinor !== undefined ? { shipping: hryvnia(input.shippingMinor) } : {}),
    items: input.items === undefined ? [] : [...input.items],
  });
}

/** Заявка на власний принт або зворотний звʼязок. */
export function ga4GenerateLead(kind: string): void {
  send('generate_lead', { currency: CURRENCY, value: 0, lead_source: kind });
}

export function ga4Search(term: string): void {
  if (term.trim() === '') return;
  send('search', { search_term: term.trim() });
}
