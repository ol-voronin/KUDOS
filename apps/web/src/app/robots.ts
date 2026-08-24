import type { MetadataRoute } from 'next';

const BASE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
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
