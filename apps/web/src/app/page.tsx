'use client';

import Link from 'next/link';
import { PublicShell } from '@/components/public-shell';
import { usePrintList } from '@/features/catalog/hooks/usePrintList';

function PrintGrid() {
  const { data, isLoading, isError } = usePrintList(8);

  if (isLoading) {
    return <p className="text-ink-muted">Завантаження…</p>;
  }
  if (isError || !data) {
    return <p className="text-danger">Не вдалося завантажити принти.</p>;
  }
  if (data.items.length === 0) {
    return <p className="text-ink-muted">Поки що немає жодного опублікованого принта.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {data.items.map((print) => (
        <Link
          key={print.id}
          href={`/prints/${print.slug}`}
          className="group rounded-card border border-line bg-surface-raised p-2 transition hover:border-ink"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={print.previewUrl}
            alt=""
            className="aspect-square w-full rounded-card object-cover"
          />
          <p className="mt-2 truncate text-sm font-medium text-ink group-hover:underline">{print.title}</p>
        </Link>
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.11em] text-ink-subtle">
              Одяг для людей, а не для собак
            </p>
            <h1 className="text-hero font-display font-bold text-ink">
              Ваш пес — на вашій футболці
            </h1>
            <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-muted">
              Готові принти за породами або власний портрет із фото. Друкуємо в Києві, шиємо самі.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#каталог"
                className="flex min-h-12 items-center rounded-card bg-ink px-6 text-sm font-semibold text-surface transition hover:bg-ink/90"
              >
                Знайти свою породу
              </a>
              <span
                className="flex min-h-12 items-center rounded-card border border-line px-6 text-sm font-medium text-ink-subtle"
                aria-disabled="true"
                title="Незабаром"
              >
                Свій принт із фото
              </span>
            </div>
          </div>

          <div className="flex aspect-[4/3] items-center justify-center rounded-card border border-line bg-surface-sunken">
            <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true">
              <circle cx="48" cy="48" r="30" stroke="currentColor" strokeWidth="3" className="text-accent" />
              <circle cx="36" cy="42" r="3.5" fill="currentColor" className="text-accent" />
              <circle cx="60" cy="42" r="3.5" fill="currentColor" className="text-accent" />
              <path d="M40 56c3 3 13 3 16 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-accent" />
              <path d="M24 34c-4-8 2-14 10-10M72 34c4-8-2-14-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-accent" />
            </svg>
          </div>
        </div>

        <div id="каталог" className="mt-16 md:mt-24">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-2xl text-ink">Останні принти</h2>
          </div>
          <PrintGrid />
        </div>
      </div>
    </PublicShell>
  );
}

