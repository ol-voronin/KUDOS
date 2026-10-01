import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintOfferDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { PrintOfferView } from '@/features/catalog/components/PrintOfferView';
import { RelatedPrints } from '@/features/catalog/components/RelatedRail';
import { serverFetch, serverFetchOrNull } from '@/lib/server-api';
import { breadcrumbJsonLd, JsonLd, productJsonLd } from '@/lib/json-ld';
import { getSettings } from '@/lib/site-settings';

const BASE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

interface Params { params: { slug: string } }

export const revalidate = 60;

/**
 * Раніше тут стояло `{ title: params.slug }` — тобто заголовком сторінки
 * принта з коргі був рядок `korhi-renesans`. Для сторінки, яку має знайти
 * пошук, це найдешевша з можливих помилок і найдорожча за наслідками.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const site = await getSettings();
  const offer = await serverFetchOrNull(`/catalog/prints/${params.slug}`, PrintOfferDto);
  if (!offer) return { title: 'Принт не знайдено' };

  const title = `${offer.print.title} — принт на футболці й худі | ${site.brand}`;
  const description = `${offer.print.title}: друк на футболці, худі або світшоті. Друкуємо ${site.cityIn}, виготовляємо самі.`;

  return {
    title,
    description,
    alternates: { canonical: `/prints/${params.slug}` },
    openGraph: { title, description, type: 'website', images: [offer.print.previewUrl] },
  };
}

/**
 * Картка товару. Дані тягне сервер і віддає готовими в HTML; клієнтським
 * лишається лише вибір виробу, кольору й розміру.
 */
export default async function PrintPage({ params }: Params) {
  let offer: PrintOfferDto;
  try {
    offer = await serverFetch(`/catalog/prints/${params.slug}`, PrintOfferDto, 60);
  } catch {
    notFound();
  }

  const site = await getSettings();

  // Ціни рахує сервер і кладе на кожен варіант; тут лишається взяти межі.
  // Складати «база + друк» руками означало б третю реалізацію ціни — після
  // вітрини й каси.
  const totals = offer.variants.map((v) => v.priceMinor + offer.printPriceMinor);
  const inStock = offer.variants.some((v) => v.availability === 'IN_STOCK');

  return (
    <PublicShell>
      {totals.length > 0 && (
        <JsonLd data={productJsonLd({
          name: offer.print.title,
          description: `${offer.print.title}: друк на футболці, худі або світшоті. Друкуємо ${site.cityIn}.`,
          images: offer.images.map((i) => i.url),
          url: `${BASE}/prints/${params.slug}`,
          lowPriceMinor: Math.min(...totals),
          highPriceMinor: Math.max(...totals),
          inStock,
          offerCount: totals.length,
        }, BASE, site)} />
      )}
      <JsonLd data={breadcrumbJsonLd([
        { name: 'Головна', url: `${BASE}/` },
        { name: 'Принти', url: `${BASE}/prints` },
        { name: offer.print.title, url: `${BASE}/prints/${params.slug}` },
      ])} />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
        {/*
          Середній рівень у крихтах обовʼязковий: без «Каталогу» з картки
          товару немає шляху на щабель угору — тільки на головну або назад
          кнопкою браузера. Людина, що прийшла з пошуку чи реклами, іншого
          входу в каталог на цій сторінці не має. JSON-LD цей рівень уже
          оголошував — видима навігація просто розходилася з ним.
        */}
        <nav aria-label="Хлібні крихти" className="mb-6 text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <Link href="/prints" className="hover:underline">Каталог</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">{offer.print.title}</span>
        </nav>
        <PrintOfferView slug={params.slug} initialData={offer} />
        <RelatedPrints
          excludeSlug={params.slug}
          breedSlugs={offer.print.breedSlugs}
          collectionSlug={offer.print.collectionSlugs[0]}
        />
      </div>
    </PublicShell>
  );
}
