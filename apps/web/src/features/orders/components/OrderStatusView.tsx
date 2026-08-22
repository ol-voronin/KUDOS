import { formatUAH, minor } from '@dt/contracts';
import { useOrderStatus } from '../hooks/useOrderStatus';

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Очікуємо оплату',
  PAID: 'Оплачено',
  IN_PRODUCTION: 'У виробництві',
  SHIPPED: 'Відправлено',
  COMPLETED: 'Виконано',
  CANCELLED: 'Скасовано',
};

export function OrderStatusView({ orderId }: { orderId: string }) {
  const { data, isLoading, isError } = useOrderStatus(orderId);

  if (isLoading) {
    return <p className="text-ink-muted">Завантаження…</p>;
  }
  if (isError || !data) {
    return <p className="text-danger">Не вдалося знайти замовлення.</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Замовлення №{data.orderNumber}</h1>
      <p className="mt-2 text-lg text-ink">{STATUS_LABELS[data.status] ?? data.status}</p>
      <p className="mt-1 text-ink-muted">{formatUAH(minor(data.totalMinor))}</p>
      {data.status === 'PENDING_PAYMENT' && (
        <p className="mt-4 text-sm text-ink-muted">
          Сторінка оновиться автоматично, щойно ми отримаємо підтвердження оплати.
        </p>
      )}
    </div>
  );
}
