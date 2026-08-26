import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import type { MenuItemDto } from '@dt/contracts';
import { SearchForm } from '@/features/search/search-form';
import { getChrome } from '@/lib/site-settings';
import { ButtonLink } from '@/components/ui';

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

/**
 * Шапка.
 *
 * Волосінь замість рамки, нуль заливок, назва по центру — так виглядають
 * обидва референси, і причина в них одна: шапка не товар. Єдина пляма
 * кольору тут — чорна пігулка «Каталог», яка веде туди, куди приходять за
 * покупкою; решта посилань лишаються текстом.
 */
export async function PublicHeader() {
  const { settings: site, menu } = await getChrome();
  const nav = menu.filter((m) => m.area === 'HEADER');

  return (
    <header className="sticky top-0 z-30 border-b border-ink bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5 sm:px-6">
        <ButtonLink href="/prints" size="sm" className="uppercase tracking-label">
          Каталог
        </ButtonLink>

        <Link
          href="/"
          className="font-display text-base font-bold uppercase tracking-wide text-ink sm:text-lg"
        >
          {site.brand}
        </Link>

        <nav aria-label="Основна навігація" className="ml-auto hidden items-center gap-6 md:flex">
          {nav.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="text-sm text-ink transition hover:text-ink-muted"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 md:ml-0">
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
            className="hidden text-sm text-ink transition hover:text-ink-muted sm:block"
          >
            Telegram
          </a>
          <Link href="/zayavka" className="text-sm font-semibold text-ink hover:text-ink-muted">
            Свій принт
          </Link>
        </div>
      </div>
      <div className="border-t border-line px-4 py-2 sm:px-6 lg:hidden">
        <Suspense fallback={null}><SearchForm compact /></Suspense>
      </div>
    </header>
  );
}

export async function PublicFooter() {
  const { settings: site, menu } = await getChrome();
  const columns = groupFooter(menu);

  return (
    <footer className="mt-16 border-t border-ink">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 text-sm sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <p className="label-eyebrow">Хто ми</p>
          <p className="mt-2 leading-relaxed text-ink-muted">
            Шиємо й друкуємо {site.cityIn}. Відправляємо по всій Україні.
          </p>
        </div>

        {columns.map(([title, items]) => (
          <nav key={title} aria-label={title} className="flex flex-col gap-2">
            <p className="label-eyebrow">{title}</p>
            {items.map((item) => (
              <Link key={item.id} href={item.href} className="text-ink-muted transition hover:text-ink">
                {item.label}
              </Link>
            ))}
          </nav>
        ))}

        <div className="flex flex-col gap-2">
          <p className="label-eyebrow">Звʼязок</p>
          {site.phoneDisplay && (
            <a href={`tel:${site.phone}`} className="text-ink-muted transition hover:text-ink">
              {site.phoneDisplay}
            </a>
          )}
          <a
            href={site.telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="text-ink-muted transition hover:text-ink"
          >
            Telegram: @{site.telegram}
          </a>
          {site.email && (
            <a href={`mailto:${site.email}`} className="text-ink-muted transition hover:text-ink">
              {site.email}
            </a>
          )}
        </div>
      </div>

      {/*
        Назва бренду розміром на всю ширину — замість логотипа, якого поки
        немає. Блідим тоном, бо це підпис під сторінкою, а не заголовок:
        його читають востаннє, а не першим.
      */}
      <p
        aria-hidden
        className="mx-auto max-w-7xl select-none overflow-hidden px-4 font-display text-[clamp(2.5rem,13vw,9rem)] font-bold uppercase leading-[0.8] tracking-tight text-ghost sm:px-6"
      >
        {site.brand}
      </p>

      {/*
        Реквізити продавця. Без них оферта посилається на сторону, якої на
        сайті ніде не видно — а покупець має розуміти, з ким має справу,
        не відкриваючи окремий документ.
      */}
      <div className="mt-6 border-t border-line">
        <div className="mx-auto max-w-7xl px-4 py-5 text-sm text-ink-subtle sm:px-6">
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
