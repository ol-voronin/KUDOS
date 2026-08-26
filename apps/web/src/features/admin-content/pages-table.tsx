'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { slugify, type AdminPageSummaryDto, type PageKind } from '@dt/contracts';
import { ApiError } from '@/lib/api-client';
import { createPage, listPages } from './api';
import {
  Button, EmptyState, ErrorBanner, TableSkeleton, TableWrap, Thead, Th, inputClass, Chip } from '@/components/ui';

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

  if (isLoading) return <TableSkeleton rows={5} cols={4} />;
  if (isError || !data) return <ErrorBanner>Не вдалося завантажити список.</ErrorBanner>;

  return (
    <div className="flex flex-col gap-6">
      {creating ? (
        <form
          className="rounded-card border border-line bg-surface p-4"
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
        >
          <h2 className="mb-3 font-display text-lg font-bold text-ink">Нова сторінка</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="label-eyebrow">
              Назва
              <input
                type="text" required value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!touchedSlug) setSlug(slugify(e.target.value));
                }}
                className={`${inputClass()} w-full mt-1 font-normal normal-case tracking-normal`}
              />
            </label>
            <label className="label-eyebrow">
              Адреса
              <input
                type="text" required value={slug}
                onChange={(e) => { setTouchedSlug(true); setSlug(e.target.value); }}
                className={`${inputClass()} w-full mt-1 font-normal normal-case tracking-normal`}
              />
              <span className="mt-1 block font-normal normal-case tracking-normal text-ink-subtle">
                Буде за адресою {kind === 'ARTICLE' ? '/statti/' : '/'}{slug || '…'}
              </span>
            </label>
            <label className="label-eyebrow">
              Тип
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as PageKind)}
                className={`${inputClass()} w-full mt-1 font-normal normal-case tracking-normal`}
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
            <div className="mt-3">
              <ErrorBanner>
                {create.error instanceof ApiError ? create.error.message : 'Не вдалося створити'}
              </ErrorBanner>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="submit" disabled={create.isPending || slug === ''}
              className="min-h-10 rounded-pill bg-ink px-5 text-sm font-semibold text-surface transition hover:bg-ink/85 disabled:opacity-40"
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
          <Button onClick={() => setCreating(true)}>Нова сторінка</Button>
        </div>
      )}

      {data.items.length === 0 ? (
        <EmptyState
          title="Сторінок ще немає"
          hint="Головна, статті та юридичні документи живуть тут. Створіть першу — і вона зʼявиться на сайті після публікації."
          action={<Button onClick={() => setCreating(true)}>Нова сторінка</Button>}
        />
      ) : (
        <TableWrap minWidth="38rem">
          <Thead>
            <Th>Сторінка</Th>
            <Th>Тип</Th>
            <Th>Стан</Th>
            <Th>Оновлено</Th>
          </Thead>
          <tbody>
            {data.items.map((p) => <Row key={p.id} page={p} />)}
          </tbody>
        </TableWrap>
      )}
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
            ? <Chip tone="ok">на сайті</Chip>
            : <Chip>не опубліковано</Chip>}
          {page.hasDraft && (
            <Chip tone="warn">є неопубліковані зміни</Chip>
          )}
          {page.revalidateError !== '' && (
            <span title={page.revalidateError}>
              <Chip tone="danger">кеш не оновився</Chip>
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 text-ink-subtle">{new Date(page.updatedAt).toLocaleDateString('uk-UA')}</td>
    </tr>
  );
}
