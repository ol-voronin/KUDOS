import Link from 'next/link';
import type { ReactNode } from 'react';
import { site } from '@/config/site';

/**
 * Розділи, яких ще немає, лишаються видимими (це реальна інформаційна
 * архітектура), але неклікабельними — жодного href на сторінку, що дасть 404.
 */
const SOON_ITEMS = ['Вироби', 'Подарунок'];

/** Те, що вже працює. */
const LIVE_ITEMS = [
  { href: '/prints', label: 'Каталог' },
  { href: '/collections', label: 'Колекції' },
  { href: '/svoya-ideya', label: 'Своя ідея' },
];

export function PublicHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="font-display text-xl font-bold tracking-tight text-ink">
          {site.brand}
        </Link>

        <nav aria-label="Основна навігація" className="hidden items-center gap-6 md:flex">
          {SOON_ITEMS.map((label) => (
            <span key={label} className="text-sm font-medium text-ink-subtle" aria-disabled="true">
              {label}
            </span>
          ))}
          {LIVE_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-ink transition hover:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={site.telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden min-h-11 items-center rounded-card border border-line px-4 text-sm font-medium text-ink transition hover:border-ink sm:flex"
          >
            Telegram
          </a>
          <Link
            href="/zayavka"
            className="flex min-h-11 items-center rounded-card bg-ink px-4 text-sm font-semibold text-surface transition hover:bg-ink/90"
          >
            Залишити заявку
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-ink-muted">
        <p>{site.brand}{site.city ? ` · ${site.city}` : ''}</p>
        {site.phoneDisplay && <p>{site.phoneDisplay}</p>}
        <nav aria-label="Додаткова навігація" className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/prints" className="text-ink transition hover:text-accent">Усі принти</Link>
          <Link href="/collections" className="text-ink transition hover:text-accent">Колекції</Link>
          <Link href="/zayavka" className="text-ink transition hover:text-accent">Залишити заявку</Link>
          <Link href="/svoya-ideya" className="text-ink transition hover:text-accent">Своя ідея</Link>
          <a href={site.telegramUrl} target="_blank" rel="noreferrer" className="text-ink transition hover:text-accent">Telegram</a>
        </nav>
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main" className="skip-link">До змісту</a>
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <PublicFooter />
      </div>
    </>
  );
}
