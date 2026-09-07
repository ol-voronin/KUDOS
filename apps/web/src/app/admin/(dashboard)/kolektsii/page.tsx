import type { Metadata } from 'next';
import { CollectionsManager } from '@/features/admin-collections/collections-manager';
import { AdminPage } from '@/features/admin-shell/admin-shell';

export const metadata: Metadata = { title: 'Колекції' };

export default function Page() {
  return (
    <AdminPage
      title="Колекції"
      hint="Полиці вітрини: порядок тут — це порядок на сайті. Принти можна додавати прямо в колекцію або з форми принта — це той самий звʼязок."
    >
      <CollectionsManager />
    </AdminPage>
  );
}
