import type { Metadata } from 'next';
import Link from 'next/link';
import { BreedListDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { BreedStrip, plural } from '@/features/home/blocks';
import { serverFetchOrNull } from '@/lib/server-api';
import { getSettings } from '@/lib/site-settings';
import { ButtonLink, EmptyState } from '@/components/ui';

export const revalidate = 300;

/**
 * Перелік порід.
 *
 * Сторінка мала існувати з першого дня: на неї вело посилання «Дивитись усі»
 * зі смуги порід на головній, і воно вело в 404. Тепер вона ще й пункт меню —
 * «Породи» стоять першими, бо це питання, з яким на сайт приходять.
 *
 * Породи без принтів звідси не викидаються: сторінка породи працює й без
 * каталогу, вона пропонує намалювати з фото. Викинути їх означало б
 * відповісти «ні» там, де відповідь «так, але інакше».
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  return {
    title: `Породи — ${site.brand}`,
    description: 'Усі породи, для яких у нас є готові принти. Немає вашої — намалюємо з фото.',
    alternates: { canonical: '/breeds' },
  };
}

export default async function BreedsPage() {
  const data = await serverFetchOrNull('/catalog/breeds', BreedListDto, 300);
  const breeds = data?.items ?? [];
  const withPrints = breeds.filter((b) => b.printCount > 0).length;

  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <nav aria-label="Хлібні крихти" className="text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">Породи</span>
        </nav>

        <h1 className="mt-3 font-display text-hero font-bold uppercase text-ink">Породи</h1>
        {breeds.length > 0 && (
          <p className="mt-3 max-w-prose text-lg text-ink-muted">
            {withPrints} {plural(withPrints, 'порода', 'породи', 'порід')} з готовими принтами.
            Решту малюємо з вашого фото.
          </p>
        )}

        <div className="mt-10">
          {breeds.length > 0 ? (
            <BreedStrip breeds={breeds} limit={breeds.length} />
          ) : (
            <EmptyState
              title="Породи ще додаємо"
              hint="Напишіть, кого малювати — почнемо з вашої."
              action={<ButtonLink href="/svoya-ideya">Замовити свій принт</ButtonLink>}
            />
          )}
        </div>
      </div>
    </PublicShell>
  );
}
