import Link from 'next/link';
import { type PrintCardDto } from '@dt/contracts';
import { PrintThumb } from '@/components/print-thumb';
import { PrintListTracker } from '@/features/analytics/PrintListTracker';
import type { ListName } from '@/features/analytics/lists';

/**
 * Плитка принта. Одна на всі сітки — головна, породна, колекція.
 *
 * Рамки навколо картки більше немає. Це не смак: рамка малює прямокутник
 * навколо фотографії, на якій і так є прямокутник — сам принт. Два
 * вкладені прямокутники читаються як шум, і саме тому обидва референси
 * кладуть товар на голе тло й розділяють колонки волосінню.
 *
 * Ціни на плитці немає. Друк коштує однаково на всіх принтах, тож «від 890 ₴»
 * стояло б під кожною карткою тим самим числом — це не інформація, а шум, який
 * ще й відволікає від малюнка. Ціна живе там, де вона нарешті щось означає:
 * у картці принта, поруч із вибором виробу.
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
          <PrintThumb src={print.previewUrl} alt={print.title} ratio="portrait" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-ink pt-2">
        <p className="text-sm font-medium text-ink transition-opacity duration-200 group-hover:opacity-60">
          {print.title}
        </p>
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
export function PrintGrid(
  { prints, list, listId }:
  { prints: readonly PrintCardDto[]; list?: ListName; listId?: string },
) {
  const grid = (
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

  // Без `list` сітка лишається чистим сервером: обгортка й слухач додаються
  // тільки там, де вітрину справді треба відрізнити від інших у звіті.
  if (list === undefined) return grid;
  return (
    <PrintListTracker
      list={list}
      listId={listId}
      prints={prints.map((p) => ({ slug: p.slug, title: p.title, fromPriceMinor: p.fromPriceMinor }))}
    >
      {grid}
    </PrintListTracker>
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
  title, ghost, eyebrow, subtitle, href, hrefLabel, onDark = false,
}: {
  title: string; ghost?: string; eyebrow?: string; subtitle?: string;
  href?: string; hrefLabel?: string; onDark?: boolean;
}) {
  const head = onDark ? 'text-surface' : 'text-ink';
  const body = onDark ? 'text-surface/75' : 'text-ink-muted';
  const rule = onDark ? 'border-surface/45' : 'border-ink';
  return (
    <div className="reveal mb-6">
      {eyebrow !== undefined && <p className={`label-eyebrow mb-1 ${onDark ? 'text-surface/60' : ''}`}>{eyebrow}</p>}
      <h2 className={`text-section font-display font-bold uppercase ${head}`}>
        {title}
        {/* Привида на чорному немає: блідий тон там зчитується як брак контрасту. */}
        {ghost !== undefined && <> <span className={onDark ? '' : 'ghost-word'}>{ghost}</span></>}
      </h2>
      <div className={`mt-3 flex flex-wrap items-baseline justify-between gap-3 border-t pt-2 ${rule}`}>
        {subtitle !== undefined
          ? <p className={`max-w-prose text-sm ${body}`}>{subtitle}</p>
          : <span />}
        {href !== undefined && (
          <Link
            href={href}
            className={`label-eyebrow shrink-0 border-b pb-0.5 hover:opacity-70 ${rule} ${head}`}
          >
            {hrefLabel ?? 'Дивитись усі'} →
          </Link>
        )}
      </div>
    </div>
  );
}
