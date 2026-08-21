import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/features/auth/session';
import { LogoutButton } from '@/features/auth/logout-button';

export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect('/admin/login');

  return (
    <div className="min-h-screen bg-surface">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <span className="text-sm text-ink-muted">{session.email}</span>
        <LogoutButton />
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
