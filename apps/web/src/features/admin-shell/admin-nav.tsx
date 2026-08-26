'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { listLeads } from '@/features/leads/api';

/**
 * Меню будується з модулів, а не з плаского списку.
 *
 * Різниця не косметична. Сайту, який нічого не продає, розділи «Принти» й
 * «Ціни» не потрібні — і вимикатися вони мають перемикачем модуля, а не
 * гілкою в репозиторії. Доки межа є тут, каталог лишається доповненням,
 * а не частиною ядра, яку неможливо відокремити.
 */
interface NavModule {
  readonly key: 'content' | 'shop';
  readonly items: ReadonlyArray<{ href: string; label: string; badge?: boolean }>;
  readonly soon: readonly string[];
}

const MODULES: readonly NavModule[] = [
  {
    key: 'content',
    items: [
      { href: '/admin', label: 'Огляд' },
      { href: '/admin/leads', label: 'Заявки', badge: true },
      { href: '/admin/storinky', label: 'Сторінки' },
    ],
    soon: ['Матеріали', 'Налаштування'],
  },
  {
    key: 'shop',
    items: [
      { href: '/admin/prints', label: 'Принти' },
      { href: '/admin/tsiny', label: 'Ціни' },
    ],
    soon: ['Замовлення', 'Колекції'],
  },
];

/**
 * Які модулі ввімкнено. Поки що обидва: сайт в установці один, і він
 * торгує. Коли зʼявиться перемикання, значення прийде з налаштувань сайту,
 * а решта коду не зміниться — саме заради цього список і винесено.
 */
const ENABLED: ReadonlySet<NavModule['key']> = new Set(['content', 'shop']);

const NAV_ITEMS = MODULES.filter((m) => ENABLED.has(m.key)).flatMap((m) => m.items);

/** Not yet built — shown for the real information architecture, not clickable. */
const SOON_ITEMS = MODULES.filter((m) => ENABLED.has(m.key)).flatMap((m) => m.soon);

export function AdminNav() {
  const pathname = usePathname();
  const { data } = useQuery({
    queryKey: ['admin-leads-new-count'],
    queryFn: () => listLeads('NEW', 1),
    staleTime: 30_000,
  });

  return (
    <nav aria-label="Адмін-навігація" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = item.href === '/admin' ? pathname === '/admin' : pathname?.startsWith(item.href);
        const newCount = item.badge ? data?.total ?? 0 : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'flex items-center justify-between rounded-card px-3 py-2 text-sm font-medium transition',
              active ? 'bg-ink text-surface' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
            ].join(' ')}
          >
            <span>{item.label}</span>
            {item.badge && newCount > 0 && (
              <span
                className={[
                  'ml-2 flex h-5 min-w-5 items-center justify-center rounded-pill px-1.5 text-xs font-bold',
                  active ? 'bg-surface text-ink' : 'bg-accent text-surface',
                ].join(' ')}
              >
                {newCount}
              </span>
            )}
          </Link>
        );
      })}
      <div className="mt-4 flex flex-col gap-1 border-t border-line pt-4">
        {SOON_ITEMS.map((label) => (
          <span key={label} className="rounded-card px-3 py-2 text-sm font-medium text-ink-subtle" aria-disabled="true">
            {label}
          </span>
        ))}
      </div>
    </nav>
  );
}
