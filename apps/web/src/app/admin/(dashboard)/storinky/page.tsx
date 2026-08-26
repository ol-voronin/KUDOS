import type { Metadata } from 'next';
import { PagesTable } from '@/features/admin-content/pages-table';
import { AdminPage } from '@/features/admin-shell/admin-shell';

export const metadata: Metadata = { title: 'Сторінки · адмін' };

export default function Page() {
  return (
    <AdminPage title="Сторінки" hint="Усе, що лежить за адресою на сайті. Правки не потрапляють до людей, доки не натиснути «Опублікувати».">
      <div className="max-w-5xl"><PagesTable /></div>
    </AdminPage>
  );
}
