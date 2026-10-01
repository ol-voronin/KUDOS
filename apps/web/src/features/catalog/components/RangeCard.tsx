import Link from 'next/link';
import { formatUAH, minor, type RangeGarmentDto } from '@dt/contracts';
import { garmentCardPhoto } from '../garment-photos';

/**
 * Виріб у вітрині асортименту — коротка картка.
 *
 * Раніше тут жила вся довідка одразу: перемикач кольорів, склад, щільність,
 * розмірна сітка. Сторінка від цього перетворювалась на сім розгорнутих
 * паспортів, крізь які треба прогортати, щоб дістатися сьомого виробу.
 *
 * Тепер картка відповідає рівно на те, з чим на цю сторінку приходять: як
 * воно виглядає, скільки коштує, у скількох кольорах буває і які є розміри.
 * Решта — за клацанням, на сторінці виробу, де для неї є місце.
 *
 * Кадр свідомо світлий (білий або слонова кістка): вітрина порівнює крої,
 * а не відтінки, і сім різних кольорів у ряд заважали б це робити.
 */

/** Порядок, у якому шукаємо «нейтральний» кадр для вітрини. */
const NEUTRAL = ['bilyi', 'slonova-kistka', 'mokryi-pisok'];

/** Українська множина: 1 колір, 2 кольори, 5 кольорів. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = n % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function cardPhoto(garment: RangeGarmentDto): { src: string; colourName: string } | null {
  const ordered = [
    ...NEUTRAL.map((code) => garment.colours.find((c) => c.supplierCode === code)),
    ...garment.colours,
  ];
  for (const colour of ordered) {
    if (!colour) continue;
    const src = garmentCardPhoto(garment.slug, colour.supplierCode);
    if (src !== null) return { src, colourName: colour.name ?? colour.supplierCode };
  }
  return null;
}

export function RangeCard({ garment }: { garment: RangeGarmentDto }) {
  const photo = cardPhoto(garment);
  const sizes = garment.sizes;
  const first = sizes[0]?.label;
  const last = sizes[sizes.length - 1]?.label;
  const sizeRange = first === undefined ? null : first === last ? first : `${first}–${last}`;

  return (
    <Link
      href={`/vyroby/${garment.slug}`}
      className="group flex gap-5 rounded-card border border-line bg-surface p-4 transition hover:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink sm:p-5"
    >
      <div className="w-28 shrink-0 overflow-hidden rounded-card bg-surface-sunken sm:w-36">
        {photo !== null ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.src}
            alt={`${garment.name}, ${photo.colourName}`}
            loading="lazy"
            className="aspect-[3/4] w-full object-cover"
          />
        ) : (
          <span className="flex aspect-[3/4] items-center justify-center px-2 text-center text-xs text-ink-subtle">
            Фото готуємо
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col">
        <h2 className="font-display text-lg font-bold uppercase leading-tight text-ink group-hover:underline">
          {garment.name}
        </h2>
        {/*
          Ціна точна, без «від». Надбавок за розмір на базових речах немає,
          тож «від» не попереджало б ні про що — лише натякало на дрібний
          шрифт, якого не існує.
        */}
        {/*
          Підпис «база, без принта» — рішення Олексія 01.10.2026. Без нього
          690 ₴ тут і 1 290 ₴ на сторінці принта читались як розбіжність:
          це ціна самого виробу, принт додається окремо.
        */}
        <p className="mt-1 font-display text-xl font-bold text-ink">
          {formatUAH(minor(garment.basePriceMinor))}
          <span className="ml-1.5 font-sans text-sm font-normal text-ink-subtle">база, без принта</span>
        </p>

        <dl className="mt-3 space-y-0.5 text-sm text-ink-muted">
          <dt className="sr-only">Кольори</dt>
          <dd>
            {garment.colours.length}{' '}
            {plural(garment.colours.length, 'колір', 'кольори', 'кольорів')}
          </dd>
          {sizeRange !== null && (
            <>
              <dt className="sr-only">Розміри</dt>
              <dd>Розміри: <span className="text-ink">{sizeRange}</span></dd>
            </>
          )}
        </dl>

        <span className="mt-auto pt-4">
          <span className="inline-flex min-h-9 items-center rounded-pill bg-ink px-4 text-sm font-medium text-surface transition group-hover:opacity-85">
            Детальніше
          </span>
        </span>
      </div>
    </Link>
  );
}
