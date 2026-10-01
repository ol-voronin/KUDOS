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
  /**
   * Той самий живий кадр, але вписаний у задану висоту (мобільна стрічка й
   * головний кадр десктопної галереї обмежені за висотою). Якщо не задано,
   * малюється `node`.
   */
  readonly compactNode?: React.ReactNode;
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
export function MediaStack({
  frames, emptyText = 'Фото готуємо', desktop = 'stack', focus,
}: {
  frames: readonly MediaFrame[];
  emptyText?: string;
  /**
   * 'stack' — усі кадри стосом (базовий одяг).
   * 'sticky' — один головний кадр + мініатюри; уся галерея вміщається в
   * екран і може липнути зліва, поки права колонка прокручується (товар).
   */
  desktop?: 'stack' | 'sticky';
  /**
   * Перемкнути галерею на кадр із цим ключем. `nonce` змінюється на кожен
   * свідомий вибір (колір, виріб), тож повторний вибір того самого кадру
   * теж спрацьовує. Сторінка при цьому НЕ прокручується — гортається лише
   * сама стрічка.
   */
  focus?: { key: string; nonce: number };
}) {
  const [zoom, setZoom] = useState<number | null>(null);
  const [dot, setDot] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focus) return;
    const index = frames.findIndex((f) => f.key === focus.key);
    if (index === -1) return;
    setDot(index);
    const el = stripRef.current;
    // Горизонтальний scrollTo на самій стрічці: scrollIntoView смикнув би
    // й сторінку по вертикалі, а саме цього ТЗ забороняє.
    if (el && el.offsetParent !== null) el.scrollTo({ left: index * el.clientWidth, behavior: 'auto' });
  }, [focus?.nonce]);

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

  /**
   * `fit` — кадр у рамці фіксованої висоти: картинка вписується
   * (`object-contain`) на кремовій підкладці, без кропу.
   */
  function frameImg(f: MediaFrame, index: number, fit = false): React.ReactNode {
    if (f.node !== undefined) {
      return (
        <div className={`bg-surface-sunken ${fit ? 'h-full w-full' : ''}`} role="img" aria-label={f.alt}>
          {fit && f.compactNode !== undefined ? f.compactNode : f.node}
        </div>
      );
    }
    const img = f.kind === 'scheme'
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={f.src} alt={f.alt} className={`mx-auto aspect-square w-full max-w-md object-contain p-8 ${fit ? 'max-h-full' : ''}`} draggable={false} />
      : fit
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={f.src} alt={f.alt} className="h-full w-full object-contain" draggable={false} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={f.src} alt={f.alt} className="h-auto w-full" draggable={false} />;
    return (
      <button
        type="button"
        onClick={() => setZoom(index)}
        aria-label={`Збільшити: ${f.alt}`}
        className={`block w-full cursor-zoom-in bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-ink ${fit ? 'h-full' : ''}`}
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

  const current = Math.min(dot, frames.length - 1);

  return (
    <div>
      {desktop === 'stack' ? (
        /* Десктоп: стос. */
        <div className="hidden flex-col gap-3 md:flex">
          {frames.map((f, i) => <div key={f.key}>{frameImg(f, i)}</div>)}
        </div>
      ) : (
        /*
          Десктоп: головний кадр + мініатюри. Висота головного кадру
          обмежена екраном — уся галерея видна разом, тож її можна тримати
          липкою зліва, а зміна кольору міняє фото на місці.
        */
        <div className="hidden md:block">
          <div className="relative h-[min(calc(100vh-12rem),44rem)]">
            {frames[current] !== undefined && frameImg(frames[current], current, true)}
            {frames.length > 1 && <Counter at={current + 1} of={frames.length} />}
          </div>
          {frames.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {frames.map((f, i) => (
                <button
                  key={f.key}
                  type="button"
                  aria-label={`Кадр ${i + 1}: ${f.alt}`}
                  aria-current={i === current ? 'true' : undefined}
                  onClick={() => setDot(i)}
                  className={[
                    'h-16 w-14 overflow-hidden rounded-card border-2 bg-surface-sunken transition',
                    i === current ? 'border-ink' : 'border-transparent hover:border-line-strong',
                  ].join(' ')}
                >
                  {f.src !== undefined
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={f.src} alt="" className="h-full w-full object-cover" draggable={false} />
                    : <span className="flex h-full w-full items-center justify-center text-[0.6rem] leading-tight text-ink-muted">Вигляд</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/*
        Мобільний: свайп-стрічка зі snap-ом і лічильником «1/N».

        `overflow-x-clip` на обгортці — страховка від горизонтального
        переповнення сторінки (аудит бачив документ до 732 px завширшки):
        що б не сталося всередині стрічки, сторінка вбік не їде.
        `overscroll-x-contain` не дає свайпу по стрічці «протекти» в жест
        «назад» браузера. Висота кадру ≤ 55 % екрана: під галереєю мають
        бути видні назва й ціна.
      */}
      <div className="relative overflow-x-clip md:hidden">
        <div
          ref={stripRef}
          onScroll={onStripScroll}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
          style={{ scrollbarWidth: 'none' }}
        >
          {frames.map((f, i) => (
            <div key={f.key} className="h-[55svh] max-h-[34rem] w-full shrink-0 snap-center">{frameImg(f, i, true)}</div>
          ))}
        </div>
        {frames.length > 1 && <Counter at={current + 1} of={frames.length} />}
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

/** Лічильник «2 / 5» поверх кадру. */
function Counter({ at, of }: { at: number; of: number }) {
  return (
    <p
      className="pointer-events-none absolute right-2 top-2 rounded-pill bg-ink/75 px-2.5 py-1 text-xs font-medium tabular-nums text-surface"
      aria-live="polite"
    >
      <span className="sr-only">Фото </span>{at} / {of}
    </p>
  );
}
