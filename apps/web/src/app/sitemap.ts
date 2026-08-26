import type { MetadataRoute } from 'next';
import { PageListDto, SitemapDto } from '@dt/contracts';
import { serverFetchOrNull } from '@/lib/server-api';

const BASE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

/**
 * Карта сайту з бази, а не з переліку в коді.
 *
 * Кожен новий принт і кожна нова порода зʼявляються тут самі, щойно їх
 * опублікували в адмінці. Список, який треба оновлювати руками, застаріває
 * рівно на другому принті.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [data, pages] = await Promise.all([
    serverFetchOrNull('/catalog/sitemap', SitemapDto, 3600),
    serverFetchOrNull('/content/pages', PageListDto, 3600),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/prints`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/collections`, changeFrequency: 'weekly', priority: 0.8 },
    // «футболка оверсайз жіноча», «худі 350 розмірна сітка» — це запити з
    // наміром купити, і вони не про принт. Сторінка асортименту єдина на них
    // відповідає, тож у карті вона стоїть нарівні з каталогом.
    { url: `${BASE}/vyroby`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/zayavka`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/statti`, changeFrequency: 'weekly', priority: 0.7 },
  ];

  /**
   * Сторінки з CMS. Раніше цей перелік був списком у коді, і кожна нова
   * сторінка мовчки лишалася поза картою сайту, доки хтось не згадає.
   *
   * Оферта потрапляє сюди свідомо: Monobank при підключенні еквайрингу
   * перевіряє, що вона опублікована й доступна ззовні.
   */
  const contentPages: MetadataRoute.Sitemap = (pages?.items ?? [])
    // Головна вже стоїть у списку вище під адресою `/`. Її ж slug `home`
    // дав би другий рядок на ту саму сторінку.
    .filter((p) => p.slug !== 'home')
    .map((p) => ({
      // Матеріал живе під /statti — і в карті сайту має стояти саме та
      // адреса, на яку веде сайт. Адреса, з якої йде 301, у карті — це
      // прямий сигнал пошуку, що карту ніхто не перевіряв.
      url: p.kind === 'ARTICLE' ? `${BASE}/statti/${p.slug}` : `${BASE}/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: p.kind === 'ARTICLE' ? ('monthly' as const) : ('yearly' as const),
      priority: p.kind === 'ARTICLE' ? 0.7 : 0.5,
    }));

  if (!data) return [...staticPages, ...contentPages];

  return [
    ...staticPages,
    ...contentPages,
    // Породні — головний вхід із пошуку, тому пріоритет вищий за картки.
    ...data.breeds.map((b) => ({
      url: `${BASE}/breeds/${b.slug}`, lastModified: b.updatedAt,
      changeFrequency: 'weekly' as const, priority: 0.8,
    })),
    ...data.collections.map((c) => ({
      url: `${BASE}/collections/${c.slug}`, lastModified: c.updatedAt,
      changeFrequency: 'weekly' as const, priority: 0.7,
    })),
    ...data.prints.map((p) => ({
      url: `${BASE}/prints/${p.slug}`, lastModified: p.updatedAt,
      changeFrequency: 'monthly' as const, priority: 0.6,
    })),
  ];
}
