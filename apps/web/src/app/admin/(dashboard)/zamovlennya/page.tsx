import type { Metadata } from 'next';
import { OrdersTable } from '@/features/admin-orders/orders-table';
import { AdminPage } from '@/features/admin-shell/admin-shell';

export const metadata: Metadata = { title: 'Замовлення' };

export default function Page() {
  return (
    <AdminPage
      title="Замовлення"
      hint="Нові замовлення приходять неоплаченими. Звірте наявність, напишіть покупцеві — і виставте рахунок."
    >
      <OrdersTable />
    </AdminPage>
  );
}
