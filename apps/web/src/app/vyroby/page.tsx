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
      'Базовий одяг: класична та оверсайз футболки, світшот-футболки 2-в-1, світшот і худі. '
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
 * Сітка виробів без поділу на типи.
 *
 * Розділи «футболки / світшоти / худі / 2-в-1» з описами звідси прибрані на
 * прохання Даші. Виробів сім — рівно стільки, скільки людина охоплює одним
 * поглядом, і будь-яке групування тут лише додає заголовків між тим, що вона
 * й так бачить цілком. Тип крою читається з назви й фотографії.
 */
function RangeGrid({ garments }: { garments: RangeDto['garments'] }) {
  return (
    <Section>
      <div className="grid gap-4 md:grid-cols-2">
        {garments.map((g) => <RangeCard key={g.id} garment={g} />)}
      </div>
    </Section>
  );
}

export default async function RangePage() {
  const site = await getSettings();
  const range = await serverFetchOrNull('/catalog/range', RangeDto, 300);
  const garments = range?.garments ?? [];

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
        <RangeGrid garments={garments} />
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
