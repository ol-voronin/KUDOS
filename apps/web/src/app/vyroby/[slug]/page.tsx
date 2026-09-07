import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GarmentOfferDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { GarmentOfferView } from '@/features/catalog/components/GarmentOfferView';
import { serverFetch, serverFetchOrNull } from '@/lib/server-api';
import { breadcrumbJsonLd, JsonLd, productJsonLd } from '@/lib/json-ld';
import { getSettings } from '@/lib/site-settings';

const BASE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

interface Params { params: { slug: string } }

export const revalidate = 60;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const site = await getSettings();
  const offer = await serverFetchOrNull(`/catalog/garments/${params.slug}`, GarmentOfferDto);
  if (!offer) return { title: 'Виріб не знайдено' };

  const title = `${offer.garment.name} без принта — базовий одяг | ${site.brand}`;
  const description = `${offer.garment.name}: базовий одяг без принта. `
    + `${offer.garment.fabrics[0]?.composition ?? ''}. Шиємо ${site.cityIn}, доставка по Україні.`;

  return {
    title,
    description,
    alternates: { canonical: `/vyroby/${params.slug}` },
    openGraph: { title, description, type: 'website' },
  };
}

/**
 * Сторінка покупки порожнього виробу.
 *
 * Прохання Даші: базовий одяг має купуватися сам по собі, а не лише як
 * носій принта. Дані ті самі, що бачить картка принта, — мінус принт.
 */
export default async function GarmentPage({ params }: Params) {
  let offer: GarmentOfferDto;
  try {
    offer = await serverFetch(`/catalog/garments/${params.slug}`, GarmentOfferDto, 60);
  } catch {
    notFound();
  }

  const site = await getSettings();

  const totals = offer.variants.map((v) => v.priceMinor);
  const inStock = offer.variants.some((v) => v.availability === 'IN_STOCK');

  return (
    <PublicShell>
      {totals.length > 0 && (
        <JsonLd data={productJsonLd({
          name: `${offer.garment.name} без принта`,
          description: `${offer.garment.name}: базовий одяг без принта. Шиємо ${site.cityIn}.`,
          images: [],
          url: `${BASE}/vyroby/${params.slug}`,
          lowPriceMinor: Math.min(...totals),
          highPriceMinor: Math.max(...totals),
          inStock,
          offerCount: totals.length,
        }, BASE, site)} />
      )}
      <JsonLd data={breadcrumbJsonLd([
        { name: 'Головна', url: `${BASE}/` },
        { name: 'Базовий одяг', url: `${BASE}/vyroby` },
        { name: offer.garment.name, url: `${BASE}/vyroby/${params.slug}` },
      ])} />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
        <nav aria-label="Хлібні крихти" className="mb-6 text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <Link href="/vyroby" className="hover:underline">Базовий одяг</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">{offer.garment.name}</span>
        </nav>
        <GarmentOfferView slug={params.slug} initialData={offer} />
      </div>
    </PublicShell>
  );
}
