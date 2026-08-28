'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Панель, що виїжджає збоку.
 *
 * Чому саме вона, а не окрема сторінка й не `<details>` на місці:
 *
 *   · **не сторінка** — усе, що тут показують (розмірна сітка, деталі
 *     замовлення), людина дивиться, не втрачаючи того, що робила. Перехід
 *     на сторінку означає повернення назад і пошук того самого місця;
 *   · **не розгортання на місці** — таблиця розмірів на сім колонок
 *     розсовує картку товару вдвічі, і кнопка купівлі їде за екран рівно
 *     тоді, коли розмір нарешті обрано.
 *
 * Доступність тут не косметика: панель — це модальне вікно. Фокус іде
 * всередину при відкритті й повертається на кнопку при закритті, Escape
 * закриває, а `aria-modal` каже скрінрідеру, що решта сторінки зараз не
 * має значення.
 */
export function Drawer({
  open, onClose, title, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);

    // Сторінка під панеллю не має прокручуватись: інакше на телефоні
    // «прокрутка» всередині панелі непомітно перетворюється на прокрутку
    // сторінки, і людина губить місце, куди повернеться.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      returnTo.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Закрити"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-ink/40 animate-[fade-in_.2s_ease-out]"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-line bg-surface focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold uppercase text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="tap-sm -mr-2 flex h-9 w-9 shrink-0 items-center justify-center text-ink hover:opacity-60"
            aria-label="Закрити"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
