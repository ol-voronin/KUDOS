import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintOfferDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { PrintOfferView } from '@/features/catalog/components/PrintOfferView';
import { serverFetch, serverFetchOrNull } from '@/lib/server-api';
import { site } from '@/config/site';

interface Params { params: { slug: string } }

export const revalidate = 60;

/**
 * Раніше тут стояло `{ title: params.slug }` — тобто заголовком сторінки
 * принта з коргі був рядок `korhi-renesans`. Для сторінки, яку має знайти
 * пошук, це найдешевша з можливих помилок і найдорожча за наслідками.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const offer = await serverFetchOrNull(`/catalog/prints/${params.slug}`, PrintOfferDto);
  if (!offer) return { title: 'Принт не знайдено' };

  const title = `${offer.print.title} — принт на футболці й худі | ${site.brand}`;
  const description = `${offer.print.title}: друк на футболці, худі або світшоті. Друкуємо ${site.cityIn}, шиємо самі.`;

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

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <nav aria-label="Хлібні крихти" className="mb-6 text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">{offer.print.title}</span>
        </nav>
        <PrintOfferView slug={params.slug} initialData={offer} />
      </div>
    </PublicShell>
  );
}
