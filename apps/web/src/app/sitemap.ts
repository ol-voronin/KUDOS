import type { MetadataRoute } from 'next';
import { SitemapDto } from '@dt/contracts';
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
  const data = await serverFetchOrNull('/catalog/sitemap', SitemapDto, 3600);

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/prints`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/collections`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/svoya-ideya`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/spivpratsia`, changeFrequency: 'monthly', priority: 0.7 },
    // Оферта індексується свідомо: Monobank при підключенні еквайрингу
    // перевіряє, що вона опублікована й доступна ззовні.
    { url: `${BASE}/oferta`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/pryvatnist`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/zayavka`, changeFrequency: 'monthly', priority: 0.6 },
  ];

  if (!data) return staticPages;

  return [
    ...staticPages,
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
