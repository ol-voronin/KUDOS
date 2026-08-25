'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { listLeads } from '@/features/leads/api';

const NAV_ITEMS = [
  { href: '/admin', label: 'Огляд' },
  { href: '/admin/leads', label: 'Заявки', badge: true },
  { href: '/admin/prints', label: 'Принти' },
  { href: '/admin/tsiny', label: 'Ціни' },
];

/** Not yet built — shown for the real information architecture, not clickable. */
const SOON_ITEMS = ['Замовлення', 'Колекції', 'Сторінки', 'Налаштування'];

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
