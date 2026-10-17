import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { type BreedCardDto, BreedListDto, CollectionListDto, RangeDto, SearchResultDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { PrintGrid, SectionHead } from '@/features/home/print-card';
import { BreedStrip, CollectionStrip, plural } from '@/features/home/blocks';
import { LiveSearch } from '@/features/search/live-search';
import { SearchFilters, type FilterOption } from '@/features/search/search-filters';
import { serverFetchOrNull } from '@/lib/server-api';
import { getSettings } from '@/lib/site-settings';
import { ButtonLink } from '@/components/ui';
import { LIST } from '@/features/analytics/lists';
import { SearchTracker } from '@/features/analytics/SearchTracker';

/** Параметри фільтрів, які сторінка передає в API без змін. */
const FILTER_KEYS = ['breed', 'collection', 'garmentType', 'sizeTier', 'inStock', 'sort'] as const;

interface Search {
  searchParams?: Record<string, string | string[] | undefined>;
}

const GARMENT_LABELS: Record<string, string> = {
  TSHIRT: 'Футболка', SWEATSHIRT: 'Світшот', HOODIE: 'Худі',
  ZIP_HOODIE: 'Зіп-худі', JOGGERS: 'Джогери', TOTE_BAG: 'Шопер',
};

const GARMENT_ON: Record<string, string> = {
  TSHIRT: 'на футболках', SWEATSHIRT: 'на світшотах', HOODIE: 'на худі',
  ZIP_HOODIE: 'на зіп-худі', JOGGERS: 'на джогерах', TOTE_BAG: 'на шоперах',
};

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export async function generateMetadata({ searchParams }: Search): Promise<Metadata> {
  const site = await getSettings();
  const q = one(searchParams?.['q']).trim();
  return {
    title: q ? `Пошук: ${q} — ${site.brand}` : `Пошук — ${site.brand}`,
    // Сторінки результатів не мають бути в індексі: це дублі каталогу
    // під тисячею випадкових запитів.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: Search) {
  const q = one(searchParams?.['q']).trim();

  /*
   * Фільтри їдуть в API тим самим набором ключів, яким вони лежать в
   * адресі. Перекладати їх тут «з фронтових назв у бекендові» немає в що:
   * назва одна, описана в контракті, і будь-яке перейменування посередині
   * стало б місцем, де вони колись розійдуться.
   */
  const filters = new URLSearchParams();
  filters.set('q', q);
  let narrowed = false;
  for (const key of FILTER_KEYS) {
    const value = one(searchParams?.[key]);
    if (value === '') continue;
    filters.set(key, value);
    // `sort` міняє порядок, а не склад: він не може нічого відсіяти.
    if (key !== 'sort') narrowed = true;
  }

  const [data, breedList, collectionList, range] = await Promise.all([
    q.length >= 2
      ? serverFetchOrNull(`/catalog/search?${filters.toString()}`, SearchResultDto, 30)
      : Promise.resolve(null),
    serverFetchOrNull('/catalog/breeds', BreedListDto, 300),
    serverFetchOrNull('/catalog/collections', CollectionListDto, 300),
    serverFetchOrNull('/catalog/range', RangeDto, 300),
  ]);

  const breedOptions: FilterOption[] = (breedList?.items ?? [])
    .filter((b) => b.printCount > 0)
    .map((b) => ({ value: b.slug, label: b.name }));
  const collectionOptions: FilterOption[] = (collectionList?.items ?? [])
    .map((c) => ({ value: c.slug, label: c.title }));
  /*
   * Типи виробів беремо з асортименту, а не з переліку в коді: фільтр, який
   * пропонує «Джогери», коли джогерів не існує, — це обіцянка порожнього
   * результату.
   */
  const garmentOptions: FilterOption[] = [...new Set((range?.garments ?? []).map((g) => g.type))]
    .map((type) => ({ value: type, label: GARMENT_LABELS[type] ?? type }));

  /*
   * «Футболка», «собака» — це весь каталог: показуємо першу сторінку і
   * ведемо в каталог з уже обраним виробом, де є сортування й пагінація.
   */
  const printsTotal = data ? Math.max(data.printsTotal, data.prints.length) : 0;
  const explicitGarment = one(searchParams?.['garmentType']);
  const impliedGarment = explicitGarment === '' && data?.garmentTypes.length === 1 ? data.garmentTypes[0] : undefined;
  const catalogHref = (() => {
    const next = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const value = one(searchParams?.[key]);
      if (value !== '') next.set(key, value);
    }
    if (impliedGarment) next.set('garmentType', impliedGarment);
    const qs = next.toString();
    return qs === '' ? '/prints' : `/prints?${qs}`;
  })();
  const popularBreeds = (breedList?.items ?? []).filter((b) => b.printCount > 0).slice(0, 8);

  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-12">
        <h1 className="font-display text-3xl font-bold uppercase text-ink">
          {q ? <>Пошук: <span className="text-ink-muted">{q}</span></> : 'Пошук'}
        </h1>

        <div className="mt-6 max-w-xl">
          <Suspense fallback={null}>
            <LiveSearch initial={q} />
          </Suspense>
        </div>

        {q.length >= 2 && <SearchTracker term={q} />}

        {q.length > 0 && q.length < 2 && (
          <p className="mt-8 text-ink-muted">Введи хоча б дві літери.</p>
        )}

        {data && (
          <Suspense fallback={null}>
            <SearchFilters
              breeds={breedOptions}
              collections={collectionOptions}
              garmentTypes={garmentOptions}
              resultCount={printsTotal}
            />
          </Suspense>
        )}

        {/* Як зрозуміли запит: «худі з таксою» — це такса, і ціни за худі. */}
        {impliedGarment && printsTotal > 0 && (
          <p className="mt-4 text-sm text-ink-muted">
            Показуємо принти, які друкуємо {GARMENT_ON[impliedGarment] ?? impliedGarment}; ціни — саме за цей виріб.
          </p>
        )}

        {data && data.total === 0 && <NothingFound query={q} breeds={popularBreeds} />}

        {data && data.breeds.length > 0 && (
          <section className="mt-8 sm:mt-12">
            <SectionHead title="Породи" subtitle="Найімовірніше ви шукали саме це." />
            <BreedStrip breeds={data.breeds} />
          </section>
        )}

        {data && data.collections.length > 0 && (
          <section className="mt-8 sm:mt-12">
            <SectionHead title="Колекції" />
            <CollectionStrip collections={data.collections} />
          </section>
        )}

        {data && data.prints.length > 0 && (
          <section className="mt-8 sm:mt-12">
            <SectionHead
              title="Принти"
              subtitle={printsTotal > data.prints.length
                ? `Показано ${data.prints.length} з ${printsTotal}`
                : `${printsTotal} ${plural(printsTotal, 'принт', 'принти', 'принтів')}`}
            />
            <PrintGrid prints={data.prints} list={LIST.search} />
            {printsTotal > data.prints.length && (
              <div className="mt-8 text-center">
                <ButtonLink href={catalogHref} size="lg">
                  Усі {printsTotal} {plural(printsTotal, 'принт', 'принти', 'принтів')} у каталозі →
                </ButtonLink>
              </div>
            )}
          </section>
        )}

        {/*
          Окремий випадок: щось знайшлося, але фільтри це щось відсіяли.
          «Нічого не знайдено» тут було б неправдою — і найгіршою з можливих,
          бо людина не зрозуміла б, що варто просто зняти фільтр.

          Умова обовʼязково включає `narrowed`: без неї підказка «зніміть
          фільтр» зʼявлялася й тоді, коли жодного фільтра не стояло, а принтів
          за запитом просто немає. Порада, яку неможливо виконати, гірша за
          мовчання.
        */}
        {data && narrowed && data.total > 0 && data.prints.length === 0 && (
          <p className="mt-10 rounded-card border border-dashed border-line-strong bg-surface-sunken p-6 text-center text-sm text-ink-muted">
            За цим запитом принти є, але жоден не підходить під вибрані фільтри.
            Спробуй зняти котрийсь із них.
          </p>
        )}
      </div>
    </PublicShell>
  );
}

/**
 * Порожній результат — найчастіший момент, коли людина йде з сайту.
 *
 * Раніше тут була лише кнопка «Замовити свій принт» — довший і дорожчий
 * сценарій — замість 84 готових принтів (аудит 17.10, IA-2). Тепер спершу
 * готове: популярні породи й усі принти, і вже потім — намалювати своє.
 */
function NothingFound({ query, breeds }: { query: string; breeds: readonly BreedCardDto[] }) {
  return (
    <div className="mt-8 rounded-card border border-dashed border-line-strong bg-surface-sunken p-6 sm:p-8">
      <p className="font-medium text-ink">За запитом «{query}» нічого не знайшли</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
        Спробуй назву породи, наприклад «такса» чи «мопс», або подивись готові принти.
      </p>

      {breeds.length > 0 && (
        <nav aria-label="Популярні породи" className="mt-5">
          <p className="label-eyebrow">Популярні породи</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {breeds.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/breeds/${b.slug}`}
                  className="inline-flex min-h-11 items-center rounded-pill border border-line bg-surface px-4 text-sm font-medium text-ink hover:border-ink"
                >
                  {b.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/breeds"
                className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-ink underline"
              >
                Усі породи →
              </Link>
            </li>
          </ul>
        </nav>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/prints">
          Усі принти
        </ButtonLink>
        <ButtonLink href="/svoya-ideya" variant="quiet">
          Замовити свій принт
        </ButtonLink>
      </div>
    </div>
  );
}
