import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { SearchResultDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { PrintGrid, SectionHead } from '@/features/home/print-card';
import { BreedStrip, CollectionStrip, plural } from '@/features/home/blocks';
import { SearchForm } from '@/features/search/search-form';
import { serverFetchOrNull } from '@/lib/server-api';
import { getSettings } from '@/lib/site-settings';
import { ButtonLink } from '@/components/ui';

interface Search { searchParams?: { q?: string } }

export async function generateMetadata({ searchParams }: Search): Promise<Metadata> {
  const site = await getSettings();
  const q = searchParams?.q?.trim();
  return {
    title: q ? `Пошук: ${q} — ${site.brand}` : `Пошук — ${site.brand}`,
    // Сторінки результатів не мають бути в індексі: це дублі каталогу
    // під тисячею випадкових запитів.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: Search) {
  const q = (searchParams?.q ?? '').trim();
  const data = q.length >= 2
    ? await serverFetchOrNull(`/catalog/search?q=${encodeURIComponent(q)}`, SearchResultDto, 30)
    : null;

  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-ink">
          {q ? <>Пошук: <span className="text-ink-muted">{q}</span></> : 'Пошук'}
        </h1>

        <div className="mt-6 max-w-md">
          <Suspense fallback={null}>
            <SearchForm compact />
          </Suspense>
        </div>

        {q.length > 0 && q.length < 2 && (
          <p className="mt-8 text-ink-muted">Введіть хоча б дві літери.</p>
        )}

        {data && data.total === 0 && <NothingFound query={q} />}

        {data && data.breeds.length > 0 && (
          <section className="mt-12">
            <SectionHead title="Породи" subtitle="Найімовірніше ви шукали саме це." />
            <BreedStrip breeds={data.breeds} />
          </section>
        )}

        {data && data.collections.length > 0 && (
          <section className="mt-12">
            <SectionHead title="Колекції" />
            <CollectionStrip collections={data.collections} />
          </section>
        )}

        {data && data.prints.length > 0 && (
          <section className="mt-12">
            <SectionHead
              title="Принти"
              subtitle={`${data.prints.length} ${plural(data.prints.length, 'знайдено', 'знайдено', 'знайдено')}`}
            />
            <PrintGrid prints={data.prints} />
          </section>
        )}
      </div>
    </PublicShell>
  );
}

/**
 * Порожній результат — найчастіший момент, коли людина йде з сайту.
 * Тому тут не «нічого не знайдено», а пропозиція: породи, якої немає в
 * каталозі, ми й так малюємо з нуля.
 */
function NothingFound({ query }: { query: string }) {
  return (
    <div className="mt-10 rounded-card border border-dashed border-line-strong bg-surface-sunken p-8 text-center">
      <p className="font-medium text-ink">За запитом «{query}» нічого не знайшли</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
        Якщо це порода вашої собаки — просто напишіть нам. Готового принта може
        не бути, але намалювати з фото ми можемо будь-кого.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/svoya-ideya">
          Замовити свій принт
        </ButtonLink>
        <ButtonLink href="/prints" variant="quiet">
          Дивитись усі принти
        </ButtonLink>
      </div>
    </div>
  );
}
