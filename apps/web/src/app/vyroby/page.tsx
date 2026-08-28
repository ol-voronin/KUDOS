import type { Metadata } from 'next';
import Link from 'next/link';
import { RangeDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { Section } from '@/components/section';
import { RangeCard } from '@/features/catalog/components/RangeCard';
import { serverFetchOrNull } from '@/lib/server-api';
import { getSettings } from '@/lib/site-settings';
import { ButtonLink } from '@/components/ui';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  return {
    title: `Вироби: футболки, світшоти, худі — тканини, кольори, розміри | ${site.brand}`,
    description:
      'Сім виробів власного пошиття: класична та оверсайз футболки, гібриди, світшот і худі. '
      + 'Склад тканини, щільність, повна розмірна сітка й усі доступні кольори.',
    alternates: { canonical: '/vyroby' },
  
  };
}

/**
 * Асортимент як окрема сторінка.
 *
 * У сценарії покупця це два різні входи, і обидва раніше впиралися в стіну.
 * Перший — «а що у вас узагалі є»: людина ще не обрала принт і не хоче
 * обирати, доки не знає, на чому він буде. Другий — «а ця футболка мені
 * підійде»: людина вже стоїть на сторінці принта й шукає розмірну сітку.
 * Обидва питання про виріб, а не про малюнок, і жодне з них не мало
 * сторінки.
 */
export default async function RangePage() {
  const site = await getSettings();
  const range = await serverFetchOrNull('/catalog/range', RangeDto, 300);
  const garments = range?.garments ?? [];
  const cheapestPrint = range && range.printPrices.length > 0
    ? Math.min(...range.printPrices.map((p) => p.priceMinor))
    : null;

  return (
    <PublicShell>
      <Section tone="cream">
        <nav aria-label="Хлібні крихти" className="mb-4 text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">Вироби</span>
        </nav>
        <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">На чому друкуємо</h1>
        <p className="mt-4 max-w-2xl text-ink-muted">
          Шиємо самі {site.cityIn}. Нижче — усе, що є: склад тканини, щільність, повна
          розмірна сітка й кожен колір, у якому виріб реально існує. Принт можна поставити
          на будь-який із них.
        </p>
      </Section>

      <Section>
        {garments.length === 0 ? (
          <p className="text-ink-muted">Асортимент тимчасово недоступний. Спробуй оновити сторінку.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {garments.map((g) => (
              <RangeCard key={g.id} garment={g} cheapestPrintMinor={cheapestPrint} />
            ))}
          </div>
        )}
      </Section>

      <Section tone="teal">
        <h2 className="font-display text-2xl font-bold text-ink">Не знайшли свій розмір або колір?</h2>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Шиємо самі, тому багато що можемо зробити під тебе. Напиши — порахуємо.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/prints" size="lg">Обрати принт</ButtonLink>
          <ButtonLink href="/zayavka" variant="outline" size="lg">Залишити заявку</ButtonLink>
        </div>
      </Section>
    </PublicShell>
  );
}
