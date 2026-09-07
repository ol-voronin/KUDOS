'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminNav } from './admin-nav';

/**
 * Каркас адмінки.
 *
 * Двох речей тут раніше не було, і обидві коштували щодня.
 *
 * Перша — телефон. Бічна колонка була `w-60` без жодної точки зламу, тож на
 * екрані 390px вона зʼїдала дві третини ширини, а таблиці під нею їхали
 * вбік разом зі сторінкою. Тепер вузький екран отримує шухляду, яка
 * зачиняється клавішею Esc і сама зникає при переході.
 *
 * Друга — місце для назви екрана й дій. Кожна сторінка малювала власний
 * `<h1>`, і шість копій одного блока встигли розʼїхатися в трьох. Тепер
 * заголовок і кнопки живуть у верхній смузі, однаковій на всіх екранах.
 */
export function AdminShell({
  brand, email, logout, children,
}: { brand: string; email: string; logout: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Перехід закриває шухляду: інакше вона лишається поверх нової сторінки.
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="flex min-h-screen bg-surface">
      <a href="#admin-main" className="skip-link">До змісту</a>

      {/* Затемнення тільки для шухляди — на широкому екрані його немає. */}
      {open && (
        <button
          type="button"
          aria-label="Закрити меню"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink/30 lg:hidden"
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-line bg-surface px-3 py-5',
          'transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <p className="label-eyebrow mb-5 px-3">{brand} · адмін</p>
        {/*
          Сайт — у новій вкладці: з адмінки на вітрину ходять постійно
          («а як воно виглядає?»), і губити при цьому відкритий екран
          редагування — найдорожча з дрібниць.
        */}
        <a
          href="/"
          target="_blank"
          rel="noopener"
          className="mb-4 mx-3 inline-flex items-center gap-1.5 rounded-pill border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:border-ink"
        >
          Відкрити сайт
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
        </a>
        <AdminNav />
        <div className="mt-auto flex flex-col items-start gap-2 border-t border-line pt-4">
          <p className="px-3 text-xs text-ink-subtle">{email}</p>
          {logout}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface/95 px-4 py-2 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            className="tap-sm inline-flex min-h-9 items-center gap-2 rounded-pill border border-line px-3 text-sm font-medium text-ink"
          >
            <span aria-hidden>☰</span> Меню
          </button>
          <span className="label-eyebrow">{brand}</span>
        </div>
        <main id="admin-main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Верхня смуга екрана: назва, пояснення, дії.
 *
 * Пояснення під заголовком не декор — це єдине місце, де можна сказати, чим
 * саме цей екран відрізняється від сусіднього. У шести файлах воно вже було,
 * просто щоразу набране інакше.
 */
export function AdminPage({
  title, hint, actions, children,
}: { title: string; hint?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-ink pb-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-ink">{title}</h1>
          {hint !== undefined && <p className="mt-1.5 max-w-prose text-sm text-ink-muted">{hint}</p>}
        </div>
        {actions !== undefined && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}
