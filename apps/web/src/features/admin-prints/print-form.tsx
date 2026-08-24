'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminPrintDto, CatalogOptionDto, PrintSizeTier } from '@dt/contracts';
import { slugify, SLUG_PATTERN } from '@dt/contracts';
import { ApiError } from '@/lib/api-client';
import { PrintThumb } from '@/components/print-thumb';
import { Field, Select, SubmitButton } from '@/features/forms/fields';
import { createBreed, createPrint, deletePrint, getPrintOptions, updatePrint } from './api';

const SIZE_TIERS: ReadonlyArray<{ value: PrintSizeTier; label: string }> = [
  { value: 'MINI', label: 'MINI — до 15×20 см · 500 ₴' },
  { value: 'MEDIUM', label: 'MEDIUM — до 20×30 см · 600 ₴' },
  { value: 'MAXI', label: 'MAXI — до 35×45 см · 700 ₴' },
];

/**
 * Форма принта.
 *
 * Два рішення, які варто розуміти:
 *  • slug генерується з назви автоматично, але лишається редагованим — і
 *    перестає слідувати за назвою, щойно його зачепили руками. Інакше правка
 *    назви опублікованого принта тихо ламає адресу, на яку вже є посилання;
 *  • породу можна створити прямо тут. Без цього перший принт нової породи
 *    впирається в порожній селект.
 */
export function PrintForm({ initial }: { initial?: AdminPrintDto }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = Boolean(initial);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [sizeTier, setSizeTier] = useState<string>(initial?.sizeTier ?? 'MEDIUM');
  const [previewUrl, setPreviewUrl] = useState(initial?.previewUrl ?? '');
  const [artworkKey, setArtworkKey] = useState(initial?.artworkKey ?? '');
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? false);
  const [breedIds, setBreedIds] = useState<string[]>(initial?.breeds.map((b) => b.id) ?? []);
  const [collectionIds, setCollectionIds] = useState<string[]>(initial?.collections.map((c) => c.id) ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Slug слідує за назвою, поки його не зачепили руками.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  const { data: options } = useQuery({ queryKey: ['admin-print-options'], queryFn: getPrintOptions, staleTime: 60_000 });

  const save = useMutation({
    mutationFn: async () => {
      const dto = {
        title: title.trim(),
        slug: slug.trim(),
        sizeTier: sizeTier as PrintSizeTier,
        previewUrl: previewUrl.trim(),
        artworkKey: artworkKey.trim(),
        isPublished,
        breedIds,
        collectionIds,
      };
      return initial ? updatePrint(initial.id, dto) : createPrint(dto);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-prints'] });
      router.push(`/admin/prints/${saved.id}`);
      router.refresh();
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Не вдалося зберегти'),
  });

  const remove = useMutation({
    mutationFn: () => deletePrint(initial!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-prints'] });
      router.push('/admin/prints');
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Не вдалося видалити'),
  });

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (title.trim().length < 2) next['title'] = 'Назва принта';
    if (!SLUG_PATTERN.test(slug.trim())) next['slug'] = 'Тільки маленькі латинські літери, цифри й дефіси';
    if (!/^https?:\/\/.+/.test(previewUrl.trim())) next['previewUrl'] = 'Потрібне повне посилання, з https://';
    if (isPublished && breedIds.length === 0) {
      next['breeds'] = 'Без породи принт не потрапить у породну сторінку — головний вхід із пошуку';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;
    save.mutate();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="space-y-6">
        <Field
          id="print-title" label="Назва" required value={title}
          onChange={setTitle} error={errors['title']}
          placeholder="Коргі у стилі ренесанс"
        />

        <Field
          id="print-slug" label="Адреса сторінки" required value={slug}
          onChange={(v) => { setSlugTouched(true); setSlug(v); }}
          error={errors['slug']}
          hint={isEdit
            ? 'Змінювати в опублікованого принта не варто — старі посилання перестануть працювати.'
            : 'Заповнюється з назви автоматично. Можна виправити.'}
        />

        <Select
          id="print-size" label="Розмір принта" required
          value={sizeTier} onChange={setSizeTier} options={SIZE_TIERS}
        />

        <Field
          id="print-preview" label="Посилання на зображення" required
          value={previewUrl} onChange={setPreviewUrl} error={errors['previewUrl']}
          placeholder="https://…"
          hint="Завантаження файлів ще робимо. Поки що — пряме посилання на картинку."
        />

        <Field
          id="print-artwork" label="Де лежить продакшн-макет"
          value={artworkKey} onChange={setArtworkKey}
          placeholder="Google Drive / Принти / korgi-renesans.psd"
          hint="Не показується на сайті. Це підказка вам самим, коли настане час друкувати."
        />

        <OptionPicker
          legend="Породи" error={errors['breeds']}
          options={options?.breeds ?? []} selected={breedIds} onChange={setBreedIds}
          emptyHint="Порід ще немає — створіть першу нижче."
          onCreate={async (name) => {
            const created = await createBreed({ name, slug: slugify(name) });
            await queryClient.invalidateQueries({ queryKey: ['admin-print-options'] });
            setBreedIds((ids) => [...ids, created.id]);
          }}
        />

        <OptionPicker
          legend="Колекції"
          options={options?.collections ?? []} selected={collectionIds} onChange={setCollectionIds}
          emptyHint="Колекцій ще немає. Принт працюватиме й без них."
          note="Колекція вирішує, на яких виробах можна друкувати цей принт."
        />
      </div>

      <aside className="space-y-5 lg:sticky lg:top-8">
        <div className="rounded-card border border-line bg-surface-raised p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-subtle">Як побачить покупець</p>
          <PrintThumb src={previewUrl.trim() || null} alt={title || 'Принт'} />
          <p className="mt-3 font-medium text-ink">{title || 'Без назви'}</p>
          <p className="text-xs text-ink-subtle">/prints/{slug || '…'}</p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-card border border-line bg-surface-raised p-4">
          <input
            type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded-card border-line text-accent focus:ring-2 focus:ring-accent"
          />
          <span className="text-sm">
            <span className="font-medium text-ink">Показувати на сайті</span>
            <span className="mt-1 block leading-relaxed text-ink-muted">
              Чернетку видно тільки тут. Опублікований принт одразу зʼявляється в каталозі.
            </span>
          </span>
        </label>

        {formError && (
          <p role="alert" className="rounded-card border border-danger bg-danger-soft p-3 text-sm font-medium text-danger">
            {formError}
          </p>
        )}

        <SubmitButton pending={save.isPending}>{isEdit ? 'Зберегти' : 'Створити принт'}</SubmitButton>

        {isEdit && (
          <button
            type="button"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="min-h-11 w-full rounded-card border border-line px-4 text-sm font-medium text-danger transition hover:border-danger disabled:opacity-50"
          >
            Видалити принт
          </button>
        )}
      </aside>
    </form>
  );
}

/** Чипи-перемикачі + створення нового варіанта на місці. */
function OptionPicker({
  legend, options, selected, onChange, emptyHint, note, error, onCreate,
}: {
  legend: string;
  options: CatalogOptionDto[];
  selected: string[];
  onChange: (ids: string[]) => void;
  emptyHint: string;
  note?: string;
  error?: string | undefined;
  onCreate?: (name: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const sorted = useMemo(() => [...options].sort((a, b) => a.name.localeCompare(b.name, 'uk')), [options]);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  async function handleCreate() {
    if (!onCreate || draft.trim().length < 2 || busy) return;
    setBusy(true);
    try {
      await onCreate(draft.trim());
      setDraft('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink">{legend}</legend>
      {note && <p className="mb-2 text-sm text-ink-muted">{note}</p>}

      {sorted.length === 0 ? (
        <p className="text-sm text-ink-subtle">{emptyHint}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {sorted.map((option) => {
            const active = selected.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(option.id)}
                className={[
                  'min-h-10 rounded-pill border-2 px-3.5 text-sm font-medium transition',
                  active ? 'border-ink bg-ink text-surface' : 'border-line text-ink-muted hover:border-ink-subtle',
                ].join(' ')}
              >
                {active ? '✓ ' : ''}{option.name}
              </button>
            );
          })}
        </div>
      )}

      {onCreate && (
        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleCreate(); } }}
            placeholder="Нова порода"
            aria-label={`Додати до «${legend}»`}
            className="h-11 min-w-0 flex-1 rounded-card border border-line bg-surface-raised px-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="button" onClick={() => void handleCreate()} disabled={busy || draft.trim().length < 2}
            className="min-h-11 rounded-card border border-line px-4 text-sm font-medium text-ink transition hover:border-ink disabled:opacity-40"
          >
            Додати
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-danger">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
               strokeLinecap="round" aria-hidden="true" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" />
          </svg>
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}
