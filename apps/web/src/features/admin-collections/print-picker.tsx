'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Drawer, Skeleton } from '@/components/ui';
import { PrintThumb } from '@/components/print-thumb';
import { listPrints } from '@/features/admin-prints/api';

/**
 * Вибір принтів у колекцію — сіткою, а не текстовим пошуком наосліп.
 *
 * Колекцію збирають ОЧИМА: «ці шість — на полицю Vintage». Людина мусить
 * бачити обкладинки всіх принтів одразу, відзначати кілька за раз і лише
 * потім тиснути «Додати». Пошук лишається, але як фільтр над сіткою, а не
 * як єдині двері.
 *
 * Принти, які вже в колекції, показуються, але позначені й не клікаються:
 * сховати їх означало б, що людина не може звірити, чи «той самий» уже тут.
 */
export function PrintPicker({
  open, onClose, inCollectionIds, onAdd, adding,
}: {
  open: boolean;
  onClose: () => void;
  inCollectionIds: ReadonlySet<string>;
  onAdd: (printIds: string[]) => void;
  adding: boolean;
}) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  // Всі принти однією сторінкою: їх десятки, не тисячі, і сітка з прокруткою
  // працює краще за пагінацію в шухляді.
  const { data, isLoading } = useQuery({
    queryKey: ['admin-print-picker', q],
    queryFn: () => listPrints({ ...(q.trim() ? { q: q.trim() } : {}), perPage: 100 }),
    staleTime: 10_000,
    enabled: open,
  });

  const items = useMemo(() => data?.items ?? [], [data]);

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAdd(): void {
    if (selected.size === 0) return;
    onAdd([...selected]);
    setSelected(new Set());
    setQ('');
  }

  function handleClose(): void {
    setSelected(new Set());
    setQ('');
    onClose();
  }

  return (
    <Drawer open={open} onClose={handleClose} title="Додати принти в колекцію">
      {/* Прокручується тіло шухляди; смуга дії липне до її низу через sticky. */}
      <div className="flex min-h-full flex-col">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Фільтр за назвою…"
          aria-label="Фільтр принтів"
          className="h-11 w-full rounded-card border border-line bg-surface-raised px-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-ink"
        />

        <div className="mt-4 grid flex-1 auto-rows-min grid-cols-3 gap-3 sm:grid-cols-4">
          {isLoading && Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-square w-full" />)}

          {!isLoading && items.length === 0 && (
            <p className="col-span-full text-sm text-ink-muted">
              {q.trim() ? 'Нічого не знайшлося — спробуй іншу назву.' : 'Принтів ще немає.'}
            </p>
          )}

          {items.map((p) => {
            const already = inCollectionIds.has(p.id);
            const picked = selected.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                disabled={already}
                aria-pressed={picked}
                onClick={() => toggle(p.id)}
                title={p.title}
                className={[
                  'group relative rounded-card border-2 p-1 text-left transition',
                  already
                    ? 'cursor-default border-transparent opacity-45'
                    : picked
                      ? 'border-ink'
                      : 'border-transparent hover:border-line-strong',
                ].join(' ')}
              >
                <PrintThumb src={p.previewUrl} alt={p.title} />
                <p className="mt-1.5 truncate text-xs font-medium text-ink">{p.title}</p>
                <p className="text-[0.65rem] text-ink-subtle">
                  {already ? 'вже в колекції' : p.isPublished ? 'на сайті' : 'чернетка'}
                </p>
                {picked && (
                  <span
                    aria-hidden
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-pill bg-ink text-xs font-bold text-surface"
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/*
          Смуга дії липне до низу шухляди: сітка довга, а кнопка мусить бути
          під рукою в момент, коли відзначено останній принт, — без прокрутки
          назад.
        */}
        <div className="sticky -bottom-5 mt-4 flex items-center gap-3 border-t border-line bg-surface pb-2 pt-3">
          <Button full disabled={selected.size === 0 || adding} onClick={handleAdd}>
            {selected.size === 0
              ? 'Відзнач принти в сітці'
              : adding ? 'Додаю…' : `Додати ${selected.size} ${pluralPrints(selected.size)}`}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

function pluralPrints(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'принтів';
  const mod10 = n % 10;
  if (mod10 === 1) return 'принт';
  if (mod10 >= 2 && mod10 <= 4) return 'принти';
  return 'принтів';
}
