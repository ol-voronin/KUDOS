import type { Metadata } from 'next';
import { LeadsTable } from '@/features/leads/leads-table';
import { AdminPage } from '@/features/admin-shell/admin-shell';

export const metadata: Metadata = { title: 'Заявки' };

export default function Page() {
  return (
    <AdminPage title="Заявки" hint="Все, що прийшло через форму на сайті — і чи долетіло в Telegram.">
      <LeadsTable />
    </AdminPage>
  );
}
