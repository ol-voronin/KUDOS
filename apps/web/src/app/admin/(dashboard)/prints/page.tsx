import type { Metadata } from 'next';
import { PrintsTable } from '@/features/admin-prints/prints-table';
import { AdminPage } from '@/features/admin-shell/admin-shell';

export const metadata: Metadata = { title: 'Принти' };

export default function Page() {
  return (
    <AdminPage title="Принти" hint="Те, що змінюється щотижня. Вироби, тканини й розміри живуть у сіді — вони змінюються двічі на рік, і окремий екран для них себе не окупить.">
      <PrintsTable />
    </AdminPage>
  );
}
