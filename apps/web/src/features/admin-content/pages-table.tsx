'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminPageSummaryDto } from '@dt/contracts';
import { ApiError } from '@/lib/api-client';
import { createPage, listPages } from './api';

const KEY = ['admin-pages'];

const KIND_LABEL: Record<string, string> = {
  PAGE: 'Сторінка', ARTICLE: 'Матеріал', SYSTEM: 'Системна',
};

/** Латиниця з кирилиці — щоб адресу не доводилося вигадувати вручну. */
const TRANSLIT: Readonly<Record<string, string>> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z',
  и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ь: '', ю: 'iu', я: 'ia',
  // Апостроф в українській набирають чотирма різними символами, і кожен із
  // них має зникнути, а не стати рискою: «мʼякі» — це `miaki`, не `m-iaki`.
  "'": '', '’': '', 'ʼ': '', '‘': '', '`': '',
};

export function slugify(title: string): string {
  return title.toLowerCase().split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function PagesTable() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: KEY, queryFn: listPages });
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [touchedSlug, setTouchedSlug] = useState(false);

  const create = useMutation({
    mutationFn: () => createPage({ slug, kind: 'PAGE', title }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
      setCreating(false); setTitle(''); setSlug(''); setTouchedSlug(false);
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
                Сторінка буде за адресою /{slug || '…'}
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
