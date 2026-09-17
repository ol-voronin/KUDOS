import Link from 'next/link';
import { formatUAH, minor, PrintListDto, type RangeGarmentDto } from '@dt/contracts';
import { PrintGrid, SectionHead } from '@/features/home/print-card';
import { serverFetchOrNull } from '@/lib/server-api';
import { garmentCardPhoto } from '../garment-photos';

/**
 * «Вам також може сподобатись» — рейка з чотирьох карток унизу картки товару.
 *
 * Це не рекомендаційний движок, і чесно ним не прикидається: для принта —
 * сусіди по колекції (той самий жанр, який людину вже зачепив), добиті
 * свіжими з каталогу; для базової речі — решта асортименту. Рахує сервер
 * разом зі сторінкою — жодного другого запиту з браузера.
 */
export async function RelatedPrints({ excludeSlug, collectionSlug }: {
  excludeSlug: string;
  collectionSlug?: string;
}) {
  const filter = collectionSlug !== undefined ? `&collection=${collectionSlug}` : '';
  const list = await serverFetchOrNull(`/catalog/prints?page=1&perPage=8${filter}`, PrintListDto, 300);
  const items = (list?.items ?? []).filter((p) => p.slug !== excludeSlug);

  // Колекція мала — добиваємо картки з загального каталогу, без дублів.
  if (items.length < 4 && collectionSlug !== undefined) {
    const extra = await serverFetchOrNull('/catalog/prints?page=1&perPage=8', PrintListDto, 300);
    const seen = new Set(items.map((p) => p.slug));
    seen.add(excludeSlug);
    for (const p of extra?.items ?? []) {
      if (!seen.has(p.slug)) { items.push(p); seen.add(p.slug); }
    }
  }

  const four = items.slice(0, 4);
  if (four.length === 0) return null;

  return (
    <section className="mt-16" aria-label="Схожі принти">
      <SectionHead title="Вам також" ghost="може сподобатись" href="/prints" hrefLabel="Весь каталог" />
      <PrintGrid prints={four} />
    </section>
  );
}

/**
 * Той самий блок на сторінці базової речі: решта виробів.
 *
 * Картки навмисно менші за RangeCard з вітрини — тут це «а ще у нас є»,
 * а не повна довідка з тканинами й розмірними сітками.
 */
export function RelatedGarments({ garments, excludeSlug }: {
  garments: readonly RangeGarmentDto[];
  excludeSlug: string;
}) {
  const four = garments.filter((g) => g.slug !== excludeSlug).slice(0, 4);
  if (four.length === 0) return null;

  return (
    <section className="mt-16" aria-label="Інші вироби">
      <SectionHead title="Вам також" ghost="може сподобатись" href="/vyroby" hrefLabel="Весь базовий одяг" />
      <div
        className={[
          'grid grid-cols-2 border-t border-line lg:grid-cols-4',
          '[&>*]:border-b [&>*]:border-r [&>*]:border-line',
          '[&>*:nth-child(2n)]:border-r-0 lg:[&>*:nth-child(2n)]:border-r lg:[&>*:nth-child(4n)]:border-r-0',
        ].join(' ')}
      >
        {four.map((g) => {
          const photo = g.colours
            .map((c) => garmentCardPhoto(g.slug, c.supplierCode))
            .find((src) => src !== null) ?? null;
          return (
            <Link
              key={g.id}
              href={`/vyroby/${g.slug}`}
              className="group flex flex-col px-3 pb-5 pt-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              <div className="relative overflow-hidden bg-surface-sunken">
                <div className="transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none">
                  {photo !== null ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt={g.name} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center text-sm text-ink-subtle">
                      Фото готуємо
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-3 border-t border-ink pt-2 text-sm font-medium text-ink transition-opacity duration-200 group-hover:opacity-60">
                {g.name}
              </p>
              <p className="mt-1 font-display text-lg font-bold text-ink">
                {formatUAH(minor(g.basePriceMinor))}
                <span className="ml-1.5 text-sm font-normal text-ink-subtle">без принта</span>
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
