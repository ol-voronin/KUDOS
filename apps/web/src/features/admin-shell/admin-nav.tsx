'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin', label: 'Огляд' },
  { href: '/admin/leads', label: 'Заявки' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {NAV_ITEMS.map((item) => {
        const active = item.href === '/admin' ? pathname === '/admin' : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              'rounded-card px-3 py-1.5 text-sm font-medium transition',
              active ? 'bg-surface-sunken text-ink' : 'text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
