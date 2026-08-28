'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { SearchResultDto } from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';
import { PrintThumb } from '@/components/print-thumb';

/**
 * Пошук із підказками, які зʼявляються під час набору.
 *
 * ── Що тут вирішено й чому ────────────────────────────────────────────
 *
 * **Сторінка результатів нікуди не поділася.** Підказка — це швидкий шлях
 * для того, хто вже знає, що шукає; сторінка потрібна для всього іншого:
 * нею діляться посиланням, її відкривають у новій вкладці, вона працює без
 * JavaScript і саме на ній живуть фільтри. Форма лишається формою з
 * `action="/search"`, тож Enter працює завжди — навіть якщо запит ще в
 * дорозі, а список підказок порожній.
 *
 * **Затримка 220 мс.** Запит на кожну літеру — це десять запитів на слово
 * «золотистий», з яких дев'ять нікому не потрібні. 220 мс — приблизно пауза
 * між словами при звичайному наборі: людина не встигає помітити, сервер не
 * встигає захлинутись.
 *
 * **Попередній запит скасовується.** Без `AbortController` відповіді
 * приходять у довільному порядку, і повільна відповідь на «кор» перекриває
 * швидку на «коргі» — список підказок показує не те, що набрано.
 *
 * **Порода йде першою, завжди.** «Коргі» майже ніколи не означає «принт із
 * словом коргі в назві»; воно означає «покажіть усе про коргі». Плаский
 * список за релевантністю ховав би породу серед принтів.
 *
 * **Клавіатура — не додаток, а основний шлях.** ↑/↓ ходять по списку, Enter
 * відкриває виділене (або, якщо нічого не виділено, віддає форму),
 * Escape закриває. Розмітка `combobox`/`listbox` — щоб те саме працювало й
 * зі скрінрідером.
 */

const MIN_QUERY = 2;
const DEBOUNCE_MS = 220;

interface Hit {
  readonly key: string;
  readonly href: string;
  readonly title: string;
  readonly note: string;
  readonly image: string | null;
  readonly kind: 'breed' | 'collection' | 'print';
}

const KIND_LABEL: Record<Hit['kind'], string> = {
  breed: 'Порода',
  collection: 'Колекція',
  print: 'Принт',
};

function toHits(data: SearchResultDto): Hit[] {
  return [
    ...data.breeds.slice(0, 4).map((b): Hit => ({
      key: `breed-${b.id}`,
      href: `/breeds/${b.slug}`,
      title: b.name,
      note: b.printCount > 0 ? `${b.printCount} принтів` : 'малюємо на замовлення',
      image: b.previewUrl === '' ? null : b.previewUrl,
      kind: 'breed',
    })),
    ...data.collections.slice(0, 2).map((c): Hit => ({
      key: `collection-${c.id}`,
      href: `/collections/${c.slug}`,
      title: c.title,
      note: `${c.printCount} принтів`,
      image: c.previewUrls[0] ?? null,
      kind: 'collection',
    })),
    ...data.prints.slice(0, 5).map((p): Hit => ({
      key: `print-${p.id}`,
      href: `/prints/${p.slug}`,
      title: p.title,
      note: p.inStock ? 'в наявності' : '',
      image: p.previewUrl === '' ? null : p.previewUrl,
      kind: 'print',
    })),
  ];
}

export function LiveSearch({
  autoFocus = false,
  placeholder = 'Порода, колекція, принт…',
  initial = '',
  onNavigate,
  variant = 'page',
}: {
  autoFocus?: boolean;
  placeholder?: string;
  initial?: string;
  /** Викликається після переходу — щоб шапка згорнула рядок пошуку. */
  onNavigate?: () => void;
  variant?: 'page' | 'header';
}) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState(initial);
  const [hits, setHits] = useState<readonly Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  /*
   * Підказки відкриваються тільки після того, як людина щось набрала.
   *
   * Без цього прапорця сторінка результатів відкривалася з уже розгорнутою
   * випадайкою: поле приходить із запитом в адресі, ефект бачить запит,
   * робить запит і відкриває список — поверх тих самих результатів, які на
   * сторінці й так намальовані.
   */
  const typed = useRef(false);

  useEffect(() => { if (autoFocus) field.current?.focus(); }, [autoFocus]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY) {
      setHits([]);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    const timer = setTimeout(() => {
      apiFetch(`/catalog/search?q=${encodeURIComponent(q)}`, SearchResultDto, { signal: controller.signal })
        .then((data) => {
          setHits(toHits(data));
          setCursor(-1);
          if (typed.current) setOpen(true);
        })
        // Скасований запит — не помилка, а нормальний хід подій: людина
        // набрала наступну літеру. Показувати щось у цьому місці нема чого.
        .catch(() => { if (!controller.signal.aborted) setHits([]); })
        .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    }, DEBOUNCE_MS);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  // Клік повз список закриває його. Саме `pointerdown`, а не `click`:
  // інакше закриття встигає статися раніше за перехід по підказці.
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent): void {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  function go(href: string): void {
    setOpen(false);
    onNavigate?.();
    router.push(href);
  }

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    const picked = hits[cursor];
    if (picked !== undefined) { go(picked.href); return; }
    const q = query.trim();
    if (q.length < MIN_QUERY) return;
    setOpen(false);
    onNavigate?.();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (hits.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setCursor((c) => (c + 1) % hits.length);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => (c <= 0 ? hits.length - 1 : c - 1));
    }
  }

  const showPanel = open && query.trim().length >= MIN_QUERY;
  const header = variant === 'header';

  return (
    <div ref={box} className="relative w-full">
      {/*
        У шапці лупа стоїть окремим значком ліворуч від поля — там поля як
        рамки немає взагалі. На сторінці поле має рамку, і значок мусить бути
        ВСЕРЕДИНІ неї: інакше виходить лупа, рамка й кнопка як три окремі
        предмети, між якими незрозумілий звʼязок.
      */}
      <form onSubmit={submit} role="search" action="/search" method="get" className="flex items-center gap-3">
        {header && <SearchIcon />}
        <label htmlFor={`${listId}-input`} className="sr-only">Пошук по сайту</label>
        {!header && (
          <span className="pointer-events-none absolute left-4 top-[0.95rem] text-ink-subtle">
            <SearchIcon />
          </span>
        )}
        <input
          ref={field}
          id={`${listId}-input`}
          name="q"
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          {...(cursor >= 0 && hits[cursor] ? { 'aria-activedescendant': `${listId}-${cursor}` } : {})}
          autoComplete="off"
          value={query}
          onChange={(e) => { typed.current = true; setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (typed.current) setOpen(true); }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={
            header
              ? 'h-11 w-full bg-transparent text-base text-ink placeholder:text-ink-subtle focus:outline-none'
              : 'h-13 w-full rounded-card border border-line bg-surface pl-11 pr-4 text-base text-ink placeholder:text-ink-subtle focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink'
          }
        />
        <button type="submit" className="label-eyebrow tap-sm shrink-0 text-ink hover:opacity-60">Знайти</button>
      </form>

      {showPanel && (
        <div
          /*
            У шапці поле розтягнуте на всю ширину контейнера, і випадайка,
            успадкувавши цю ширину, ставала смугою на 1300 px під пʼятьма
            рядками тексту. Список підказок читається знизу вгору по лівому
            краю — ширина понад 30rem йому нічого не дає.
          */
          className={`absolute left-0 top-full z-50 mt-2 max-h-[70vh] w-full overflow-y-auto rounded-card border border-line bg-surface shadow-[0_16px_40px_-24px_rgba(0,0,0,.45)] ${header ? 'sm:max-w-lg' : ''}`}
        >
          <ul id={listId} role="listbox" aria-label="Підказки пошуку" className="flex flex-col">
            {hits.map((hit, i) => (
              <li key={hit.key} role="option" id={`${listId}-${i}`} aria-selected={i === cursor}>
                <Link
                  href={hit.href}
                  onClick={() => { setOpen(false); onNavigate?.(); }}
                  onMouseEnter={() => setCursor(i)}
                  className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${i === cursor ? 'bg-surface-sunken' : ''}`}
                >
                  <span className="h-11 w-11 shrink-0 overflow-hidden rounded-card bg-surface-sunken">
                    <PrintThumb src={hit.image} alt="" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{hit.title}</span>
                    <span className="block truncate text-xs text-ink-subtle">
                      {KIND_LABEL[hit.kind]}{hit.note === '' ? '' : ` · ${hit.note}`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/*
            Порожній результат тут не мовчить. «Нічого не знайшли» без
            продовження — це глухий кут; а в нас на нього є справжня
            відповідь: породу, якої немає в каталозі, ми малюємо з фото.
          */}
          {hits.length === 0 && !busy && (
            <div className="px-4 py-5 text-sm">
              <p className="text-ink">Нічого не знайшли за «{query.trim()}»</p>
              <Link
                href="/svoya-ideya"
                onClick={() => { setOpen(false); onNavigate?.(); }}
                className="link-sweep mt-1 inline-block text-ink-muted"
              >
                Намалювати принт із твого фото →
              </Link>
            </div>
          )}

          {busy && hits.length === 0 && (
            <div className="flex flex-col gap-2 p-3" aria-busy="true">
              <span className="sr-only">Шукаємо…</span>
              {[0, 1, 2].map((i) => (
                <span key={i} className="skeleton block h-11 w-full" style={{ ['--skeleton-delay' as string]: `${i * 90}ms` }} />
              ))}
            </div>
          )}

          {hits.length > 0 && (
            <button
              type="button"
              onClick={() => { setOpen(false); onNavigate?.(); router.push(`/search?q=${encodeURIComponent(query.trim())}`); }}
              className="w-full border-t border-line px-4 py-3 text-left text-sm font-medium text-ink hover:bg-surface-sunken"
            >
              Показати всі результати →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0 text-ink-subtle"
    >
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  );
}
