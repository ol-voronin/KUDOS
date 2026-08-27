'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LiveSearch } from '@/features/search/live-search';

/**
 * Шапка.
 *
 * Розкладка взята з durnevshop, і не «на око»: там меню стоїть ліворуч,
 * назва рівно по центру, а праворуч — дії. Ніяких кнопок-пігулок біля
 * логотипа: у шапці немає жодної заливки, бо заливка в шапці конкурує з
 * фотографією героя, яка починається одразу під нею.
 *
 * Три речі, які тут вирішені свідомо:
 *
 *   1. **Шапка ховається при прокрутці вниз і повертається при русі вгору.**
 *      Герой на весь екран і сітка товарів обидва виграють від того, що
 *      їх нічим не перекрито; але щойно людина шукає навігацію — вона
 *      гортає вгору, і шапка вже там.
 *   2. **Пошук розкривається на місці**, а не веде на окрему сторінку по
 *      кліку. Сторінка результатів лишається (нею можна поділитись), але
 *      набрати запит можна звідки завгодно.
 *   3. **Телефон видно як телефон.** «Замовити дзвінок» — це дія, номер —
 *      це доказ, що по той бік є люди. Ховати номер за кнопкою означає
 *      просити довіру й нічого не давати натомість.
 */
export function HeaderBar({
  brand, nav, phone, phoneDisplay,
}: {
  brand: string;
  nav: ReadonlyArray<{ id: string; href: string; label: string }>;
  phone: string;
  phoneDisplay: string;
}) {
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    function onScroll(): void {
      const y = window.scrollY;
      // Поріг у 12px — щоб шапка не тремтіла від інерції тачпада.
      if (Math.abs(y - lastY.current) > 12) {
        setHidden(y > lastY.current && y > 160);
        lastY.current = y;
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') { setOpen(false); setMenu(false); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header
      className={[
        'sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur',
        'transition-transform duration-300 ease-out motion-reduce:transition-none',
        hidden ? '-translate-y-full' : 'translate-y-0',
      ].join(' ')}
    >
      <div className="mx-auto grid h-[4.4rem] max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6">
        <nav aria-label="Основна навігація" className="hidden items-center gap-7 md:flex">
          {nav.slice(0, 4).map((item) => (
            <Link key={item.id} href={item.href} className="nav-link">{item.label}</Link>
          ))}
        </nav>

        <button
          type="button"
          aria-label="Меню"
          aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}
          className="tap-sm flex h-9 w-9 items-center justify-center md:hidden"
        >
          <span className="relative block h-3 w-5">
            <span className={`absolute left-0 h-px w-full bg-ink transition-all duration-300 ${menu ? 'top-1.5 rotate-45' : 'top-0'}`} />
            <span className={`absolute left-0 top-1.5 h-px w-full bg-ink transition-opacity duration-200 ${menu ? 'opacity-0' : 'opacity-100'}`} />
            <span className={`absolute left-0 h-px w-full bg-ink transition-all duration-300 ${menu ? 'top-1.5 -rotate-45' : 'top-3'}`} />
          </span>
        </button>

        <Link
          href="/"
          className="justify-self-center font-display text-[0.95rem] font-medium uppercase tracking-[0.14em] text-ink sm:text-base"
        >
          {brand}
        </Link>

        <div className="flex items-center justify-end gap-5">
          <button type="button" onClick={() => setOpen((v) => !v)} className="nav-link tap-sm inline-flex items-center gap-2">
            <SearchIcon />
            <span className="hidden sm:inline">Пошук</span>
          </button>
          <Link href="/zayavka" className="nav-link hidden lg:inline">Замовити дзвінок</Link>
          <a href={`tel:${phone}`} className="whitespace-nowrap text-sm font-semibold text-ink transition-opacity hover:opacity-60">
            {phoneDisplay}
          </a>
        </div>
      </div>

      {/*
        Рядок пошуку розгортається під шапкою, не зсуваючи вміст сторінки.

        `overflow` перемикається разом зі станом: поки рядок згорнутий, він
        мусить обрізати свій вміст, інакше поле стирчить із-під шапки. Але
        щойно він розгорнувся, обрізання треба зняти — інакше воно обрізає й
        випадайку з підказками, яка висить нижче межі рядка.
      */}
      <div
        className={[
          'border-t border-line transition-[max-height] duration-300 ease-out motion-reduce:transition-none',
          open ? 'max-h-24 overflow-visible' : 'max-h-0 overflow-hidden border-t-0',
        ].join(' ')}
      >
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <LiveSearch variant="header" autoFocus={open} onNavigate={() => setOpen(false)} />
        </div>
      </div>

      {/* Мобільне меню. */}
      <div
        className={[
          'overflow-hidden border-t border-line transition-[max-height] duration-300 ease-out md:hidden motion-reduce:transition-none',
          menu ? 'max-h-96' : 'max-h-0 border-t-0',
        ].join(' ')}
      >
        <nav aria-label="Мобільна навігація" className="flex flex-col px-4 py-2 sm:px-6">
          {nav.map((item) => (
            <Link key={item.id} href={item.href} onClick={() => setMenu(false)} className="nav-link py-3">
              {item.label}
            </Link>
          ))}
          <Link href="/zayavka" onClick={() => setMenu(false)} className="nav-link py-3">Замовити дзвінок</Link>
        </nav>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg
      width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0"
    >
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  );
}
