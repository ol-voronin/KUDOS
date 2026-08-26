import Link from 'next/link';
import { formatUAH, minor, type PrintCardDto } from '@dt/contracts';
import { PrintThumb } from '@/components/print-thumb';

/**
 * Плитка принта. Одна на всі сітки — головна, породна, колекція.
 *
 * Рамки навколо картки більше немає. Це не смак: рамка малює прямокутник
 * навколо фотографії, на якій і так є прямокутник — сам принт. Два
 * вкладені прямокутники читаються як шум, і саме тому обидва референси
 * кладуть товар на голе тло й розділяють колонки волосінню.
 *
 * Ціна показується як «від N ₴», бо принт друкується на кількох виробах із
 * різною базовою ціною. Не показати ціну взагалі гірше: людина мусить
 * заходити в картку, щоб зрозуміти, чи це взагалі її діапазон.
 */
export function PrintCard({ print }: { print: PrintCardDto }) {
  return (
    <Link
      href={`/prints/${print.slug}`}
      className="group reveal flex flex-col px-3 pb-5 pt-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
    >
      {/*
        Фото ледь наближається під курсором. Рух живе на обгортці з
        `overflow-hidden`, а не на самій картці: інакше зростала б уся
        плитка й сусідні колонки смикалися б разом із нею.
      */}
      <div className="relative overflow-hidden bg-surface-sunken">
        <div className="transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none">
          <PrintThumb src={print.previewUrl} alt={print.title} />
        </div>
      </div>

      <p className="mt-3 border-t border-ink pt-2 text-sm font-medium text-ink transition-opacity duration-200 group-hover:opacity-60">
        {print.title}
      </p>

      <div className="mt-1 flex items-baseline justify-between gap-2">
        {print.fromPriceMinor === null
          ? <span className="text-sm text-ink-subtle">ціну уточнюємо</span>
          : (
            <p className="font-display text-lg font-bold text-ink">
              {formatUAH(minor(print.fromPriceMinor))}
            </p>
          )}
        {/*
          Наявність — короткий підпис, а не зелена плашка. Плашка кричала на
          кожній картці однаково голосно, тобто не означала нічого. Але й одна
          літера «є» біля крапки не читалася — потрібне слово, яке щось каже:
          «є» відповідає на питання «коли», а не «скільки».
        */}
        {print.inStock && (
          <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-ok">
            <span aria-hidden className="h-1.5 w-1.5 rounded-pill bg-ok" />
            в наявності
          </span>
        )}
      </div>
    </Link>
  );
}

/**
 * Сітка товарів.
 *
 * Волосінь між колонками замальовується не проміжком, а рамкою самих
 * комірок: у сітці з незаповненим останнім рядком фон-роздільник
 * перетворився б на сірі плями там, де товарів забракло.
 */
export function PrintGrid({ prints }: { prints: readonly PrintCardDto[] }) {
  return (
    <div
      className={[
        'grid grid-cols-2 border-t border-line sm:grid-cols-3 lg:grid-cols-4',
        '[&>*]:border-b [&>*]:border-r [&>*]:border-line',
        '[&>*:nth-child(2n)]:border-r-0',
        'sm:[&>*:nth-child(2n)]:border-r sm:[&>*:nth-child(3n)]:border-r-0',
        'lg:[&>*:nth-child(3n)]:border-r lg:[&>*:nth-child(4n)]:border-r-0',
      ].join(' ')}
    >
      {prints.map((print) => <PrintCard key={print.id} print={print} />)}
    </div>
  );
}

/**
 * Заголовок секції.
 *
 * Два тони одного заголовка — головний прийом напрямку: перше слово
 * чорнилом, продовження блідим. Читається як одне ціле, але великий кегль
 * не перетворює сторінку на суцільний крик.
 */
export function SectionHead({
  title, ghost, eyebrow, subtitle, href, hrefLabel,
}: {
  title: string; ghost?: string; eyebrow?: string; subtitle?: string;
  href?: string; hrefLabel?: string;
}) {
  return (
    <div className="reveal mb-6">
      {eyebrow !== undefined && <p className="label-eyebrow mb-1">{eyebrow}</p>}
      <h2 className="text-section font-display font-bold uppercase text-ink">
        {title}
        {ghost !== undefined && <> <span className="ghost-word">{ghost}</span></>}
      </h2>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3 border-t border-ink pt-2">
        {subtitle !== undefined
          ? <p className="max-w-prose text-sm text-ink-muted">{subtitle}</p>
          : <span />}
        {href !== undefined && (
          <Link
            href={href}
            className="label-eyebrow shrink-0 border-b border-ink pb-0.5 text-ink hover:text-ink-muted"
          >
            {hrefLabel ?? 'Дивитись усі'} →
          </Link>
        )}
      </div>
    </div>
  );
}
