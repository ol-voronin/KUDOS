'use client';

import type { AnalyticsEventName, AttributionDto, TrackingConfigDto } from '@dt/contracts';
import { EMPTY_ATTRIBUTION } from '@dt/contracts';
import { BROWSER_API_URL } from '@/lib/api-origin';
import { sendGtag } from './ga4';

/**
 * Статистика на боці браузера.
 *
 * Три речі живуть тут разом навмисно, бо це три частини однієї відповіді на
 * питання «звідки прийшов покупець»:
 *
 *   1. **Ідентифікатор візиту** — випадкове число в `sessionStorage`. Не
 *      людини: він зникає з вкладкою й не переживає навіть перезавантаження
 *      в новій вкладці. Саме тому він не є персональними даними.
 *   2. **Перший дотик** — utm/gclid і домен, з якого прийшли, зняті на
 *      першій сторінці візиту й збережені на 30 днів. Саме перший, а не
 *      останній: реклама привела людину на породну сторінку, а форму вона
 *      надіслала з головної — і за останнім дотиком ця заявка виглядала б
 *      як прямий захід.
 *   3. **Події** — надсилаються в наш API. Ніяких cookie, ніяких сторонніх
 *      скриптів.
 *
 * Сторонні теги (GA4, Google Ads) вмикаються окремо й тільки після згоди —
 * див. `consent.ts`. Наша статистика від згоди не залежить, бо збирати
 * нічого, що дозволяє когось упізнати.
 */

const SESSION_KEY = 'dt.sid';
const ATTRIBUTION_KEY = 'dt.attr';
const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

let config: TrackingConfigDto | null = null;

export function setTrackingConfig(next: TrackingConfigDto): void {
  config = next;
}

/** Локальне сховище буває недоступним — приватний режим, вимкнені cookie. */
function safeGet(store: Storage | undefined, key: string): string | null {
  try { return store?.getItem(key) ?? null; } catch { return null; }
}

function safeSet(store: Storage | undefined, key: string, value: string): void {
  try { store?.setItem(key, value); } catch { /* нічого не робимо: статистика не варта збою */ }
}

function randomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function sessionId(): string {
  if (typeof window === 'undefined') return '';
  const existing = safeGet(window.sessionStorage, SESSION_KEY);
  if (existing !== null && existing !== '') return existing;
  const fresh = randomId();
  safeSet(window.sessionStorage, SESSION_KEY, fresh);
  return fresh;
}

function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return ''; }
}

/**
 * Атрибуція першого дотику.
 *
 * Перезаписується лише тоді, коли в адресі є мітки реклами або людина
 * прийшла з чужого сайту. Перехід між нашими ж сторінками нічого не змінює —
 * інакше кожен клік у меню стирав би те, що привело покупця.
 */
export function attribution(): AttributionDto {
  if (typeof window === 'undefined') return EMPTY_ATTRIBUTION;

  const stored = safeGet(window.localStorage, ATTRIBUTION_KEY);
  const saved = stored === null ? null : (JSON.parse(stored) as { at: number; value: AttributionDto });
  const fresh = saved !== null && Date.now() - saved.at < ATTRIBUTION_TTL_MS ? saved.value : null;

  const params = new URLSearchParams(window.location.search);
  const utm = {
    utmSource: params.get('utm_source') ?? '',
    utmMedium: params.get('utm_medium') ?? '',
    utmCampaign: params.get('utm_campaign') ?? '',
    utmTerm: params.get('utm_term') ?? '',
    utmContent: params.get('utm_content') ?? '',
    gclid: params.get('gclid') ?? '',
  };

  const referrerHost = hostOf(document.referrer);
  const external = referrerHost !== '' && referrerHost !== window.location.hostname;
  const hasMarks = Object.values(utm).some((v) => v !== '');

  if (fresh !== null && !hasMarks) {
    return { ...fresh, sessionId: sessionId() };
  }

  const value: AttributionDto = {
    ...utm,
    // Реклама важливіша за реферер: якщо є gclid, домен переходу — це
    // редірект Google, а не джерело.
    referrerHost: hasMarks ? '' : external ? referrerHost : '',
    landingPath: window.location.pathname,
    sessionId: sessionId(),
  };

  if (hasMarks || external || fresh === null) {
    safeSet(window.localStorage, ATTRIBUTION_KEY, JSON.stringify({ at: Date.now(), value }));
  }
  return value;
}

/**
 * Надіслати подію.
 *
 * `sendBeacon`, коли він є: звичайний `fetch` під час переходу на іншу
 * сторінку браузер обриває, і саме конверсійні події втрачаються частіше за
 * інші — бо після них людина кудись іде.
 *
 * Нічого не повертає й ніколи не кидає: статистика не та річ, заради якої
 * можна зламати форму.
 */
export function track(
  name: AnalyticsEventName,
  options: { path?: string; valueMinor?: number } = {},
): void {
  if (typeof window === 'undefined') return;

  const body = JSON.stringify({
    ...attribution(),
    name,
    path: options.path ?? window.location.pathname,
    valueMinor: options.valueMinor ?? null,
  });
  const url = `${BROWSER_API_URL}/analytics/events`;

  try {
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    } else {
      void fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true });
    }
  } catch { /* мовчки */ }

  fireConversion(name, options.valueMinor);
}

/**
 * Конверсія в Google Ads.
 *
 * Спрацьовує тільки якщо є ідентифікатор, є налаштована дія для цієї події
 * і людина дала згоду. Без будь-чого з трьох не робиться нічого — і це не
 * помилка, а нормальний стан сайту без реклами.
 *
 * Викликається окремо там, де подію вже записав сервер: оплата потрапляє в
 * нашу базу з вебхука Monobank, і другий запис із браузера подвоїв би дохід
 * у звіті. А от Google про неї інакше не дізнається — тег живе тільки в
 * браузері.
 *
 * Надсилається через чергу з `ga4`, а не прямим викликом: скрипт Google
 * вантажиться після гідрації, а сторінку оплаченого замовлення найчастіше
 * відкривають посиланням — тобто холодним заходом, коли `gtag` ще не
 * існує. Прямий виклик у цей момент мовчки не робив нічого, і конверсія
 * губилася саме там, де вона найдорожча.
 */
export function fireConversion(name: AnalyticsEventName, valueMinor?: number): void {
  const action = config?.conversions.find((c) => c.event === name && c.isActive);
  const adsId = config?.googleAdsId ?? '';

  if (action === undefined || adsId === '') return;

  sendGtag('event', 'conversion', {
    send_to: `${adsId}/${action.label}`,
    ...(action.sendValue && valueMinor !== undefined
      ? { value: valueMinor / 100, currency: 'UAH' }
      : {}),
  });
}
