import type { MetadataRoute } from 'next';
import { PageListDto, SitemapDto } from '@dt/contracts';
import { serverFetchOrNull } from '@/lib/server-api';
import { buildSitemap } from '@/lib/sitemap-entries';

const BASE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

/**
 * Карта сайту з бази, а не з переліку в коді.
 *
 * Кожен новий принт і кожна нова порода зʼявляються тут самі, щойно їх
 * опублікували в адмінці. Список, який треба оновлювати руками, застаріває
 * рівно на другому принті. Що саме потрапляє в карту і з якими датами —
 * `buildSitemap` (там же тест).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [data, pages] = await Promise.all([
    serverFetchOrNull('/catalog/sitemap', SitemapDto, 3600),
    serverFetchOrNull('/content/pages', PageListDto, 3600),
  ]);
  return buildSitemap(BASE, data, pages);
}
