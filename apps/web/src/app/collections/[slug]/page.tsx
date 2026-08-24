import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CollectionListDto, CollectionPageDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { PrintGrid, SectionHead } from '@/features/home/print-card';
import { plural } from '@/features/home/blocks';
import { serverFetch, serverFetchOrNull } from '@/lib/server-api';
import { breedItemListJsonLd, JsonLd } from '@/lib/json-ld';
import { site } from '@/config/site';

interface Params { params: { slug: string } }

const BASE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  const list = await serverFetchOrNull('/catalog/collections', CollectionListDto, 3600);
  return (list?.items ?? []).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await serverFetchOrNull(`/catalog/collections/${params.slug}`, CollectionPageDto);
  if (!data) return { title: 'Колекцію не знайдено' };

  const title = `${data.collection.title} — ${site.brand}`;
  const description = data.collection.description
    ?? `${data.collection.title}: принти з собаками на футболках, худі та світшотах.`;

  return {
    title,
    description,
    alternates: { canonical: `/collections/${params.slug}` },
    openGraph: {
      title, description, type: 'website',
      ...(data.prints[0] ? { images: [data.prints[0].previewUrl] } : {}),
    },
  };
}

export default async function CollectionPage({ params }: Params) {
  let data: CollectionPageDto;
  try {
    data = await serverFetch(`/catalog/collections/${params.slug}`, CollectionPageDto, 300);
  } catch {
    notFound();
  }

  const { collection, prints } = data;

  return (
    <PublicShell>
      {prints.length > 0 && <JsonLd data={breedItemListJsonLd(collection.title, prints, BASE)} />}

      <div className="mx-auto max-w-6xl px-6 py-12">
        <nav aria-label="Хлібні крихти" className="text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <Link href="/collections" className="hover:underline">Колекції</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">{collection.title}</span>
        </nav>

        <h1 className="mt-3 font-display text-hero font-bold text-ink">{collection.title}</h1>
        {collection.description && (
          <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-muted">{collection.description}</p>
        )}
        {prints.length > 0 && (
          <p className="mt-2 text-ink-subtle">
            {prints.length} {plural(prints.length, 'принт', 'принти', 'принтів')}
          </p>
        )}

        <div className="mt-10">
          {prints.length > 0 ? (
            <PrintGrid prints={prints} />
          ) : (
            <div className="rounded-card border border-dashed border-line-strong bg-surface-sunken p-8 text-center">
              <p className="font-medium text-ink">У цій колекції поки порожньо</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
                Ми її наповнюємо. Загляньте в інші або замовте принт із нуля.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link href="/collections" className="inline-flex min-h-11 items-center rounded-card border border-line px-5 text-sm font-medium text-ink">
                  Інші колекції
                </Link>
                <Link href="/svoya-ideya" className="inline-flex min-h-11 items-center rounded-card bg-ink px-5 text-sm font-semibold text-surface">
                  Свій принт
                </Link>
              </div>
            </div>
          )}
        </div>

        <section className="mt-16">
          <SectionHead title="Дивитись інакше" subtitle="Той самий каталог, згрупований по-іншому." />
          <div className="flex flex-wrap gap-3">
            <Link href="/collections" className="flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-medium text-ink hover:border-ink">
              Усі колекції
            </Link>
            <Link href="/prints" className="flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-medium text-ink hover:border-ink">
              Усі принти
            </Link>
            <Link href="/#породи" className="flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-medium text-ink hover:border-ink">
              За породами
            </Link>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
