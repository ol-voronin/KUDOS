import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CollectionListDto, BreedListDto, CollectionPageDto, PageListDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { ArticleGrid } from '@/features/articles/article-card';
import { PrintGrid, SectionHead } from '@/features/home/print-card';
import { BreedStrip } from '@/features/home/blocks';
import { plural } from '@/features/home/blocks';
import { serverFetch, serverFetchOrNull } from '@/lib/server-api';
import { breedItemListJsonLd, JsonLd } from '@/lib/json-ld';
import { getSettings } from '@/lib/site-settings';
import { ButtonLink } from '@/components/ui';
import { LIST } from '@/features/analytics/lists';

interface Params { params: { slug: string } }

const BASE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  const list = await serverFetchOrNull('/catalog/collections', CollectionListDto, 3600);
  return (list?.items ?? []).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const site = await getSettings();
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

  // Порожня колекція — не тупик: показуємо породи як робочий лістинг,
  // щоб людині було куди йти далі, а не просто «тут нічого немає».
  const articles = (await serverFetchOrNull(
    `/content/pages?kind=ARTICLE&collection=${params.slug}&limit=3`,
    PageListDto,
    300,
  ))?.items ?? [];

  const breeds = prints.length === 0
    ? (await serverFetchOrNull('/catalog/breeds', BreedListDto, 3600))?.items ?? []
    : [];

  return (
    <PublicShell>
      {prints.length > 0 && <JsonLd data={breedItemListJsonLd(collection.title, prints, BASE)} />}

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
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
            <PrintGrid prints={prints} list={LIST.collection} listId={collection.slug} />
          ) : (
            <div className="space-y-10">
              <div className="border-t border-ink pt-6">
                <h2 className="font-display text-xl font-bold text-ink">
                  Готових принтів у цій колекції ще немає
                </h2>
                <p className="mt-2 max-w-prose leading-relaxed text-ink-muted">
                  Але жанр робочий: надішліть фото свого пса — і намалюємо його саме в цьому
                  стилі. Ціну називаємо після того, як побачили ідею.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <ButtonLink href="/svoya-ideya" size="lg">Замовити в цьому стилі</ButtonLink>
                  <ButtonLink href="/collections" variant="outline" size="lg">Інші колекції</ButtonLink>
                </div>
              </div>

              {breeds.length > 0 && (
                <section>
                  <SectionHead
                    title="Або почніть з породи"
                    subtitle="Ті самі принти, згруповані інакше — за тим, хто в тебе вдома."
                  />
                  <BreedStrip breeds={breeds} />
                </section>
              )}
            </div>
          )}
        </div>

        {articles.length > 0 && (
          <section className="mt-16">
            <SectionHead title="Про цю колекцію" subtitle="Матеріали, привʼязані до неї в редакторі." />
            <ArticleGrid articles={articles} />
          </section>
        )}

        <section className="mt-16">
          <SectionHead title="Дивитись інакше" subtitle="Той самий каталог, згрупований по-іншому." />
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/collections" variant="quiet" size="sm">Усі колекції</ButtonLink>
            <ButtonLink href="/prints" variant="quiet" size="sm">Усі принти</ButtonLink>
            <ButtonLink href="/#породи" variant="quiet" size="sm">За породами</ButtonLink>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
