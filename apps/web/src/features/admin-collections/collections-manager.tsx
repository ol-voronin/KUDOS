'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { slugify, type AdminCollectionDto } from '@dt/contracts';
import { PrintThumb } from '@/components/print-thumb';
import {
  AdminField, AdminTextArea, Button, ConfirmButton, ErrorBanner, TableSkeleton, useToast,
} from '@/components/ui';
import { ApiError } from '@/lib/api-client';
import { listPrints } from '@/features/admin-prints/api';
import {
  addPrintToCollection, createCollection, deleteCollection, listCollections,
  removePrintFromCollection, reorderCollections, updateCollection,
} from './api';

/**
 * Розділ «Колекції»: список + картка обраної на одному екрані.
 *
 * Колекцій — десяток, і окремі сторінки на кожну дали б лише зайві
 * переходи. Тут усе поруч: порядок стрілками (він і є порядок на вітрині),
 * публікація, тексти й принти колекції.
 *
 * Принти додаються прямо тут — пошуком по каталогу. Це другі двері до того
 * самого звʼязку, що у формі принта: Даша збирає колекцію як ціле, а не
 * бігає по шести формах.
 */
export function CollectionsManager() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-collections'],
    queryFn: listCollections,
    staleTime: 10_000,
  });

  const items = data?.items ?? [];
  const selected = items.find((c) => c.id === selectedId) ?? null;

  function refresh(next?: AdminCollectionDto): void {
    if (next) {
      queryClient.setQueryData(['admin-collections'], (prev: { items: AdminCollectionDto[] } | undefined) => (
        prev ? { items: prev.items.map((c) => (c.id === next.id ? next : c)) } : prev
      ));
    }
    void queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
  }

  const reorder = useMutation({
    mutationFn: reorderCollections,
    onSuccess: (list) => { queryClient.setQueryData(['admin-collections'], list); },
    onError: () => toast('Не вдалося змінити порядок'),
  });

  function move(id: string, delta: -1 | 1): void {
    const ids = items.map((c) => c.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [pulled] = next.splice(from, 1);
    if (pulled === undefined) return;
    next.splice(to, 0, pulled);
    reorder.mutate(next);
  }

  return (
    <div className="flex flex-col gap-6">
      {isLoading && <TableSkeleton rows={5} cols={4} />}
      {isError && <ErrorBanner>Не вдалося завантажити колекції.</ErrorBanner>}

      {data && (
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[46rem] border-collapse bg-surface-raised text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-subtle">
                <th className="w-20 px-3 py-2.5 font-bold">Порядок</th>
                <th className="px-3 py-2.5 font-bold">Назва</th>
                <th className="px-3 py-2.5 font-bold">Принтів</th>
                <th className="px-3 py-2.5 font-bold">Стан</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {items.map((c, i) => (
                <tr
                  key={c.id}
                  className={`border-b border-line last:border-0 ${c.id === selectedId ? 'bg-surface-sunken' : ''}`}
                >
                  <td className="px-3 py-2">
                    {/* Стрілки, а не перетягування: рухів тут два на місяць,
                        і кнопки працюють із клавіатури без жодної бібліотеки. */}
                    <div className="flex gap-1">
                      <button
                        type="button" aria-label={`Підняти ${c.title}`} disabled={i === 0 || reorder.isPending}
                        onClick={() => move(c.id, -1)}
                        className="flex h-8 w-8 items-center justify-center rounded-card border border-line text-ink disabled:opacity-30"
                      >↑</button>
                      <button
                        type="button" aria-label={`Опустити ${c.title}`} disabled={i === items.length - 1 || reorder.isPending}
                        onClick={() => move(c.id, 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-card border border-line text-ink disabled:opacity-30"
                      >↓</button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => { setSelectedId(c.id); setCreating(false); }}
                      className="text-left font-medium text-ink hover:underline"
                    >
                      {c.title}
                    </button>
                    <p className="text-xs text-ink-subtle">/collections/{c.slug}</p>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-ink-muted">{c.prints.length}</td>
                  <td className="px-3 py-2">
                    <span
                      className={[
                        'inline-flex items-center gap-1.5 rounded-card px-2 py-1 text-xs font-semibold',
                        c.isPublished ? 'bg-ok-soft text-ok' : 'bg-surface-sunken text-ink-muted',
                      ].join(' ')}
                    >
                      {c.isPublished ? '● На сайті' : '○ Чернетка'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => { setSelectedId(c.id); setCreating(false); }}
                      className="text-sm font-medium text-ink hover:underline"
                    >
                      Відкрити
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!creating && (
        <div>
          <Button variant="outline" onClick={() => { setCreating(true); setSelectedId(null); }}>
            Нова колекція
          </Button>
        </div>
      )}

      {creating && <CreateForm onDone={(created) => { refresh(); setCreating(false); setSelectedId(created.id); }} onCancel={() => setCreating(false)} />}

      {selected && (
        <CollectionCard
          key={selected.id}
          collection={selected}
          onChanged={refresh}
          onDeleted={() => { setSelectedId(null); refresh(); }}
        />
      )}
    </div>
  );
}

function CreateForm({ onDone, onCancel }: { onDone: (c: AdminCollectionDto) => void; onCancel: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  const create = useMutation({
    mutationFn: () => createCollection({ title, slug, description: '', isPublished: false }),
    onSuccess: (c) => { toast('Колекцію створено — чернеткою'); onDone(c); },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Не вдалося створити'),
  });

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface-raised p-4"
      onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
    >
      <AdminField
        label="Назва" id="collection-title" value={title}
        onChange={(e) => { setTitle(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }}
      />
      <AdminField
        label="Адреса (slug)" id="collection-slug" value={slug}
        onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
      />
      <div className="flex gap-2 pb-0.5">
        <Button type="submit" disabled={title.trim().length < 2 || create.isPending}>Створити</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Скасувати</Button>
      </div>
    </form>
  );
}

function CollectionCard({
  collection, onChanged, onDeleted,
}: {
  collection: AdminCollectionDto;
  onChanged: (next?: AdminCollectionDto) => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(collection.title);
  const [slug, setSlug] = useState(collection.slug);
  const [description, setDescription] = useState(collection.description);
  const [printQuery, setPrintQuery] = useState('');

  const dirty = title !== collection.title || slug !== collection.slug || description !== collection.description;

  const save = useMutation({
    mutationFn: () => updateCollection(collection.id, { title, slug, description }),
    onSuccess: (next) => { toast('Збережено'); onChanged(next); },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Не вдалося зберегти'),
  });

  const publish = useMutation({
    mutationFn: (isPublished: boolean) => updateCollection(collection.id, { isPublished }),
    onSuccess: (next) => {
      toast(next.isPublished ? 'Колекція на сайті' : 'Колекцію сховано в чернетки');
      onChanged(next);
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Не вдалося змінити стан'),
  });

  const removeCollection = useMutation({
    mutationFn: () => deleteCollection(collection.id),
    onSuccess: () => { toast('Колекцію видалено'); onDeleted(); },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Не вдалося видалити'),
  });

  const addPrint = useMutation({
    mutationFn: (printId: string) => addPrintToCollection(collection.id, printId),
    onSuccess: (next) => { toast('Принт додано'); onChanged(next); },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Не вдалося додати'),
  });

  const removePrint = useMutation({
    mutationFn: (printId: string) => removePrintFromCollection(collection.id, printId),
    onSuccess: (next) => { toast('Принт прибрано з колекції'); onChanged(next); },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Не вдалося прибрати'),
  });

  // Пошук принтів для додавання: той самий адмінський список, що на екрані
  // «Принти». Уже привʼязані відсіюються тут — двічі додавати нема чого.
  const search = useQuery({
    queryKey: ['admin-collection-print-search', printQuery],
    queryFn: () => listPrints({ q: printQuery }),
    enabled: printQuery.trim().length >= 2,
    staleTime: 10_000,
  });
  const inCollection = useMemo(() => new Set(collection.prints.map((p) => p.id)), [collection.prints]);
  const candidates = (search.data?.items ?? []).filter((p) => !inCollection.has(p.id)).slice(0, 6);

  return (
    <section className="rounded-card border border-line bg-surface-raised p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-ink">{collection.title}</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={collection.isPublished ? 'outline' : 'primary'}
            disabled={publish.isPending}
            onClick={() => publish.mutate(!collection.isPublished)}
          >
            {collection.isPublished ? 'Сховати з сайту' : 'Опублікувати'}
          </Button>
          {/*
            Видалення працює лише для порожньої колекції — сервер відмовить,
            якщо в ній є принти, і ця відмова показується як є.
          */}
          <ConfirmButton
            label="Видалити"
            question="Точно видалити колекцію?"
            onConfirm={() => removeCollection.mutate()}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <AdminField label="Назва" id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <AdminField
          label="Адреса (slug)" id="edit-slug" value={slug} onChange={(e) => setSlug(e.target.value)}
          {...(collection.isPublished
            ? { hint: 'Колекція опублікована: зміна адреси зламає посилання, які вже розійшлися.' }
            : {})}
        />
      </div>
      <div className="mt-3">
        <AdminTextArea
          label="Опис" id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
          hint="Один-два рядки: видно на плитці колекції та в пошуку."
        />
      </div>
      {dirty && (
        <div className="mt-3">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Зберегти зміни</Button>
        </div>
      )}

      <h3 className="label-eyebrow mt-6">Принти в колекції · {collection.prints.length}</h3>
      {collection.prints.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">Поки порожньо. Знайди принт нижче й додай.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {collection.prints.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-card border border-line p-2">
              <div className="w-10 shrink-0"><PrintThumb src={p.previewUrl} alt={p.title} /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{p.title}</p>
                <p className="text-xs text-ink-subtle">{p.isPublished ? 'на сайті' : 'чернетка'}</p>
              </div>
              <button
                type="button"
                aria-label={`Прибрати ${p.title}`}
                onClick={() => removePrint.mutate(p.id)}
                className="tap-sm px-2 text-sm text-ink-subtle hover:text-danger"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <AdminField
          label="Додати принт" id="print-search" value={printQuery}
          onChange={(e) => setPrintQuery(e.target.value)}
          hint="Почніть вводити назву — покажемо збіги з каталогу."
        />
        {printQuery.trim().length >= 2 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {search.isLoading && <p className="text-sm text-ink-subtle">Шукаю…</p>}
            {search.data && candidates.length === 0 && (
              <p className="text-sm text-ink-subtle">Нічого нового не знайшлося.</p>
            )}
            {candidates.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { addPrint.mutate(p.id); setPrintQuery(''); }}
                className="flex items-center gap-3 rounded-card border border-line p-2 text-left hover:border-ink"
              >
                <div className="w-9 shrink-0"><PrintThumb src={p.previewUrl} alt={p.title} /></div>
                <span className="text-sm font-medium text-ink">{p.title}</span>
                <span className="ml-auto text-xs text-ink-subtle">додати →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
