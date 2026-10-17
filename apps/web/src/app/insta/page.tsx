import type { Metadata } from 'next';
import Link from 'next/link';
import { BlobImage } from '@/components/blob-image';
import { notFound } from 'next/navigation';
import { BreedListDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { Section } from '@/components/section';
import { ButtonLink } from '@/components/ui';
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from '@/config/social';
import { serverFetchOrNull } from '@/lib/server-api';
import { getSettings } from '@/lib/site-settings';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  return {
    title: `${site.brand} в Instagram — @${INSTAGRAM_HANDLE}`,
    description: 'Нові принти, собаки наших клієнтів, Боня й Паштет. Підписуйся на БАБАКА в Instagram.',
    alternates: { canonical: '/insta' },
  };
}

/**
 * «Ми в Instagram» — сторінка на нашому домені.
 *
 * Навіщо, якщо можна дати пряме посилання: Google Ads не пускає рекламу
 * прямо на instagram.com (домен оголошення має збігатися з місцем, куди
 * людина потрапляє), а посилання «link in bio» краще вести туди, де
 * людина бачить і профіль, і каталог. Сюди ж ведуть оголошення, що
 * рекламують Instagram: людина або підписується, або йде в каталог —
 * обидва варіанти нам підходять.
 *
 * Клік у профіль рахується подією GA4 `instagram_click` (analytics.tsx).
 */
export default async function InstaPage() {
  if (INSTAGRAM_URL === '') notFound();

  const breeds = await serverFetchOrNull('/catalog/breeds', BreedListDto, 300);
  const gallery = (breeds?.items ?? []).filter((b) => b.printCount > 0 && b.previewUrl !== '').slice(0, 9);

  return (
    <PublicShell>
      <Section tone="plum">
        <p className="label-eyebrow">Instagram · @{INSTAGRAM_HANDLE}</p>
        <h1 className="mt-3 font-display text-hero font-bold uppercase text-ink">
          Одяг щасливих собачників <span className="ghost-word">— тепер і в</span> <span className="text-accent">Instagram</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted">
          Нові принти раніше, ніж на сайті. Собаки наших клієнтів в обновках. Боня, яка перевіряє
          кожне худі, і Паштет, який досі не визнає, що це гарно.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={INSTAGRAM_URL} size="lg">Підписатися @{INSTAGRAM_HANDLE}</ButtonLink>
          <ButtonLink href="/prints" variant="outline" size="lg">Дивитися принти</ButtonLink>
        </div>
      </Section>

      {gallery.length >= 3 && (
        <Section>
          <h2 className="text-section font-bold uppercase text-ink">
            Кого ми <span className="ghost-word">вже</span> намалювали
          </h2>
          <ul className="mt-8 grid grid-cols-3 gap-3">
            {gallery.map((b) => (
              <li key={b.id}>
                <Link href={`/breeds/${b.slug}`} className="group block">
                  <span className="relative block aspect-square overflow-hidden rounded-card border border-line bg-surface">
                    <BlobImage src={b.previewUrl} alt={`Принт ${b.name}`} sizes="33vw" className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none" />
                  </span>
                  <span className="mt-2 block truncate text-sm font-medium text-ink">{b.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section tone="cream">
        <h2 className="text-section font-bold uppercase text-ink">Покажи свого пса</h2>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Сфоткай собаку в обновці від БАБАКА й познач @{INSTAGRAM_HANDLE} — найкращі фото покажемо в сторіс.
        </p>
        <div className="mt-6">
          <ButtonLink href={INSTAGRAM_URL} variant="outline" size="lg">Відкрити Instagram</ButtonLink>
        </div>
      </Section>
    </PublicShell>
  );
}
