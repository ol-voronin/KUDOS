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
    title: `Базовий одяг: футболки, світшоти, худі без принта | ${site.brand}`,
    description:
      // «Світшот-футболка 2-в-1» замість «гібрид»: слово з внутрішньої кухні
      // покупцеві нічого не каже (питання Даші, наша відповідь).
      'Базовий одяг власного пошиття: класична та оверсайз футболки, світшот-футболки 2-в-1, світшот і худі. '
      + 'Купуй без принта або обирай малюнок із каталогу. Склад тканини, розмірні сітки, всі кольори.',
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
/**
 * Секції за типом виробу + липкі якорі.
 *
 * Тип виводиться зі слага (futbolka-, svitshot-, hudi-, hibryd-), а не з
 * нового поля в базі: слаги в нас і є номенклатурою, дублювати її колонкою
 * заради навігації — плодити другу правду. Гібриди — окремою секцією «2-в-1»:
 * це фішка асортименту, а не підвид світшота (рішення Олексія).
 */
const RANGE_GROUPS = [
  { id: 'futbolky', label: 'Футболки', match: (slug: string) => slug.startsWith('futbolka-'),
    blurb: 'Класична й оверсайз. Щільна бавовна, виготовляємо самі.' },
  { id: 'svitshoty', label: 'Світшоти', match: (slug: string) => slug.startsWith('svitshot-'),
    blurb: 'Тепла тринитка з начосом. Вільний крій, манжети тримають форму.' },
  { id: 'khudi', label: 'Худі', match: (slug: string) => slug.startsWith('hudi-'),
    blurb: 'Капюшон, кишеня-кенгуру і вісімнадцять кольорів — від молочного шоколаду до бузку.' },
  { id: 'dva-v-odnomu', label: '2-в-1', match: (slug: string) => slug.startsWith('hibryd-'),
    blurb: 'Світшот-футболка та худі-футболка: короткий рукав, тепле тіло. Таке мало хто робить.' },
] as const;

function RangeSections({ garments, cheapestPrint }: {
  garments: RangeDto['garments'];
  cheapestPrint: number | null;
}) {
  const grouped = RANGE_GROUPS
    .map((group) => ({ ...group, items: garments.filter((g) => group.match(g.slug)) }))
    .filter((group) => group.items.length > 0);
  const leftovers = garments.filter((g) => !RANGE_GROUPS.some((group) => group.match(g.slug)));
  const sections = [
    ...grouped,
    ...(leftovers.length > 0
      ? [{ id: 'inshe', label: 'Інше', blurb: '', items: leftovers } as const]
      : []),
  ];

  return (
    <>
      {sections.map((s) => (
        <Section key={s.id}>
          {/* scroll-mt: під липку шапку сайту; стрічки якорів тут більше немає. */}
          <div id={s.id} className="scroll-mt-24">
            <h2 className="font-display text-2xl font-bold text-ink">{s.label}</h2>
            {s.blurb !== '' && <p className="mt-2 max-w-2xl text-ink-muted">{s.blurb}</p>}
            <div className="mt-6 flex flex-col gap-6">
              {s.items.map((g) => (
                <RangeCard key={g.id} garment={g} cheapestPrintMinor={cheapestPrint} />
              ))}
            </div>
          </div>
        </Section>
      ))}
    </>
  );
}

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
          <span className="text-ink">Базовий одяг</span>
        </nav>
        <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">Базовий одяг</h1>
        <div className="mt-4 flex max-w-2xl flex-col gap-3 text-ink-muted">
          <p>Друкуємо наших Бабак на речах еко-бренду Native Spirit (Франція).</p>
          <p>
            Ці речі виготовлені із високоякісних органічних матеріалів та поліестеру
            вторинної переробки, а якість матеріалів перевірена і підтверджена
            міжнародними сертифікатами та стандартами.
          </p>
          <p>Кожну річ можна придбати як базу, без принту.</p>
        </div>
      </Section>

      {garments.length === 0 ? (
        <Section>
          <p className="text-ink-muted">Асортимент тимчасово недоступний. Спробуй оновити сторінку.</p>
        </Section>
      ) : (
        <RangeSections garments={garments} cheapestPrint={cheapestPrint} />
      )}

      <Section tone="teal">
        <h2 className="font-display text-2xl font-bold text-ink">Не знайшли свій розмір або колір?</h2>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Виготовляємо самі, тому багато що можемо зробити під тебе. Напиши — порахуємо.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/prints" size="lg">Обрати принт</ButtonLink>
          <ButtonLink href="/zayavka" variant="outline" size="lg">Залишити заявку</ButtonLink>
        </div>
      </Section>
    </PublicShell>
  );
}
