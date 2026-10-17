/**
 * Умови замовлення одним файлом: оплата, доставка, строк, повернення.
 *
 * До цього про гроші на шляху покупки було чотири різні історії: на товарі
 * «надішлемо рахунок», у FAQ «рахунок» і «блокуються», у кошику «спишемо,
 * коли підтвердимо наявність», на оформленні «гроші лише заблокуються».
 * Людина перед кнопкою не розуміла, що станеться з її грошима (мобільний
 * аудит 17.10.2026, 02-copy C-1, 03-ux #5). Тепер текст один, і товар,
 * кошик, оформлення й FAQ беруть його звідси.
 *
 * Як це працює насправді (`apps/api/src/payments/orders.service.ts`): якщо
 * Monobank підключений, при оформленні сервер виставляє рахунок типу HOLD —
 * сума блокується на картці, списується після того, як ми підтвердили
 * замовлення (`finalize` з адмінки), а не підтвердили — блок знімається.
 * Якщо Monobank недоступний, замовлення однаково створюється, а посилання
 * на оплату надсилаємо вручну. Післяплати немає (рішення Олексія 17.10).
 *
 * Числа (строк, поріг доставки, дні повернення) — з налаштувань сайту,
 * тут лише функції від них. Виняток — орієнтир тарифу Нової Пошти: його
 * в налаштуваннях немає, а тариф рахує перевізник.
 */

/** Основний текст про оплату: Monobank підключений, рахунок HOLD при оформленні. */
export const PAYMENT_TEXT =
  'Оплата карткою через Monobank. Під час оформлення сума лише блокується на картці, '
  + 'а спишемо її, коли підтвердимо замовлення. Не підтвердимо — блок знімемо, нічого не спишеться.';

/**
 * Запасний текст: Monobank зараз не виставляє рахунок одразу (немає токена
 * або банк відповів помилкою). Тоді оплатити можна лише за посиланням від нас.
 */
export const PAYMENT_TEXT_LATER =
  'Оплата карткою через Monobank. Зараз нічого не списується: підтвердимо замовлення '
  + 'й надішлемо посилання на оплату.';

/**
 * Орієнтир тарифу Нової Пошти для однієї-двох речей (рішення Олексія
 * 17.10.2026). Точну суму рахує перевізник, тому лише «~».
 */
export const NP_TARIFF_ESTIMATE = '~80–100 ₴';

/** «3 000 ₴»: гривні з копійок, з пробілом перед знаком. */
export function uahRound(minorAmount: number): string {
  return `${Math.round(minorAmount / 100).toLocaleString('uk-UA')} ₴`;
}

/** Українське відмінювання: 1 день / 2 дні / 5 днів. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export interface Shipping {
  readonly free: boolean;
  /** Що стоїть у рядку «Доставка». */
  readonly value: string;
  /** Пояснення під рядком. */
  readonly note: string;
}

/**
 * Рядок «Доставка» в кошику й на оформленні.
 *
 * Доставка не входить у «До сплати»: до порогу її платить отримувач
 * перевізнику (`shippingMinor` у розрахунку завжди 0). Тому під рядком
 * пояснюємо, коли саме за неї платиш.
 */
export function shippingSummary(subtotalMinor: number, freeFromMinor: number): Shipping {
  if (freeFromMinor > 0 && subtotalMinor >= freeFromMinor) {
    return { free: true, value: 'Безкоштовно', note: `Нова Пошта за наш рахунок: замовлення від ${uahRound(freeFromMinor)}.` };
  }
  return {
    free: false,
    value: `Нова Пошта, ${NP_TARIFF_ESTIMATE}`,
    note: 'За тарифом перевізника, оплачуєш при отриманні.',
  };
}

/**
 * Скільки бракує до безкоштовної доставки. `null` — порога немає або його
 * вже досягнуто. `ratio` від 0 до 1 — для смужки прогресу.
 */
export function freeShippingProgress(
  subtotalMinor: number,
  freeFromMinor: number,
): { missingMinor: number; ratio: number; text: string } | null {
  if (freeFromMinor <= 0 || subtotalMinor >= freeFromMinor) return null;
  const missingMinor = freeFromMinor - subtotalMinor;
  return {
    missingMinor,
    ratio: Math.max(0, subtotalMinor / freeFromMinor),
    text: `Безкоштовна доставка від ${uahRound(freeFromMinor)}: бракує ${uahRound(missingMinor)}.`,
  };
}

/**
 * Строк. `extraLeadDays` — найдовший строк серед позицій під замовлення
 * (`maxLeadTimeDays` з розрахунку кошика): колір чи виріб, який готуємо під замовлення, не
 * виїде швидше за той, що вже лежить. Так само рахує картка товару.
 */
export function productionLine(productionDaysMax: number, extraLeadDays = 0): string {
  const base = `Друкуємо до ${productionDaysMax} ${workingDays(productionDaysMax)} і одразу відправляємо.`;
  if (extraLeadDays <= 0) return base;
  const total = productionDaysMax + extraLeadDays;
  return `${base} Цей колір готуємо під замовлення, тож разом до ${total} ${workingDays(total)}.`;
}

/** «до» + родовий: «до 1 робочого дня», «до 5 робочих днів». */
function workingDays(n: number): string {
  return n % 10 === 1 && n % 100 !== 11 ? 'робочого дня' : 'робочих днів';
}

/**
 * Повернення коротко, під кнопкою. Правило з `config/returns.ts`: річ із
 * принтом друкуємо під замовлення, тож повернення лише за браку чи нашої
 * помилки; базовий одяг — `returnDays` днів.
 */
export function returnLine(
  lines: { hasPrinted: boolean; hasBlank: boolean },
  returnDays: number,
): string {
  const parts: string[] = [];
  if (lines.hasPrinted) parts.push('Річ із принтом друкуємо під тебе: обмін і повернення лише за браку або нашої помилки.');
  if (lines.hasBlank) parts.push(`Базовий одяг без принта можна повернути протягом ${returnDays} ${plural(returnDays, 'дня', 'днів', 'днів')}, якщо не носив.`);
  return parts.join(' ');
}

/** Де читати повні умови. Якорі стоять на питаннях у `/faq`. */
export const PAYMENT_TERMS_HREF = '/faq#oplata';
export const RETURN_TERMS_HREF = '/faq#povernennya';
