import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { site } from '@/config/site';
import { SearchForm } from '@/features/search/search-form';

/**
 * Меню — тільки те, що працює.
 *
 * Раніше тут висіли «Вироби» і «Подарунок» як неклікабельні написи: ідея
 * була показати майбутню структуру. На практиці людина бачить пункт меню й
 * тисне на нього, а він мертвий — це читається як зламаний сайт, а не як
 * «скоро буде».
 */
const NAV = [
  { href: '/prints', label: 'Каталог' },
  { href: '/collections', label: 'Колекції' },
  { href: '/svoya-ideya', label: 'Свій принт' },
  { href: '/spivpratsia', label: 'Співпраця' },
];

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3.5">
        <Link href="/" className="font-display text-xl font-bold tracking-tight text-ink">
          {site.brand}
        </Link>

        <nav aria-label="Основна навігація" className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
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
          <div className="hidden lg:block">
            {/* useSearchParams вимагає Suspense у серверному дереві. */}
            <Suspense fallback={null}><SearchForm /></Suspense>
          </div>
          {/*
            Було просто «Telegram» і «Заявка» — назви каналу й внутрішнього
            терміна. Людина не зобовʼязана здогадуватись, що станеться після
            натискання. Тепер у кнопці написано дію.
          */}
          <a
            href={site.telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden min-h-11 items-center rounded-card border border-line px-4 text-sm font-medium text-ink transition hover:border-ink sm:flex"
          >
            Спитати в Telegram
          </a>
          <Link
            href="/zayavka"
            className="flex min-h-11 items-center rounded-card bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-strong"
          >
            Хочу принт
          </Link>
        </div>
      </div>
      <div className="border-t border-line px-6 py-2.5 lg:hidden">
        <Suspense fallback={null}><SearchForm compact /></Suspense>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-surface-sunken">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-lg font-bold text-ink">{site.brand}</p>
          <p className="mt-2 leading-relaxed text-ink-muted">
            Шиємо й друкуємо {site.cityIn}. Відправляємо по всій Україні.
          </p>
        </div>

        <nav aria-label="Каталог" className="flex flex-col gap-2">
          <p className="font-medium text-ink">Каталог</p>
          <Link href="/prints" className="text-ink-muted transition hover:text-accent">Усі принти</Link>
          <Link href="/collections" className="text-ink-muted transition hover:text-accent">Колекції</Link>
          <Link href="/svoya-ideya" className="text-ink-muted transition hover:text-accent">Свій принт із фото</Link>
        </nav>

        <nav aria-label="Компанія" className="flex flex-col gap-2">
          <p className="font-medium text-ink">Компанія</p>
          <Link href="/spivpratsia" className="text-ink-muted transition hover:text-accent">Співпраця та опт</Link>
          <Link href="/zayavka" className="text-ink-muted transition hover:text-accent">Залишити заявку</Link>
        </nav>

        <div className="flex flex-col gap-2">
          <p className="font-medium text-ink">Звʼязок</p>
          {site.phoneDisplay && (
            <a href={`tel:${site.phone}`} className="text-ink-muted transition hover:text-accent">
              {site.phoneDisplay}
            </a>
          )}
          <a
            href={site.telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="text-ink-muted transition hover:text-accent"
          >
            Telegram: @{site.telegram}
          </a>
        </div>
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
