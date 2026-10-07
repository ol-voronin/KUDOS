import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/site-settings';
import { isPreviewDeploy } from '@/lib/deploy-env';

const BASE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

/**
 * robots.txt із налаштувань.
 *
 * Головне тут — вимикач `allowIndexing`. Поки він вимкнений, файл забороняє
 * все: сайт на *.vercel.app однаково не індексується, але як тільки зʼявиться
 * домен, індексація має вмикатися свідомо, а не сама собою разом із DNS.
 *
 * Карта сайту при забороні не публікується взагалі: віддавати карту сайту,
 * який заборонено обходити, — це суперечлива інструкція, і читають її
 * по-різному.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  // Превʼю бере налаштування з продового API, тож там allowIndexing теж
  // увімкнений. Тестова копія сайту в пошуку — дубль, який конкурує з
  // babaka.shop, тому превʼю забороняє все незалежно від налаштувань.
  if (isPreviewDeploy()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  const settings = await getSettings();

  if (!settings.allowIndexing) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Адмінка — очевидно. `/order/*` менш очевидно: це сторінка статусу
      // конкретного замовлення, і їй нема чого робити в індексі.
      disallow: ['/admin', '/admin/', '/order/'],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
