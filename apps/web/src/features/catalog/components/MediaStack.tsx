'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface MediaFrame {
  readonly key: string;
  readonly src?: string;
  readonly alt: string;
  /** 'photo' — прямокутний кадр у своїй пропорції; 'scheme' — квадратна схема на підкладці. */
  readonly kind?: 'photo' | 'scheme';
  /**
   * Живий кадр замість картинки — наприклад, авто-мокап принта на виробі,
   * який міняється разом з обраним кольором. Малюється як повноцінний кадр
   * стоса/стрічки; зум по кліку для нього не вмикається (це вже композиція,
   * а не файл, який можна показати більшим).
   */
  readonly node?: React.ReactNode;
}

/**
 * Галерея товару без слайдера.
 *
 * Десктоп: усі кадри стосом на всю ширину лівої колонки — сторінку просто
 * гортаєш, як у великих магазинів одягу. Слайдер тут ховав би фото за
 * кліками, а фото — це і є товар. Мобільний: горизонтальна свайп-стрічка з
 * крапками — нативний скрол зі snap-ом, без стрілок і бібліотек.
 *
 * Кадри показуються У СВОЇЙ пропорції (фотосесія знята вертикальними
 * А4-кадрами) — жодного квадратного кропу. Квадратні «схеми» крою
 * позначаються kind: 'scheme' і малюються на світлій підкладці з полями.
 *
 * Клік по кадру відкриває його на весь екран (портал у body — всередині
 * sticky-обгорток fixed живе в чужому stacking context).
 */
export function MediaStack({ frames, emptyText = 'Фото готуємо' }: {
  frames: readonly MediaFrame[];
  emptyText?: string;
}) {
  const [zoom, setZoom] = useState<number | null>(null);
  const [dot, setDot] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);

  // Стрілки гортають лише справжні картинки: живий node-кадр у зумі не має чого показати.
  const zoomable = frames.map((f, i) => (f.src !== undefined ? i : -1)).filter((i) => i !== -1);
  useEffect(() => {
    if (zoom === null) return;
    function step(from: number, dir: 1 | -1): number {
      const at = zoomable.indexOf(from);
      return zoomable[(at + dir + zoomable.length) % zoomable.length] ?? from;
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setZoom(null);
      if (e.key === 'ArrowRight') setZoom((i) => (i === null ? i : step(i, 1)));
      if (e.key === 'ArrowLeft') setZoom((i) => (i === null ? i : step(i, -1)));
    }
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [zoom, frames.length]);

  if (frames.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center bg-surface-sunken p-6">
        <span className="text-sm text-ink-subtle">{emptyText}</span>
      </div>
    );
  }

  function frameImg(f: MediaFrame, index: number): React.ReactNode {
    if (f.node !== undefined) {
      return <div className="bg-surface-sunken" role="img" aria-label={f.alt}>{f.node}</div>;
    }
    const img = f.kind === 'scheme'
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={f.src} alt={f.alt} className="mx-auto aspect-square w-full max-w-md object-contain p-8" draggable={false} />
      // eslint-disable-next-line @next/next/no-img-element
      : <img src={f.src} alt={f.alt} className="h-auto w-full" draggable={false} />;
    return (
      <button
        type="button"
        onClick={() => setZoom(index)}
        aria-label={`Збільшити: ${f.alt}`}
        className="block w-full cursor-zoom-in bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        {img}
      </button>
    );
  }

  function onStripScroll(): void {
    const el = stripRef.current;
    if (!el) return;
    setDot(Math.round(el.scrollLeft / el.clientWidth));
  }

  const zoomed = zoom === null ? null : frames[Math.min(zoom, frames.length - 1)];

  return (
    <div>
      {/* Десктоп: стос. */}
      <div className="hidden flex-col gap-3 md:flex">
        {frames.map((f, i) => <div key={f.key}>{frameImg(f, i)}</div>)}
      </div>

      {/* Мобільний: свайп-стрічка з крапками. */}
      <div className="md:hidden">
        <div
          ref={stripRef}
          onScroll={onStripScroll}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
          style={{ scrollbarWidth: 'none' }}
        >
          {frames.map((f, i) => (
            <div key={f.key} className="w-full shrink-0 snap-center">{frameImg(f, i)}</div>
          ))}
        </div>
        {frames.length > 1 && (
          <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
            {frames.map((f, i) => (
              <span
                key={f.key}
                className={`h-1.5 rounded-full transition-all ${i === dot ? 'w-5 bg-ink' : 'w-1.5 bg-line-strong'}`}
              />
            ))}
          </div>
        )}
      </div>

      {zoomed && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${zoomed.alt} — збільшене фото`}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/90 animate-[fade-in_.15s_ease-out]"
          onClick={() => setZoom(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomed.src} alt={zoomed.alt} className="max-h-[92vh] max-w-[92vw] cursor-zoom-out object-contain" />
          {zoomable.length > 1 && (
            <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-sm tabular-nums text-white/80">
              {zoomable.indexOf(zoom ?? 0) + 1} / {zoomable.length} · гортай стрілками
            </p>
          )}
          <button
            type="button"
            onClick={() => setZoom(null)}
            aria-label="Закрити"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center text-white hover:opacity-70"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
