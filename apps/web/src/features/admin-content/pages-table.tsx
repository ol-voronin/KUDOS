'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { slugify, type AdminPageSummaryDto, type PageKind } from '@dt/contracts';
import { ApiError } from '@/lib/api-client';
import { createPage, listPages } from './api';

const KEY = ['admin-pages'];

const KIND_LABEL: Record<string, string> = {
  PAGE: 'Сторінка', ARTICLE: 'Матеріал', SYSTEM: 'Системна',
};

export function PagesTable() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: KEY, queryFn: listPages });
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [touchedSlug, setTouchedSlug] = useState(false);
  const [kind, setKind] = useState<PageKind>('PAGE');

  const create = useMutation({
    mutationFn: () => createPage({ slug, kind, title }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
      setCreating(false); setTitle(''); setSlug(''); setTouchedSlug(false); setKind('PAGE');
    },
  });

  if (isLoading) return <p className="text-ink-muted">Завантаження…</p>;
  if (isError || !data) return <p className="text-danger">Не вдалося завантажити список.</p>;

  return (
    <div className="flex flex-col gap-6">
      {creating ? (
        <form
          className="rounded-card border border-line bg-surface p-4"
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
        >
          <h2 className="mb-3 font-display text-lg font-bold text-ink">Нова сторінка</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Назва
              <input
                type="text" required value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!touchedSlug) setSlug(slugify(e.target.value));
                }}
                className="mt-1 w-full rounded-card border border-line px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink focus:border-ink focus:outline-none"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Адреса
              <input
                type="text" required value={slug}
                onChange={(e) => { setTouchedSlug(true); setSlug(e.target.value); }}
                className="mt-1 w-full rounded-card border border-line px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink focus:border-ink focus:outline-none"
              />
              <span className="mt-1 block font-normal normal-case tracking-normal text-ink-subtle">
                Буде за адресою {kind === 'ARTICLE' ? '/statti/' : '/'}{slug || '…'}
              </span>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Тип
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as PageKind)}
                className="mt-1 w-full rounded-card border border-line px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink focus:border-ink focus:outline-none"
              >
                <option value="PAGE">Сторінка</option>
                <option value="ARTICLE">Матеріал</option>
              </select>
              <span className="mt-1 block font-normal normal-case tracking-normal text-ink-subtle">
                {/* Тип вибирається один раз, при створенні: змінити його потім —
                    це змінити адресу, тобто зламати всі посилання на матеріал. */}
                Матеріал живе в стрічці, має дату й привʼязку до порід. Змінити потім не можна.
              </span>
            </label>
          </div>
          {create.error && (
            <p className="mt-3 text-sm text-danger" role="alert">
              {create.error instanceof ApiError ? create.error.message : 'Не вдалося створити'}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="submit" disabled={create.isPending || slug === ''}
              className="rounded-card bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {create.isPending ? 'Створюю…' : 'Створити'}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="text-sm text-ink-muted">
              Скасувати
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button
            type="button" onClick={() => setCreating(true)}
            className="rounded-card bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong"
          >
            Нова сторінка
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-muted">
              <th scope="col" className="py-2 pr-4 font-medium">Сторінка</th>
              <th scope="col" className="px-3 py-2 font-medium">Тип</th>
              <th scope="col" className="px-3 py-2 font-medium">Стан</th>
              <th scope="col" className="px-3 py-2 font-medium">Оновлено</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((p) => <Row key={p.id} page={p} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ page }: { page: AdminPageSummaryDto }) {
  return (
    <tr className="border-b border-line">
      <th scope="row" className="py-2.5 pr-4 text-left font-normal">
        <Link href={`/admin/storinky/${page.id}`} className="font-medium text-ink hover:underline">
          {page.title}
        </Link>
        <span className="block text-xs text-ink-subtle">/{page.slug}</span>
      </th>
      <td className="px-3 py-2.5 text-ink-muted">{KIND_LABEL[page.kind] ?? page.kind}</td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          {page.isPublished
            ? <span className="rounded-card bg-ok-soft px-1.5 py-0.5 text-xs font-semibold text-ok">на сайті</span>
            : <span className="rounded-card bg-surface-sunken px-1.5 py-0.5 text-xs text-ink-muted">не опубліковано</span>}
          {page.hasDraft && (
            <span className="rounded-card bg-sun-soft px-1.5 py-0.5 text-xs font-semibold text-sun-ink">
              є незопубліковані зміни
            </span>
          )}
          {page.revalidateError !== '' && (
            <span
              title={page.revalidateError}
              className="rounded-card bg-danger-soft px-1.5 py-0.5 text-xs font-semibold text-danger"
            >
              кеш не оновився
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 text-ink-subtle">{new Date(page.updatedAt).toLocaleDateString('uk-UA')}</td>
    </tr>
  );
}
