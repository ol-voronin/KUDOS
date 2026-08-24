import type { Metadata } from 'next';
import Link from 'next/link';
import { CollectionListDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { CollectionStrip } from '@/features/home/blocks';
import { serverFetchOrNull } from '@/lib/server-api';
import { site } from '@/config/site';

export const revalidate = 300;

export const metadata: Metadata = {
  title: `Колекції — ${site.brand}`,
  description: 'Принти зібрані за настроєм: портрети, журнальні обкладинки, характери.',
  alternates: { canonical: '/collections' },
};

export default async function CollectionsPage() {
  const data = await serverFetchOrNull('/catalog/collections', CollectionListDto, 300);
  const items = data?.items ?? [];

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <nav aria-label="Хлібні крихти" className="text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">Колекції</span>
        </nav>

        <h1 className="mt-3 font-display text-hero font-bold text-ink">Колекції</h1>
        <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-muted">
          Друга вісь каталогу: не за породою, а за настроєм. Один і той самий пес
          може бути і в портреті, і на обкладинці журналу.
        </p>

        <div className="mt-10">
          {items.length > 0 ? (
            <CollectionStrip collections={items} />
          ) : (
            <div className="rounded-card border border-dashed border-line-strong bg-surface-sunken p-8 text-center">
              <p className="font-medium text-ink">Колекції ще збираються</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
                Тим часом принти можна дивитись за породами.
              </p>
              <Link
                href="/prints"
                className="mt-5 inline-flex min-h-11 items-center rounded-card bg-accent px-5 text-sm font-semibold text-white"
              >
                Усі принти
              </Link>
            </div>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
