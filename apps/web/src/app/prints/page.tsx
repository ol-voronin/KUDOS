import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { BreedListDto, CollectionListDto, PrintListDto, RangeDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { PrintGrid } from '@/features/home/print-card';
import { plural } from '@/features/home/blocks';
import { SearchFilters, type FilterOption } from '@/features/search/search-filters';
import { serverFetchOrNull } from '@/lib/server-api';
import { getSettings } from '@/lib/site-settings';
import { ButtonLink, EmptyState } from '@/components/ui';
import { LIST } from '@/features/analytics/lists';

/** Ті самі ключі, що й на сторінці пошуку: фільтр один на весь сайт. */
const FILTER_KEYS = ['breed', 'collection', 'garmentType', 'sizeTier', 'inStock', 'sort'] as const;

const GARMENT_LABELS: Record<string, string> = {
  TSHIRT: 'Футболка', SWEATSHIRT: 'Світшот', HOODIE: 'Худі',
  ZIP_HOODIE: 'Зіп-худі', JOGGERS: 'Джогери', TOTE_BAG: 'Шопер',
};

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  return {
    title: `Усі принти — ${site.brand}`,
    description: `Каталог принтів із собаками на футболках, худі та світшотах. Друкуємо ${site.cityIn}.`,
    alternates: { canonical: '/prints' },
  
  };
}

const PER_PAGE = 24;

interface Search { searchParams?: Record<string, string | string[] | undefined> }

export default async function PrintsPage({ searchParams }: Search) {
  const page = Math.max(1, Number(one(searchParams?.['page']) || '1') || 1);

  const query = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) });
  for (const key of FILTER_KEYS) {
    const value = one(searchParams?.[key]);
    if (value !== '') query.set(key, value);
  }

  const [data, breedList, collectionList, range] = await Promise.all([
    serverFetchOrNull(`/catalog/prints?${query.toString()}`, PrintListDto),
    serverFetchOrNull('/catalog/breeds', BreedListDto, 300),
    serverFetchOrNull('/catalog/collections', CollectionListDto, 300),
    serverFetchOrNull('/catalog/range', RangeDto, 300),
  ]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  const breedOptions: FilterOption[] = (breedList?.items ?? [])
    .filter((b) => b.printCount > 0)
    .map((b) => ({ value: b.slug, label: b.name }));
  const collectionOptions: FilterOption[] = (collectionList?.items ?? [])
    .map((c) => ({ value: c.slug, label: c.title }));
  const garmentOptions: FilterOption[] = [...new Set((range?.garments ?? []).map((g) => g.type))]
    .map((type) => ({ value: type, label: GARMENT_LABELS[type] ?? type }));

  /* Сторінка гортається В МЕЖАХ фільтра: інакше «далі» скидає вибір. */
  const pageHref = (n: number): string => {
    const next = new URLSearchParams(query);
    next.delete('perPage');
    next.set('page', String(n));
    return `/prints?${next.toString()}`;
  };

  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <nav aria-label="Хлібні крихти" className="text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">Усі принти</span>
        </nav>

        <h1 className="mt-3 font-display text-hero font-bold text-ink">Усі принти</h1>
        {data && data.total > 0 && (
          <p className="mt-3 text-lg text-ink-muted">
            {data.total} {plural(data.total, 'принт', 'принти', 'принтів')} у каталозі
          </p>
        )}

        <Suspense fallback={null}>
          <SearchFilters
            breeds={breedOptions}
            collections={collectionOptions}
            garmentTypes={garmentOptions}
            resultCount={data?.total ?? 0}
          />
        </Suspense>

        <div className="mt-10">
          {data && data.items.length > 0 ? (
            <PrintGrid prints={data.items} list={LIST.catalog} />
          ) : (
            <EmptyState
              title="Каталог ще наповнюється"
              hint="Поки що працюємо під замовлення — намалюємо принт із фото твоєї собаки."
              action={<ButtonLink href="/svoya-ideya">Замовити свій принт</ButtonLink>}
            />
          )}
        </div>

        {/* Пагінація посиланнями, а не кнопками: сторінки мають індексуватись. */}
        {pages > 1 && (
          <nav aria-label="Сторінки каталогу" className="mt-10 flex items-center justify-between text-sm">
            {page > 1 ? (
              <ButtonLink href={pageHref(page - 1)} variant="quiet">
                ← Назад
              </ButtonLink>
            ) : <span />}
            <span className="text-ink-muted">Сторінка {page} з {pages}</span>
            {page < pages ? (
              <ButtonLink href={pageHref(page + 1)} variant="quiet">
                Далі →
              </ButtonLink>
            ) : <span />}
          </nav>
        )}
      </div>
    </PublicShell>
  );
}
