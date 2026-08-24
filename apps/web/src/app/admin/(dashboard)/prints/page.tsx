import type { Metadata } from 'next';
import { PrintsTable } from '@/features/admin-prints/prints-table';

export const metadata: Metadata = { title: 'Принти' };

export default function AdminPrintsPage() {
  return (
    <div>
      <h1 className="text-2xl text-ink">Принти</h1>
      <p className="mt-2 max-w-prose text-ink-muted">
        Те, що змінюється щотижня. Вироби, тканини й розміри живуть у сіді — вони
        змінюються двічі на рік, і окремий екран для них себе не окупить.
      </p>
      <div className="mt-6">
        <PrintsTable />
      </div>
    </div>
  );
}
