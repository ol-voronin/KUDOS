import Link from 'next/link';
import type { ReactNode } from 'react';
import { site } from '@/config/site';

/**
 * Not-yet-built sections stay visible (they're the real information
 * architecture) but non-interactive — no href to a page that 404s.
 */
const SOON_ITEMS = ['Колекції', 'Вироби', 'Своя ідея', 'Подарунок'];

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
        </nav>

        <a
          href={site.telegramUrl}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center rounded-card border border-line px-4 text-sm font-medium text-ink transition hover:border-ink"
        >
          Telegram
        </a>
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
