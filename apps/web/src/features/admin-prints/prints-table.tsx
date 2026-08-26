'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PrintThumb } from '@/components/print-thumb';
import { listPrints, type PrintFilters } from './api';
import { TableSkeleton } from '@/components/ui';

const FILTERS: ReadonlyArray<{ label: string; value: PrintFilters['published'] }> = [
  { label: 'Усі', value: undefined },
  { label: 'Опубліковані', value: 'true' },
  { label: 'Чернетки', value: 'false' },
];

export function PrintsTable() {
  const [published, setPublished] = useState<PrintFilters['published']>(undefined);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-prints', published, q, page],
    queryFn: () => listPrints({ ...(published ? { published } : {}), ...(q ? { q } : {}), page }),
    staleTime: 10_000,
  });

  const pages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5" role="group" aria-label="Фільтр за станом">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={published === f.value}
              onClick={() => { setPublished(f.value); setPage(1); }}
              className={[
                'min-h-10 rounded-card border px-3 text-sm font-medium transition',
                published === f.value ? 'border-ink bg-ink text-surface' : 'border-line text-ink-muted hover:border-ink-subtle',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>

        <label className="sr-only" htmlFor="print-search">Пошук за назвою</label>
        <input
          id="print-search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Пошук за назвою або адресою"
          className="h-10 min-w-56 flex-1 rounded-card border border-line bg-surface-raised px-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-ink"
        />

        <Link
          href="/admin/prints/new"
          className="inline-flex min-h-10 items-center rounded-pill bg-ink px-5 text-sm font-semibold text-surface transition hover:bg-ink/85"
        >
          Новий принт
        </Link>
      </div>

      <div className="mt-5">
        {isLoading && <TableSkeleton rows={5} cols={4} />}
        {isError && <p className="text-danger">Не вдалося завантажити принти.</p>}

        {data && data.items.length === 0 && (
          <div className="rounded-card border border-dashed border-line-strong bg-surface-sunken p-8 text-center">
            <p className="font-medium text-ink">
              {q || published ? 'Нічого не знайшлося' : 'Жодного принта ще немає'}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
              {q || published
                ? 'Спробуйте змінити фільтр або пошук.'
                : 'Каталог зараз показує демо-дані з сіду. Перший справжній принт замінить їх на сайті.'}
            </p>
            {!q && !published && (
              <Link
                href="/admin/prints/new"
                className="mt-5 inline-flex min-h-11 items-center rounded-pill bg-ink px-5 text-sm font-semibold text-surface"
              >
                Додати перший
              </Link>
            )}
          </div>
        )}

        {data && data.items.length > 0 && (
          <div className="overflow-x-auto rounded-card border border-line">
            <table className="w-full min-w-[52rem] border-collapse bg-surface-raised text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-subtle">
                  <th className="w-16 px-3 py-2.5 font-bold">Фото</th>
                  <th className="px-3 py-2.5 font-bold">Назва</th>
                  <th className="px-3 py-2.5 font-bold">Породи</th>
                  <th className="px-3 py-2.5 font-bold">Розмір</th>
                  <th className="px-3 py-2.5 font-bold">Стан</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((print) => (
                  <tr key={print.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2.5">
                      <div className="w-11">
                        <PrintThumb src={print.previewUrl} alt={print.title} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/admin/prints/${print.id}`} className="font-medium text-ink hover:underline">
                        {print.title}
                      </Link>
                      <p className="text-xs text-ink-subtle">/{print.slug}</p>
                    </td>
                    <td className="px-3 py-2.5 text-ink-muted">
                      {print.breeds.length > 0
                        ? print.breeds.map((b) => b.name).join(', ')
                        : <span className="text-ink-subtle">— не привʼязано</span>}
                    </td>
                    <td className="px-3 py-2.5 text-ink-muted">{print.sizeTier}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={[
                          'inline-flex items-center gap-1.5 rounded-card px-2 py-1 text-xs font-semibold',
                          print.isPublished ? 'bg-ok-soft text-ok' : 'bg-surface-sunken text-ink-muted',
                        ].join(' ')}
                      >
                        {print.isPublished ? '● На сайті' : '○ Чернетка'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link href={`/admin/prints/${print.id}`} className="text-sm font-medium text-ink hover:underline">
                        Редагувати
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-ink-muted">
            <span>{data.total} принтів · сторінка {data.page} з {pages}</span>
            <div className="flex gap-2">
              <button
                type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="min-h-10 rounded-card border border-line px-3 disabled:opacity-40"
              >
                Назад
              </button>
              <button
                type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
                className="min-h-10 rounded-card border border-line px-3 disabled:opacity-40"
              >
                Далі
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
