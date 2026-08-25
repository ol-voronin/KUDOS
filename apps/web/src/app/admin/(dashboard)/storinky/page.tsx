import type { Metadata } from 'next';
import { PagesTable } from '@/features/admin-content/pages-table';

export const metadata: Metadata = { title: 'Сторінки · адмін' };

export default function PagesPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-ink">Сторінки</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Усе, що лежить за адресою на сайті. Правки не потрапляють до людей, доки не натиснути «Опублікувати».
      </p>
      <div className="mt-8">
        <PagesTable />
      </div>
    </div>
  );
}
