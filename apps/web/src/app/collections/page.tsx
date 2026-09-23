import type { Metadata } from 'next';
import Link from 'next/link';
import { CollectionListDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { CollectionStrip } from '@/features/home/blocks';
import { serverFetchOrNull } from '@/lib/server-api';
import { getSettings } from '@/lib/site-settings';
import { ButtonLink, EmptyState } from '@/components/ui';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  return {
    title: `Колекції — ${site.brand}`,
    description: 'Принти зібрані за настроєм: портрети, журнальні обкладинки, характери.',
    alternates: { canonical: '/collections' },
  
  };
}

export default async function CollectionsPage() {
  const data = await serverFetchOrNull('/catalog/collections', CollectionListDto, 300);
  const items = data?.items ?? [];

  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <nav aria-label="Хлібні крихти" className="text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">Колекції</span>
        </nav>

        <h1 className="mt-3 font-display text-hero font-bold text-ink">Колекції</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-muted">
          Наші колекції — це Бабаки в різних стилях. Той випадок, коли береш щось
          з Вестіком собі, з Доберманом другу, а сусіду з Коргі кажеш де таке замовити.
        </p>

        <div className="mt-10">
          {items.length > 0 ? (
            <CollectionStrip collections={items} />
          ) : (
            <EmptyState
              title="Колекції ще збираються"
              hint="Тим часом принти можна дивитись за породами."
              action={<ButtonLink href="/prints">Усі принти</ButtonLink>}
            />
          )}
        </div>
      </div>
    </PublicShell>
  );
}
