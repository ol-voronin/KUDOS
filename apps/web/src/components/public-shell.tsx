import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import type { MenuItemDto } from '@dt/contracts';
import { SearchForm } from '@/features/search/search-form';
import { getChrome } from '@/lib/site-settings';

/**
 * Меню — з бази, а не з масиву в цьому файлі.
 *
 * Правило, яке лишилося з часів масиву, нікуди не поділося: у меню тільки
 * те, що працює. Мертвий пункт читається як зламаний сайт, а не як «скоро
 * буде» — тому вимкнені пункти сюди не приїжджають узагалі, їх відсіює API.
 *
 * Групування футера — за полем `group`: колонка називається так, як її
 * назвали в адмінці, а не так, як тут колись написали руками.
 */
function groupFooter(menu: readonly MenuItemDto[]): Array<[string, MenuItemDto[]]> {
  const groups = new Map<string, MenuItemDto[]>();
  for (const item of menu) {
    if (item.area !== 'FOOTER') continue;
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }
  return [...groups.entries()];
}

export async function PublicHeader() {
  const { settings: site, menu } = await getChrome();
  const nav = menu.filter((m) => m.area === 'HEADER');

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3.5">
        <Link href="/" className="font-display text-xl font-bold tracking-tight text-ink">
          {site.brand}
        </Link>

        <nav aria-label="Основна навігація" className="hidden items-center gap-6 md:flex">
          {nav.map((item) => (
            <Link
              key={item.id}
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

export async function PublicFooter() {
  const { settings: site, menu } = await getChrome();
  const columns = groupFooter(menu);

  return (
    <footer className="border-t border-line bg-surface-sunken">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-lg font-bold text-ink">{site.brand}</p>
          <p className="mt-2 leading-relaxed text-ink-muted">
            Шиємо й друкуємо {site.cityIn}. Відправляємо по всій Україні.
          </p>
        </div>

        {columns.map(([title, items]) => (
          <nav key={title} aria-label={title} className="flex flex-col gap-2">
            <p className="font-medium text-ink">{title}</p>
            {items.map((item) => (
              <Link key={item.id} href={item.href} className="text-ink-muted transition hover:text-accent">
                {item.label}
              </Link>
            ))}
          </nav>
        ))}

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
          {site.email && (
            <a href={`mailto:${site.email}`} className="text-ink-muted transition hover:text-accent">
              {site.email}
            </a>
          )}
        </div>
      </div>

      {/*
        Реквізити продавця. Без них оферта посилається на сторону, якої на
        сайті ніде не видно — а покупець має розуміти, з ким має справу,
        не відкриваючи окремий документ.
      */}
      <div className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-5 text-sm text-ink-subtle">
          {site.legalEntityName}
          {site.taxNumber ? <> · РНОКПП {site.taxNumber}</> : null}
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
