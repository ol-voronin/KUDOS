import type { Metadata } from 'next';
import { PublicShell } from '@/components/public-shell';
import { OrderStatusView } from '@/features/orders/components/OrderStatusView';

interface Params { params: { id: string } }

export function generateMetadata(): Metadata {
  return { title: 'Статус замовлення' };
}

export default function OrderStatusPage({ params }: Params) {
  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <OrderStatusView orderId={params.id} />
      </div>
    </PublicShell>
  );
}
