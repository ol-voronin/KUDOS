import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/features/auth/session';
import { LogoutButton } from '@/features/auth/logout-button';
import { AdminShell } from '@/features/admin-shell/admin-shell';
import { getSettings } from '@/lib/site-settings';

export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const site = await getSettings();
  const session = await getServerSession();
  if (!session) redirect('/admin/login');

  return (
    <AdminShell brand={site.brand} email={session.email} logout={<LogoutButton />}>
      {children}
    </AdminShell>
  );
}
