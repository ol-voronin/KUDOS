import { z } from 'zod';

/**
 * Налаштування сайту й меню.
 *
 * Ці ж значення підставляються в тексти блоків через `{{brand}}`, `{{email}}`,
 * `{{cityIn}}`. Тому вони й живуть в одному місці: реквізити ФОП в офері та
 * у футері, набрані руками двічі, розходяться не одразу, а тоді, коли
 * зміниться телефон і хтось згадає про футер, але не про пункт 1.2 договору.
 */

const ShortText = z.string().max(200);

/** Внутрішня адреса, якір або повна зовнішня. Те саме перевіряє CHECK у базі. */
const MenuHref = z.string().min(1).max(500).regex(
  /^(\/|#|https?:\/\/|mailto:|tel:)/,
  'адреса має починатися з /, #, http(s)://, mailto: або tel:',
);

export const MenuArea = z.enum(['HEADER', 'FOOTER']);
export type MenuArea = z.infer<typeof MenuArea>;

export const MenuItemDto = z.object({
  id: z.string().uuid(),
  area: MenuArea,
  /** Колонка футера. У шапці порожній рядок. */
  group: ShortText,
  label: z.string().min(1).max(80),
  href: MenuHref,
  position: z.number().int(),
  isActive: z.boolean(),
});
export type MenuItemDto = z.infer<typeof MenuItemDto>;

/**
 * Те, що потрібно публічним сторінкам.
 *
 * Вужче за адмінське: усе, що тут є, доступне будь-кому — і має бути таким.
 * Окремий тип, а не «той самий, тільки не всі поля», щоб нове службове поле
 * не поїхало на сайт саме собою.
 */
export const SiteSettingsDto = z.object({
  brand: z.string().min(1).max(80),
  legalEntityName: ShortText,
  legalEntityShort: ShortText,
  taxNumber: ShortText,
  phone: ShortText,
  phoneDisplay: ShortText,
  telegram: ShortText,
  /**
   * Мусить бути повною адресою або порожнім рядком.
   *
   * Це не косметика: значення підставляється в `href` блоків через
   * `{{telegramUrl}}`, тож `javascript:` тут став би робочим посиланням на
   * сайті. Перевірка стоїть саме на вході, де значення й зʼявляється.
   */
  telegramUrl: z.string().max(200).refine(
    (v) => v === '' || /^https?:\/\//.test(v),
    { message: 'адреса Telegram має починатися з https://' },
  ),
  email: ShortText,
  city: ShortText,
  cityIn: ShortText,
  workingHours: ShortText,
  freeShippingFromMinor: z.number().int().nonnegative(),
  returnDays: z.number().int().min(0).max(365),
});
export type SiteSettingsDto = z.infer<typeof SiteSettingsDto>;

/** Один запит на все, що потрібно оболонці сайту: реквізити плюс меню. */
export const SiteChromeDto = z.object({
  settings: SiteSettingsDto,
  menu: z.array(MenuItemDto),
});
export type SiteChromeDto = z.infer<typeof SiteChromeDto>;

export const SiteSettingsUpdateDto = SiteSettingsDto.partial();
export type SiteSettingsUpdateDto = z.infer<typeof SiteSettingsUpdateDto>;

export const MenuItemCreateDto = z.object({
  area: MenuArea,
  group: ShortText.default(''),
  label: z.string().min(1).max(80),
  href: MenuHref,
  position: z.number().int().min(0).max(999).default(0),
});
export type MenuItemCreateDto = z.infer<typeof MenuItemCreateDto>;

export const MenuItemUpdateDto = z.object({
  group: ShortText.optional(),
  label: z.string().min(1).max(80).optional(),
  href: MenuHref.optional(),
  position: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
});
export type MenuItemUpdateDto = z.infer<typeof MenuItemUpdateDto>;

export const AdminSiteChromeDto = z.object({
  settings: SiteSettingsDto,
  menu: z.array(MenuItemDto),
});
export type AdminSiteChromeDto = z.infer<typeof AdminSiteChromeDto>;

/**
 * Значення підстановок із налаштувань.
 *
 * Живе в контрактах, а не у вебі, бо підстановку робить API: сторінка
 * приїжджає на сайт уже з реальним телефоном, а не з `{{phone}}`. Через це
 * у браузері немає ані таблиці токенів, ані другої копії реквізитів.
 */
export function tokenValues(s: SiteSettingsDto): Readonly<Record<string, string>> {
  return {
    brand: s.brand,
    email: s.email,
    phone: s.phoneDisplay !== '' ? s.phoneDisplay : s.phone,
    telegram: s.telegram,
    telegramUrl: s.telegramUrl,
    city: s.city,
    cityIn: s.cityIn,
    legalEntity: s.legalEntityName,
    legalEntityShort: s.legalEntityShort,
    taxNumber: s.taxNumber,
    returnDays: String(s.returnDays),
    freeShippingFrom: String(Math.round(s.freeShippingFromMinor / 100)),
  };
}

/** Невідома підстановка лишається як є — щоб помилку було видно, а не зʼїдено. */
export function substituteTokens(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => values[key] ?? whole);
}
