import type { Metadata } from 'next';
import { LeadsTable } from '@/features/leads/leads-table';

export const metadata: Metadata = { title: 'Заявки' };

export default function AdminLeadsPage() {
  return (
    <div>
      <h1 className="text-2xl text-ink">Заявки</h1>
      <p className="mt-2 max-w-prose text-ink-muted">
        Все, що прийшло через форму на сайті — і чи долетіло в Telegram.
      </p>
      <div className="mt-6">
        <LeadsTable />
      </div>
    </div>
  );
}
