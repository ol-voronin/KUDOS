'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnyBlock, BlockList as BlockListSchema, type AdminPageDto } from '@dt/contracts';
import { ApiError } from '@/lib/api-client';
import { BlockList } from './block-list';
import { getPage, publishPage, restoreVersion, saveDraft, unpublishPage, updatePage } from './api';

/**
 * Редактор сторінки.
 *
 * Стан чернетки живе тут одним обʼєктом, а не по полю на компонент. Через це
 * «є незбережені зміни» — це одне порівняння, а не спроба вгадати, що саме
 * змінилося; а збереження надсилає сторінку цілком, і сервер ніколи не бачить
 * її наполовину оновленою.
 */

interface DraftState {
  title: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  noindex: boolean;
  blocks: AnyBlock[];
}

function draftFrom(page: AdminPageDto): DraftState {
  // Немає чернетки — беремо опубліковане: редагування завжди починається з
  // того, що зараз бачать люди, а не з порожнечі.
  const source = page.draft ?? page.published;
  return {
    title: source?.title ?? page.title,
    excerpt: source?.excerpt ?? '',
    seoTitle: source?.seoTitle ?? '',
    seoDescription: source?.seoDescription ?? '',
    noindex: source?.noindex ?? false,
    blocks: source?.blocks ?? [],
  };
}

const inputCls =
  'w-full rounded-card border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none';
const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-ink-subtle';

export function PageEditor({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const key = ['admin-page', id];

  const { data: page, isLoading, isError } = useQuery({ queryKey: key, queryFn: () => getPage(id) });

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [slug, setSlug] = useState('');
  const [saved, setSaved] = useState<DraftState | null>(null);

  useEffect(() => {
    if (!page) return;
    const next = draftFrom(page);
    setDraft(next);
    setSaved(next);
    setSlug(page.slug);
  }, [page]);

  const dirty = useMemo(
    () => draft !== null && saved !== null && JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );

  // Захист від закриття вкладки з незбереженою роботою. Найдешевша страховка
  // з можливих: без неї година правок зникає від випадкового Cmd+W.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const save = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error('нічого зберігати');
      return saveDraft(id, { ...draft, coverUrl: '', note: '' });
    },
    onSuccess: (fresh) => { qc.setQueryData(key, fresh); setSaved(draft); },
  });

  const publish = useMutation({
    mutationFn: async () => {
      // Спершу зберігаємо, потім публікуємо. Інакше «Опублікувати» після
      // правок опублікувало б попередню чернетку — і людина побачила б на
      // сайті не те, що щойно написала.
      if (dirty && draft) await saveDraft(id, { ...draft, coverUrl: '', note: '' });
      return publishPage(id);
    },
    onSuccess: (fresh) => { qc.setQueryData(key, fresh); setSaved(draft); },
  });

  const unpublish = useMutation({
    mutationFn: () => unpublishPage(id),
    onSuccess: (fresh) => qc.setQueryData(key, fresh),
  });

  const restore = useMutation({
    mutationFn: (versionId: string) => restoreVersion(id, versionId),
    onSuccess: (fresh) => { qc.setQueryData(key, fresh); const next = draftFrom(fresh); setDraft(next); setSaved(next); },
  });

  const rename = useMutation({
    mutationFn: () => updatePage(id, { slug }),
    onSuccess: (fresh) => { qc.setQueryData(key, fresh); router.refresh(); },
  });

  if (isLoading || !draft || !page) return <p className="text-ink-muted">Завантаження…</p>;
  if (isError) return <p className="text-danger">Не вдалося завантажити сторінку.</p>;

  const invalid = draft.blocks.filter((b) => !AnyBlock.safeParse(b).success).length;
  const listOk = BlockListSchema.safeParse(draft.blocks).success;
  const canPublish = invalid === 0 && listOk && draft.title.trim() !== '';
  const error = save.error ?? publish.error ?? unpublish.error ?? restore.error ?? rename.error;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/admin/storinky" className="text-sm text-ink-muted hover:underline">← Усі сторінки</Link>
          <h1 className="mt-1 truncate font-display text-2xl font-bold text-ink">{draft.title || page.slug}</h1>
          <p className="mt-1 text-sm text-ink-subtle">
            <a href={`/${page.slug}`} target="_blank" rel="noreferrer" className="underline">/{page.slug}</a>
            {page.isSystem && <span className="ml-2 rounded-card bg-surface-sunken px-1.5 py-0.5 text-xs">системна</span>}
            {!page.isPublished && <span className="ml-2 rounded-card bg-sun-soft px-1.5 py-0.5 text-xs text-sun-ink">не на сайті</span>}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/storinky/${id}/preview`}
            className="rounded-card border-2 border-line px-4 py-2 text-sm font-semibold text-ink-muted transition hover:border-ink hover:text-ink"
          >
            Переглянути
          </Link>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
            className="rounded-card border-2 border-ink px-4 py-2 text-sm font-semibold text-ink transition disabled:opacity-40"
          >
            {save.isPending ? 'Зберігаю…' : dirty ? 'Зберегти чернетку' : 'Збережено'}
          </button>
          <button
            type="button"
            onClick={() => publish.mutate()}
            disabled={!canPublish || publish.isPending}
            title={canPublish ? '' : 'Спершу заповніть блоки, позначені червоним'}
            className="rounded-card bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-40"
          >
            {publish.isPending ? 'Публікую…' : 'Опублікувати'}
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-card border border-danger px-4 py-3 text-sm text-danger" role="alert">
          {error instanceof ApiError ? error.message : 'Не вдалося зберегти'}
        </p>
      )}

      {page.revalidateError !== '' && (
        <p className="rounded-card bg-sun-soft px-4 py-3 text-sm text-sun-ink" role="status">
          Опубліковано, але сайт не встиг оновити сторінку: {page.revalidateError}.
          Зміни зʼявляться самі протягом кількох хвилин.
        </p>
      )}
      {page.revalidateError === '' && page.revalidatedAt && (
        <p className="text-sm text-ink-subtle">
          Сайт оновив сторінку {new Date(page.revalidatedAt).toLocaleString('uk-UA')}.
        </p>
      )}

      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="mb-4 font-display text-lg font-bold text-ink">Про сторінку</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="p-title">Назва</label>
            <input
              id="p-title" type="text" className={`${inputCls} mt-1`} value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <p className="mt-1 text-xs text-ink-subtle">Видно в хлібних крихтах і в списку сторінок.</p>
          </div>
          <div>
            <label className={labelCls} htmlFor="p-slug">Адреса</label>
            <div className="mt-1 flex gap-2">
              <input
                id="p-slug" type="text" className={inputCls} value={slug}
                disabled={page.isSystem}
                onChange={(e) => setSlug(e.target.value)}
              />
              <button
                type="button" onClick={() => rename.mutate()}
                disabled={page.isSystem || slug === page.slug || rename.isPending}
                className="shrink-0 rounded-card border border-line px-3 text-sm text-ink-muted disabled:opacity-40"
              >Змінити</button>
            </div>
            <p className="mt-1 text-xs text-ink-subtle">
              {page.isSystem
                ? 'Системну адресу міняти не можна: на неї посилаються код і документи.'
                : 'Стара адреса автоматично перенаправлятиме на нову — позиції в пошуку не загубляться.'}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="mb-1 font-display text-lg font-bold text-ink">Як сторінка виглядає в пошуку</h2>
        <p className="mb-4 text-sm text-ink-muted">Порожні поля означають «взяти зі сторінки» — дублювати нічого не треба.</p>
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls} htmlFor="p-seo-title">Заголовок у пошуку</label>
            <input
              id="p-seo-title" type="text" className={`${inputCls} mt-1`} value={draft.seoTitle}
              onChange={(e) => setDraft({ ...draft, seoTitle: e.target.value })}
            />
            <SeoHint value={draft.seoTitle} soft={60} hard={70} what="заголовок" />
          </div>
          <div>
            <label className={labelCls} htmlFor="p-seo-desc">Опис у пошуку</label>
            <textarea
              id="p-seo-desc" rows={3} className={`${inputCls} mt-1`} value={draft.seoDescription}
              onChange={(e) => setDraft({ ...draft, seoDescription: e.target.value })}
            />
            <SeoHint value={draft.seoDescription} soft={155} hard={180} what="опис" />
          </div>
          <div>
            <label className={labelCls} htmlFor="p-excerpt">Короткий опис</label>
            <textarea
              id="p-excerpt" rows={2} className={`${inputCls} mt-1`} value={draft.excerpt}
              onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
            />
            <p className="mt-1 text-xs text-ink-subtle">Показується в списках і підставляється в опис, якщо його не заповнити.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox" className="h-4 w-4" checked={draft.noindex}
              onChange={(e) => setDraft({ ...draft, noindex: e.target.checked })}
            />
            Приховати від пошукових систем
          </label>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold text-ink">Блоки</h2>
          {invalid > 0 && (
            <span className="text-sm text-danger">Не заповнено блоків: {invalid}</span>
          )}
        </div>
        <BlockList blocks={draft.blocks} onChange={(blocks) => setDraft({ ...draft, blocks })} />
      </section>

      <History page={page} onRestore={(v) => restore.mutate(v)} busy={restore.isPending} />

      {!page.isSystem && page.isPublished && (
        <div>
          <button
            type="button" onClick={() => unpublish.mutate()} disabled={unpublish.isPending}
            className="text-sm text-danger underline"
          >
            Прибрати сторінку з сайту
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Довжина поля в пошуку.
 *
 * Це не «оцінка SEO», а факт: Google обрізає довший заголовок посеред слова.
 * Тому попередження мʼяке до межі й виразне після — рішення лишається за
 * автором, але наслідок він бачить одразу.
 */
function SeoHint({ value, soft, hard, what }: { value: string; soft: number; hard: number; what: string }) {
  const n = value.trim().length;
  if (n === 0) return <p className="mt-1 text-xs text-ink-subtle">Порожньо — візьмемо {what} зі сторінки.</p>;
  if (n > hard) return <p className="mt-1 text-xs text-danger">{n} символів — Google обріже. Варто скоротити приблизно до {soft}.</p>;
  if (n > soft) return <p className="mt-1 text-xs text-sun-ink">{n} символів — трохи довше за {soft}, може обрізатися.</p>;
  return <p className="mt-1 text-xs text-ink-subtle">{n} із приблизно {soft} символів.</p>;
}

function History({
  page, onRestore, busy,
}: { page: AdminPageDto; onRestore: (versionId: string) => void; busy: boolean }) {
  const LABEL: Record<string, string> = {
    DRAFT: 'чернетка', PUBLISHED: 'на сайті', ARCHIVED: 'в історії',
  };
  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h2 className="mb-3 font-display text-lg font-bold text-ink">Історія</h2>
      <ul className="divide-y divide-line text-sm">
        {page.history.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span className="w-10 shrink-0 tabular-nums text-ink-subtle">№{v.number}</span>
            <span className="w-24 shrink-0 text-ink-muted">{LABEL[v.status] ?? v.status}</span>
            <span className="text-ink-subtle">{new Date(v.createdAt).toLocaleString('uk-UA')}</span>
            {v.authorEmail && <span className="text-ink-subtle">{v.authorEmail}</span>}
            {v.note && <span className="text-ink-muted">{v.note}</span>}
            {v.status === 'ARCHIVED' && (
              <button
                type="button" onClick={() => onRestore(v.id)} disabled={busy}
                className="ml-auto text-ink underline disabled:opacity-40"
              >
                Повернути в чернетку
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-subtle">
        Повернення кладе стару версію в чернетку, а не одразу на сайт: спершу подивіться, що саме повертаєте.
      </p>
    </section>
  );
}
