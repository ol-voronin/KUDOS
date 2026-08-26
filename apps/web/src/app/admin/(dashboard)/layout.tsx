import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/features/auth/session';
import { LogoutButton } from '@/features/auth/logout-button';
import { AdminNav } from '@/features/admin-shell/admin-nav';
import { getSettings } from '@/lib/site-settings';

export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const site = await getSettings();
  const session = await getServerSession();
  if (!session) redirect('/admin/login');

  return (
    <div className="flex min-h-screen bg-surface">
      <a href="#admin-main" className="skip-link">До змісту</a>
      <aside className="flex w-60 shrink-0 flex-col border-r border-line px-4 py-6">
        <p className="mb-6 px-3 font-display text-sm font-bold uppercase tracking-wide text-ink-subtle">
          {site.brand} · адмін
        </p>
        <AdminNav />
        <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
          <p className="px-3 text-xs text-ink-muted">{session.email}</p>
          <LogoutButton />
        </div>
      </aside>
      <main id="admin-main" className="min-w-0 flex-1 px-8 py-10">{children}</main>
    </div>
  );
}
