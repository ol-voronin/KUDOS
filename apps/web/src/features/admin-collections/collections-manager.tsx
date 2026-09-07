'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { slugify, type AdminCollectionDto } from '@dt/contracts';
import { PrintThumb } from '@/components/print-thumb';
import {
  AdminField, AdminTextArea, Button, ButtonLink, ConfirmButton, ErrorBanner, TableSkeleton, useToast,
} from '@/components/ui';
import { ApiError } from '@/lib/api-client';
import {
  addPrintsToCollection, createCollection, deleteCollection, listCollections,
  removePrintFromCollection, reorderCollections, updateCollection,
} from './api';
import { PrintPicker } from './print-picker';

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
                  <td className="px-3 py-2">
                    {/* Три обкладинки поруч із числом: полицю впізнають очима,
                        а не рахунком. */}
                    <div className="flex items-center gap-2.5">
                      {c.prints.length > 0 && (
                        <div className="flex -space-x-2">
                          {c.prints.slice(0, 3).map((p) => (
                            p.previewUrl
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img key={p.id} src={p.previewUrl} alt="" className="h-8 w-8 rounded-card border border-surface object-cover" />
                              : <span key={p.id} className="h-8 w-8 rounded-card border border-surface bg-surface-sunken" />
                          ))}
                        </div>
                      )}
                      <span className="tabular-nums text-ink-muted">{c.prints.length}</span>
                    </div>
                  </td>
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
  const [pickerOpen, setPickerOpen] = useState(false);

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

  const addPrints = useMutation({
    mutationFn: (printIds: string[]) => addPrintsToCollection(collection.id, printIds),
    onSuccess: (next, printIds) => {
      toast(printIds.length === 1 ? 'Принт додано' : `Додано принтів: ${printIds.length}`);
      onChanged(next);
      setPickerOpen(false);
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Не вдалося додати'),
  });

  const removePrint = useMutation({
    mutationFn: (printId: string) => removePrintFromCollection(collection.id, printId),
    onSuccess: (next) => { toast('Принт прибрано з колекції'); onChanged(next); },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Не вдалося прибрати'),
  });

  const inCollection = useMemo(() => new Set(collection.prints.map((p) => p.id)), [collection.prints]);

  return (
    <section className="rounded-card border border-line bg-surface-raised p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-ink">{collection.title}</h2>
        <div className="flex flex-wrap gap-2">
          {/* Подивитись те, що щойно зібрав, — у новій вкладці, не гублячи форму. */}
          {collection.isPublished && (
            <a
              href={`/collections/${collection.slug}`}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-pill border border-line px-4 text-sm font-medium text-ink transition hover:border-ink"
            >
              На сайті
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </a>
          )}
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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h3 className="label-eyebrow">Принти в колекції · {collection.prints.length}</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            + Додати з каталогу
          </Button>
          {/*
            Новий принт народжується у формі принта — там фото, розмір і
            породи, дублювати це в шухляді немає сенсу. Але колекція вже
            буде вибрана: людина не мусить памʼятати, звідки прийшла.
          */}
          <ButtonLink
            href={`/admin/prints/new?collectionId=${collection.id}`}
            variant="quiet"
            size="sm"
          >
            Новий принт у цю колекцію
          </ButtonLink>
        </div>
      </div>

      {collection.prints.length === 0 ? (
        <div className="mt-3 rounded-card border border-dashed border-line-strong bg-surface-sunken p-6 text-center">
          <p className="text-sm font-medium text-ink">Полиця порожня</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
            Натисни «Додати з каталогу» й відзнач принти в сітці — або створи новий одразу в цій колекції.
          </p>
        </div>
      ) : (
        /*
          Принти — обкладинками, а не рядками: колекцію звіряють очима.
          Клік по картці веде у форму принта; ✕ лише знімає з полиці,
          сам принт нікуди не зникає.
        */
        <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {collection.prints.map((p) => (
            <li key={p.id} className="group relative">
              <Link href={`/admin/prints/${p.id}`} className="block rounded-card border border-line p-1.5 transition hover:border-ink">
                <PrintThumb src={p.previewUrl} alt={p.title} />
                <p className="mt-1.5 truncate text-xs font-medium text-ink">{p.title}</p>
                <p className="text-[0.65rem] text-ink-subtle">{p.isPublished ? '● на сайті' : '○ чернетка'}</p>
              </Link>
              <button
                type="button"
                aria-label={`Прибрати ${p.title} з колекції`}
                title="Прибрати з колекції"
                onClick={() => removePrint.mutate(p.id)}
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-pill border border-line bg-surface text-xs text-ink-subtle shadow-sm transition hover:border-danger hover:text-danger"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <PrintPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        inCollectionIds={inCollection}
        onAdd={(ids) => addPrints.mutate(ids)}
        adding={addPrints.isPending}
      />
    </section>
  );
}
