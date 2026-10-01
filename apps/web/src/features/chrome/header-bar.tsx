'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LiveSearch } from '@/features/search/live-search';
import { useCart } from '@/features/cart/cart-store';

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
export interface HeaderNavItem {
  readonly id: string;
  readonly href: string;
  readonly label: string;
  /**
   * Випадайка під пунктом. Наповнюється сервером (колекції — з каталогу),
   * тож меню в адмінці лишається пласким: редактор керує пунктами, а їхні
   * «діти» живуть у даних, які й так оновлюються самі.
   */
  readonly children?: ReadonlyArray<{ id: string; href: string; label: string }>;
}

export function HeaderBar({
  brand, nav, phone, phoneDisplay,
}: {
  brand: string;
  nav: ReadonlyArray<HeaderNavItem>;
  phone: string;
  phoneDisplay: string;
}) {
  const { count, ready } = useCart();
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
      <div className="mx-auto grid h-[4.4rem] max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <nav aria-label="Основна навігація" className="hidden items-center gap-7 md:flex">
          {nav.slice(0, 4).map((item) => (
            (item.children?.length ?? 0) === 0 ? (
              <Link key={item.id} href={item.href} className="nav-link">{item.label}</Link>
            ) : (
              /*
                Пункт із випадайкою. Сам пункт лишається ПОСИЛАННЯМ: клік веде
                на сторінку списку, як і раніше, а випадайка — прискорювач для
                миші (hover) і клавіатури (focus-within). Це важливо для
                тача: там hover немає, і без клікабельного пункта меню
                стало б глухим.

                Проміжок між пунктом і панеллю накритий `pt-3` обгортки —
                інакше курсор «випадає» в щілину, і меню зникає на півдорозі.
              */
              <div key={item.id} className="group relative">
                <Link href={item.href} className="nav-link inline-flex items-center gap-1.5">
                  {item.label}
                  <svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                    className="mt-px transition-transform duration-200 group-hover:rotate-180"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </Link>
                <div
                  className={[
                    'invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3 opacity-0',
                    'transition-[opacity,visibility] duration-150 motion-reduce:transition-none',
                    'group-hover:visible group-hover:opacity-100',
                    'group-focus-within:visible group-focus-within:opacity-100',
                  ].join(' ')}
                >
                  <div className="flex min-w-52 flex-col border border-line bg-surface py-2 shadow-lg">
                    {item.children?.map((child) => (
                      <Link
                        key={child.id}
                        href={child.href}
                        className="whitespace-nowrap px-5 py-2 text-sm text-ink-muted hover:bg-surface-sunken hover:text-ink"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )
          ))}
        </nav>

        <button
          type="button"
          aria-label="Меню"
          aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}
          className="-ml-2.5 flex h-11 w-11 items-center justify-center md:hidden"
        >
          <span className="relative block h-3 w-5">
            <span className={`absolute left-0 h-px w-full bg-ink transition-all duration-300 ${menu ? 'top-1.5 rotate-45' : 'top-0'}`} />
            <span className={`absolute left-0 top-1.5 h-px w-full bg-ink transition-opacity duration-200 ${menu ? 'opacity-0' : 'opacity-100'}`} />
            <span className={`absolute left-0 h-px w-full bg-ink transition-all duration-300 ${menu ? 'top-1.5 -rotate-45' : 'top-3'}`} />
          </span>
        </button>

        {/*
          Лого «Бабака»: векторний лок-ап (песик + напис) замість текстового
          логотипа. alt несе назву з бази — скрінрідери і SEO бачать бренд,
          навіть якщо картинка не завантажилась.
        */}
        <Link href="/" className="tap-sm justify-self-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-lockup.svg"
            alt={brand}
            className="h-8 w-auto sm:h-9"
            draggable={false}
          />
        </Link>

        {/*
          Іконки пошуку й кошика — тап-зона 44×44 (WCAG 2.5.5 / Apple HIG).
          Раніше зона дорівнювала самій іконці (17–18 px), і пальцем у неї
          промахувались. На телефоні кнопки стоять впритул, а група трохи
          заходить у бічне поле (`-mr-2.5`) — інакше дві зони по 44 px не
          влазять у колонку поруч із логотипом.
        */}
        <div className="-mr-2.5 flex items-center justify-end gap-0 sm:mr-0 sm:gap-5">
          <button
            type="button"
            aria-label="Пошук"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="nav-link inline-flex min-h-11 min-w-11 items-center justify-center gap-2"
          >
            <SearchIcon />
            <span className="hidden sm:inline">Пошук</span>
          </button>
          {/*
            «Часті запитання» замість «Замовити дзвінок».

            Кнопка дзвінка в шапці обіцяє те, чого магазин на двох людей не
            може гарантувати щохвилини, і водночас забирає місце в того, що
            справді знімає сумнів перед покупкою: строки, розміри,
            повернення. Це відповіді, а не дія — тому посилання, а не кнопка.

            Телефон із шапки прибрано на прохання замовника. Він лишився у
            футері й на сторінці контактів: там його шукають свідомо, а в
            шапці він конкурував із кошиком.
          */}
          <Link href="/faq" className="nav-link hidden whitespace-nowrap lg:inline">Часті запитання</Link>
          {/*
            Кошик. Число в дужках зʼявляється тільки коли воно є: «Кошик (0)»
            на порожньому магазині — це підпис до кнопки, яка нічого не
            робить, і він однаково гучний і тоді, коли там щось лежить.

            `ready` тут не для краси: до першого ефекту кошик ще не прочитано
            зі сховища, і без цієї перевірки лічильник блимнув би нулем на
            кожному завантаженні сторінки.
          */}
          <Link
            href="/koshyk"
            aria-label={ready && count > 0 ? `Кошик, товарів: ${count}` : 'Кошик'}
            className="nav-link inline-flex min-h-11 min-w-11 items-center justify-center gap-2 whitespace-nowrap"
          >
            <CartIcon />
            <span className="hidden sm:inline">Кошик</span>
            {ready && count > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-ink px-1.5 text-[0.7rem] font-bold tabular-nums text-surface">
                {count}
              </span>
            )}
          </Link>
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
          // 36rem, а не 96 (24rem): пункт «Колекції» тепер веде за собою
          // список колекцій, і на 24rem меню обрізалося б посередині.
          menu ? 'max-h-[36rem] overflow-y-auto' : 'max-h-0 border-t-0',
        ].join(' ')}
      >
        <nav aria-label="Мобільна навігація" className="flex flex-col px-4 py-2 sm:px-6">
          {/*
            «Усі принти» — вхід у каталог, якого в меню з адмінки не було
            (аудит 01.10.2026: каталог важко знайти з телефона). Додається
            кодом і лише якщо такого пункту ще немає в базі — щоб не двоїлось,
            коли його колись заведуть в адмінці.
          */}
          {!nav.some((item) => item.href === '/prints') && (
            <Link href="/prints" onClick={() => setMenu(false)} className="nav-link py-3">Усі принти</Link>
          )}
          {nav.map((item) => (
            <div key={item.id} className="flex flex-col">
              <Link href={item.href} onClick={() => setMenu(false)} className="nav-link py-3">
                {item.label}
              </Link>
              {/* Діти — одразу видимим списком із відступом: акордеон на
                  чотирьох пунктах — зайвий клік без виграшу місця. */}
              {(item.children?.length ?? 0) > 0 && (
                <div className="flex flex-col border-l border-line pl-4">
                  {item.children?.map((child) => (
                    <Link
                      key={child.id} href={child.href} onClick={() => setMenu(false)}
                      className="py-2 text-sm text-ink-muted"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link href="/faq" onClick={() => setMenu(false)} className="nav-link py-3">Часті запитання</Link>
          {/* На телефоні номер лишається: там натиснути на нього — це подзвонити. */}
          <a href={`tel:${phone}`} className="nav-link py-3 font-semibold">{phoneDisplay}</a>
        </nav>
      </div>
    </header>
  );
}

function CartIcon() {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"
    >
      <path d="M6 7h13l-1.4 8.4a2 2 0 0 1-2 1.6H9a2 2 0 0 1-2-1.6L5.2 4H3" />
      <circle cx="9.5" cy="20" r="1.2" /><circle cx="16.5" cy="20" r="1.2" />
    </svg>
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
