import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { CollectionListDto, type MenuItemDto } from '@dt/contracts';
import { HeaderBar, type HeaderNavItem } from '@/features/chrome/header-bar';
import { serverFetchOrNull } from '@/lib/server-api';
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

  /*
   * Випадайка «Колекції» наповнюється каталогом, а не адмінкою меню.
   *
   * Пункти меню редагують руками, колекції публікують у своєму розділі —
   * зшивати їх удруге означало б два джерела правди й меню, що бреше після
   * кожної нової колекції. Тому діти вʼїжджають сюди в момент рендеру.
   * Якщо каталог мовчить — пункт лишається звичайним посиланням.
   */
  const collections = await serverFetchOrNull('/catalog/collections', CollectionListDto, 300);
  const children = (collections?.items ?? []).map((c) => ({
    id: c.id, href: `/collections/${c.slug}`, label: c.title,
  }));

  const items: HeaderNavItem[] = nav.map((m) => ({
    id: m.id, href: m.href, label: m.label,
    ...(m.href === '/collections' && children.length > 0 ? { children } : {}),
  }));

  return (
    <Suspense fallback={<div className="h-[4.4rem] border-b border-line" />}>
      <HeaderBar
        brand={site.brand}
        nav={items}
        phone={site.phone}
        phoneDisplay={site.phoneDisplay}
      />
    </Suspense>
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
              <Link key={item.id} href={item.href} className="link-sweep w-fit text-ink-muted">
                {item.label}
              </Link>
            ))}
          </nav>
        ))}

        <div className="flex flex-col gap-2">
          <p className="label-eyebrow">Звʼязок</p>
          {site.phoneDisplay && (
            <a href={`tel:${site.phone}`} className="link-sweep w-fit text-ink-muted">
              {site.phoneDisplay}
            </a>
          )}
          <a
            href={site.telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="link-sweep w-fit text-ink-muted"
          >
            Telegram: @{site.telegram}
          </a>
          {site.email && (
            <a href={`mailto:${site.email}`} className="link-sweep w-fit text-ink-muted">
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
        className="mx-auto max-w-7xl select-none overflow-hidden px-4 font-display text-[clamp(2rem,11vw,7.5rem)] font-extrabold uppercase leading-[0.9] tracking-tight text-ghost sm:px-6"
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
      {/*
        Посилання «до змісту» — і чому воно тут утретє переписане.

        Перша версія ховала його зсувом (`-translate-y-20`) — зсув
        застосовувався до елемента в потоці, і на прокрученій сторінці
        пігулка лишалася на видноті. Друга ховала `sr-only` і показувала на
        `focus:` — надійніше, але `:focus` спрацьовує не лише від Tab: його
        дає і клік мишею, і програмний `element.focus()`, який роутер робить
        після переходу між сторінками. Саме звідси бралося «зʼявляється час
        від часу»: людина клікала посилання в меню, сторінка мінялася, фокус
        сідав на перший інтерактивний елемент — а перший елемент тут це воно.

        `focus-visible` — це рівно та умова, заради якої посилання існує:
        браузер вмикає його тільки тоді, коли навігація справді клавіатурна.
        Мишка й програмний фокус його більше не показують.
      */}
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-pill focus-visible:bg-ink focus-visible:px-5 focus-visible:py-3 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-surface"
      >
        До змісту
      </a>
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
