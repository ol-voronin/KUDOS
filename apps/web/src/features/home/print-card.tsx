import Link from 'next/link';
import { formatUAH, minor, type PrintCardDto } from '@dt/contracts';
import { PrintThumb } from '@/components/print-thumb';

/**
 * Плитка принта. Одна на всі сітки — головна, породна, колекція.
 *
 * Ціна показується як «від N ₴», бо принт друкується на кількох виробах із
 * різною базовою ціною. Не показати ціну взагалі гірше: людина мусить
 * заходити в картку, щоб зрозуміти, чи це взагалі її діапазон.
 */
export function PrintCard({ print }: { print: PrintCardDto }) {
  return (
    <Link
      href={`/prints/${print.slug}`}
      className="group flex flex-col rounded-card border border-line bg-surface-raised p-2 transition hover:border-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
    >
      <div className="relative">
        <PrintThumb src={print.previewUrl} alt={print.title} />
        {print.inStock && (
          <span className="absolute left-2 top-2 rounded-card bg-ok-soft px-2 py-1 text-xs font-semibold text-ok">
            Є в наявності
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium text-ink group-hover:underline">{print.title}</p>
      <p className="mt-auto pt-1 text-sm text-ink-muted">
        {print.fromPriceMinor === null
          ? <span className="text-ink-subtle">ціну уточнюємо</span>
          : <>від <span className="font-semibold text-ink">{formatUAH(minor(print.fromPriceMinor))}</span></>}
      </p>
    </Link>
  );
}

export function PrintGrid({ prints }: { prints: readonly PrintCardDto[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {prints.map((print) => <PrintCard key={print.id} print={print} />)}
    </div>
  );
}

/** Заголовок секції з посиланням «дивитись усі». Однаковий у всіх блоках. */
export function SectionHead({
  title, subtitle, href, hrefLabel,
}: { title: string; subtitle?: string; href?: string; hrefLabel?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
        {subtitle && <p className="mt-1.5 max-w-prose text-ink-muted">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="shrink-0 text-sm font-medium text-ink underline-offset-4 hover:underline">
          {hrefLabel ?? 'Дивитись усі'} →
        </Link>
      )}
    </div>
  );
}
