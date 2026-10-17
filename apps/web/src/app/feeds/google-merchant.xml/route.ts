import { BreedListDto, CollectionListDto, PrintOfferDto, SitemapDto } from '@dt/contracts';
import { buildFeedItems, renderFeedXml } from '@/features/merchant-feed/feed';
import { serverFetch } from '@/lib/server-api';
import { getSettings } from '@/lib/site-settings';

const BASE = (process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000').replace(/\/$/, '');

/** 6 годин. Google забирає фід раз на добу; частіше перебудовувати нема чого. */
const TTL_SECONDS = 6 * 60 * 60;

/**
 * Скільки принтів можна втратити при збиранні, перш ніж віддати помилку.
 * Фід без половини товарів гірший за відсутній: Google сприйме зниклі
 * позиції як зняті з продажу. А на 503 він просто спробує пізніше, і
 * вчорашні товари лишаться.
 */
const MAX_FAILED_SHARE = 0.1;

/**
 * Товарний фід Google Merchant Center: https://babaka.shop/feeds/google-merchant.xml
 *
 * Динамічний маршрут, а кеш — на CDN (`s-maxage`), не ISR. Різниця
 * важлива: статичний маршрут Next збирав би фід під час білду, і недоступний
 * у ту хвилину API або валив би деплой, або назавжди клав у кеш порожній
 * фід. Тут невдача — це 503 без кешу, а вдала відповідь живе на CDN 6 годин
 * (і ще добу віддається застарілою, поки збирається нова), тож база й Blob
 * бачать фід кілька разів на добу, а не на кожен запит.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [sitemap, collections, breeds, settings] = await Promise.all([
      serverFetch('/catalog/sitemap', SitemapDto, TTL_SECONDS),
      serverFetch('/catalog/collections', CollectionListDto, TTL_SECONDS),
      serverFetch('/catalog/breeds', BreedListDto, TTL_SECONDS),
      getSettings(),
    ]);

    const slugs = sitemap.prints.map((p) => p.slug);
    const offers = await mapLimited(slugs, 8, (slug) =>
      serverFetch(`/catalog/prints/${slug}`, PrintOfferDto, TTL_SECONDS).catch(() => null));
    const ok = offers.filter((o): o is PrintOfferDto => o !== null);
    if (slugs.length === 0 || (slugs.length - ok.length) / slugs.length > MAX_FAILED_SHARE) {
      throw new Error(`зібрано ${ok.length} з ${slugs.length} принтів`);
    }

    const items = buildFeedItems(ok, {
      baseUrl: BASE,
      brand: settings.brand,
      cityIn: settings.cityIn,
      collections: new Map(collections.items.map((c) => [c.slug, c.title])),
      breeds: new Map(breeds.items.map((b) => [b.slug, b.name])),
    });

    const xml = renderFeedXml(items, {
      title: `${settings.brand} — товари`,
      link: `${BASE}/`,
      description: `Одяг з принтами собак. Друкуємо ${settings.cityIn}.`,
    });

    return new Response(xml, {
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': `public, max-age=0, s-maxage=${TTL_SECONDS}, stale-while-revalidate=86400`,
        'x-feed-items': String(items.length),
      },
    });
  } catch (error) {
    console.error('[google-merchant feed]', error);
    return new Response('Фід тимчасово недоступний', {
      status: 503,
      headers: { 'cache-control': 'no-store', 'retry-after': '3600' },
    });
  }
}

/** `Promise.all` з обмеженням одночасних запитів: 84 запити разом API не потрібні. */
async function mapLimited<T, R>(input: readonly T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(input.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < input.length) {
      const i = next;
      next += 1;
      out[i] = await fn(input[i] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, input.length) }, worker));
  return out;
}
