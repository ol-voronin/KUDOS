import type { Metadata } from 'next';
import { AdminPage } from '@/features/admin-shell/admin-shell';
import { Dashboard } from '@/features/admin-shell/dashboard';

export const metadata: Metadata = { title: 'Огляд · адмін' };

export default function AdminHomePage() {
  return (
    <AdminPage title="Огляд" hint="Що сталося за тиждень і куди йти далі.">
      <Dashboard />
    </AdminPage>
  );
}
