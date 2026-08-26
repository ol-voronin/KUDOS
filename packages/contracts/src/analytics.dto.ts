import { z } from 'zod';

/**
 * Статистика, атрибуція й конверсії.
 *
 * Головна ідея, яку тут варто прочитати першою: **персональних даних немає**.
 * Ні IP, ні User-Agent, ні повного посилання, з якого прийшли (воно інколи
 * містить пошуковий запит, а це вже дані людини). `sessionId` — випадкове
 * число на один візит, воно нікого не ідентифікує й не переживає закриття
 * вкладки.
 *
 * Через це власна статистика не потребує згоди відвідувача. Згода потрібна
 * рівно для GA4, який ставить свої cookie, — і саме тому ці дві речі тут
 * розділені, а не змішані в один «модуль аналітики».
 */

const ShortText = z.string().max(200);

/**
 * Події, які ми рахуємо.
 *
 * Закритий перелік, а не довільний рядок. Причина не в акуратності: відкритий
 * перелік означає, що через півроку в базі лежатимуть `lead_submit`,
 * `leadSubmitted` і `lead-submitted` як три різні події, і жоден звіт не
 * зійдеться.
 */
export const AnalyticsEventName = z.enum([
  'page_view',
  'lead_submitted',
  'checkout_started',
  'purchase',
  'telegram_click',
]);
export type AnalyticsEventName = z.infer<typeof AnalyticsEventName>;

export const EVENT_LABELS: Readonly<Record<AnalyticsEventName, string>> = {
  page_view: 'Перегляд сторінки',
  lead_submitted: 'Заявка з форми',
  checkout_started: 'Початок оформлення',
  purchase: 'Оплачене замовлення',
  telegram_click: 'Клік у Telegram',
};

/**
 * Звідки людина прийшла на сайт.
 *
 * Знімається один раз, на першій сторінці візиту, і далі їде з нею до заявки
 * чи замовлення. Саме «перший дотик», а не остання сторінка: реклама привела
 * людину на породну сторінку, а форму вона надіслала з головної — і без
 * першого дотику ця заявка виглядала б як «прямий захід».
 */
export const AttributionDto = z.object({
  utmSource: ShortText.default(''),
  utmMedium: ShortText.default(''),
  utmCampaign: ShortText.default(''),
  utmTerm: ShortText.default(''),
  utmContent: ShortText.default(''),
  /** Ідентифікатор кліку Google Ads. Без нього офлайн-конверсію не привʼязати. */
  gclid: ShortText.default(''),
  landingPath: z.string().max(500).default(''),
  /** Тільки домен. Повне посилання інколи містить пошуковий запит. */
  referrerHost: ShortText.default(''),
  sessionId: ShortText.default(''),
});
export type AttributionDto = z.infer<typeof AttributionDto>;

export const EMPTY_ATTRIBUTION: AttributionDto = {
  utmSource: '', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent: '',
  gclid: '', landingPath: '', referrerHost: '', sessionId: '',
};

/** Те, що браузер надсилає на кожну подію. */
export const TrackEventDto = AttributionDto.extend({
  name: AnalyticsEventName,
  path: z.string().max(500),
  /** Тільки для purchase. Копійки. */
  valueMinor: z.number().int().nonnegative().nullable().default(null),
});
export type TrackEventDto = z.infer<typeof TrackEventDto>;

// ---------------------------------------------------------------------------
// Звіти
// ---------------------------------------------------------------------------

export const StatsRangeDto = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});
export type StatsRangeDto = z.infer<typeof StatsRangeDto>;

export const DailyPointDto = z.object({
  /** YYYY-MM-DD. */
  date: z.string(),
  views: z.number().int().nonnegative(),
  visits: z.number().int().nonnegative(),
  leads: z.number().int().nonnegative(),
});
export type DailyPointDto = z.infer<typeof DailyPointDto>;

export const SourceRowDto = z.object({
  /** «google / cpc / brand-korgi» або «прямі заходи». */
  label: z.string(),
  source: z.string(),
  medium: z.string(),
  campaign: z.string(),
  visits: z.number().int().nonnegative(),
  leads: z.number().int().nonnegative(),
  orders: z.number().int().nonnegative(),
  revenueMinor: z.number().int().nonnegative(),
});
export type SourceRowDto = z.infer<typeof SourceRowDto>;

export const PageRowDto = z.object({
  path: z.string(),
  views: z.number().int().nonnegative(),
});
export type PageRowDto = z.infer<typeof PageRowDto>;

export const AdminStatsDto = z.object({
  days: z.number().int().positive(),
  totals: z.object({
    views: z.number().int().nonnegative(),
    visits: z.number().int().nonnegative(),
    leads: z.number().int().nonnegative(),
    orders: z.number().int().nonnegative(),
    revenueMinor: z.number().int().nonnegative(),
    /** Заявки плюс замовлення на сто візитів, у сотих відсотка. */
    conversionHundredths: z.number().int().nonnegative(),
  }),
  daily: z.array(DailyPointDto),
  sources: z.array(SourceRowDto),
  pages: z.array(PageRowDto),
});
export type AdminStatsDto = z.infer<typeof AdminStatsDto>;

// ---------------------------------------------------------------------------
// Конверсії Google Ads
// ---------------------------------------------------------------------------

export const ConversionActionDto = z.object({
  id: z.string().uuid(),
  event: AnalyticsEventName,
  label: z.string(),
  sendValue: z.boolean(),
  isActive: z.boolean(),
});
export type ConversionActionDto = z.infer<typeof ConversionActionDto>;

export const ConversionActionCreateDto = z.object({
  event: AnalyticsEventName,
  /** Друга частина ідентифікатора: `AW-123456789/AbC-D_efG`. */
  label: z.string().trim().min(3).max(80),
  sendValue: z.boolean().default(false),
});
export type ConversionActionCreateDto = z.infer<typeof ConversionActionCreateDto>;

export const ConversionActionUpdateDto = z.object({
  label: z.string().trim().min(3).max(80).optional(),
  sendValue: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type ConversionActionUpdateDto = z.infer<typeof ConversionActionUpdateDto>;

/**
 * Що потрібно браузеру, щоб зарядити теги.
 *
 * Порожні ідентифікатори означають «не налаштовано» — і тоді жоден сторонній
 * скрипт не вантажиться взагалі. Це важливо: сайт без реклами не повинен
 * тягнути 90 кілобайт чужого коду просто тому, що модуль існує.
 */
export const TrackingConfigDto = z.object({
  ga4MeasurementId: z.string(),
  googleAdsId: z.string(),
  conversions: z.array(ConversionActionDto),
});
export type TrackingConfigDto = z.infer<typeof TrackingConfigDto>;
