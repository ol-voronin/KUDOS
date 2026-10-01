import Link from 'next/link';
import { formatUAH, minor, PrintListDto, type PrintCardDto, type RangeGarmentDto } from '@dt/contracts';
import { PrintGrid, SectionHead } from '@/features/home/print-card';
import { serverFetchOrNull } from '@/lib/server-api';
import { garmentCardPhoto } from '../garment-photos';
import { LIST } from '@/features/analytics/lists';

/**
 * «Вам також може сподобатись» — рейка з чотирьох карток унизу картки товару.
 *
 * Це не рекомендаційний движок, і чесно ним не прикидається. Порядок
 * (відгук 01.10): спершу інші принти з тією самою породою — людина прийшла
 * зі своїм псом; не вистачило — сусіди по колекції; і лише потім свіжі з
 * каталогу. Рахує сервер разом зі сторінкою — жодного запиту з браузера.
 */
export async function RelatedPrints({ excludeSlug, breedSlugs = [], collectionSlug }: {
  excludeSlug: string;
  breedSlugs?: readonly string[];
  collectionSlug?: string;
}) {
  const filters = [
    ...breedSlugs.map((slug) => `&breed=${encodeURIComponent(slug)}`),
    ...(collectionSlug !== undefined ? [`&collection=${encodeURIComponent(collectionSlug)}`] : []),
    '',
  ];
  const items: PrintCardDto[] = [];
  const seen = new Set<string>([excludeSlug]);
  for (const filter of filters) {
    if (items.length >= 4) break;
    const list = await serverFetchOrNull(`/catalog/prints?page=1&perPage=8${filter}`, PrintListDto, 300);
    for (const p of list?.items ?? []) {
      if (!seen.has(p.slug)) { items.push(p); seen.add(p.slug); }
    }
  }

  const four = items.slice(0, 4);
  if (four.length === 0) return null;

  return (
    <section className="mt-16" aria-label="Схожі принти">
      <SectionHead title="Вам також" ghost="може сподобатись" href="/prints" hrefLabel="Весь каталог" />
      <PrintGrid prints={four} list={LIST.related} />
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
