import { cache } from 'react';
import { SiteChromeDto, type MenuItemDto, type SiteSettingsDto } from '@dt/contracts';
import { site } from '@/config/site';
import { serverFetchOrNull } from './server-api';

/**
 * Реквізити й меню сайту — з бази, із запасним варіантом у коді.
 *
 * Запасний варіант тут не про акуратність, а про те, що буде, коли API
 * мовчить. Без нього сторінка або впаде, або надрукує порожній футер без
 * телефону — тобто сайт, який виглядає закритим. Краще показати вчорашні
 * контакти, ніж жодних.
 *
 * `cache` з React — на один запит: шапка, футер і метадані питають те саме,
 * і кожен запит по HTTP був би тричі за одну сторінку.
 */

export const FALLBACK_SETTINGS: SiteSettingsDto = {
  brand: site.brand,
  legalEntityName: site.legalEntityName,
  legalEntityShort: site.legalEntityShort,
  taxNumber: site.taxNumber,
  phone: site.phone,
  phoneDisplay: site.phoneDisplay,
  telegram: site.telegram,
  telegramUrl: site.telegramUrl,
  email: site.email,
  city: site.city,
  cityIn: site.cityIn,
  workingHours: site.workingHours,
  freeShippingFromMinor: site.freeShippingFromMinor,
  returnDays: site.returnDays,
  productionDaysMin: site.productionDaysMin,
  productionDaysMax: site.productionDaysMax,
  defaultOgImage: '',
  googleSiteVerification: '',
  ga4MeasurementId: '',
  googleAdsId: '',
  // У запасному варіанті індексація вимкнена свідомо: якщо API мовчить, ми
  // не знаємо, чи можна індексувати цей сайт, і мовчазне «можна» — гірша з
  // двох помилок.
  allowIndexing: false,
};

/**
 * Запасне меню повторює те, що вписує міграція.
 *
 * Порожнє меню при недоступному API — це сайт без навігації; це гірше, ніж
 * трохи застаріле меню.
 */
const FALLBACK_MENU: MenuItemDto[] = [
  ['Породи', '/breeds'], ['Колекції', '/collections'],
  ['Вироби', '/vyroby'], ['Свій принт', '/svoya-ideya'],
].map(([label, href], i) => ({
  id: `fallback-header-${i}`,
  area: 'HEADER' as const,
  group: '',
  label: label as string,
  href: href as string,
  position: i * 10,
  isActive: true,
}));

export const getChrome = cache(async (): Promise<SiteChromeDto> => {
  const data = await serverFetchOrNull('/content/site', SiteChromeDto, 300);
  return data ?? { settings: FALLBACK_SETTINGS, menu: FALLBACK_MENU };
});

export const getSettings = cache(async (): Promise<SiteSettingsDto> => (await getChrome()).settings);

/** «2 000 ₴» для текстів. */
export function freeShippingLabel(settings: SiteSettingsDto): string {
  return `${(settings.freeShippingFromMinor / 100).toLocaleString('uk-UA')} ₴`;
}
