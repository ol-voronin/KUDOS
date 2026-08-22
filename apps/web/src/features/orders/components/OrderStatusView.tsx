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

const STATUS_TONE: Record<string, string> = {
  PENDING_PAYMENT: 'bg-accent-soft text-accent-strong',
  PAID: 'bg-info-soft text-info',
  IN_PRODUCTION: 'bg-info-soft text-info',
  SHIPPED: 'bg-info-soft text-info',
  COMPLETED: 'bg-ok-soft text-ok',
  CANCELLED: 'bg-danger-soft text-danger',
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
    <div aria-live="polite">
      <h1 className="text-2xl text-ink">Замовлення №{data.orderNumber}</h1>
      <span
        className={[
          'mt-3 inline-flex rounded-pill px-3 py-1 text-sm font-semibold',
          STATUS_TONE[data.status] ?? 'bg-surface-sunken text-ink-subtle',
        ].join(' ')}
      >
        {STATUS_LABELS[data.status] ?? data.status}
      </span>
      <p className="mt-3 text-lg font-semibold text-ink">{formatUAH(minor(data.totalMinor))}</p>
      {data.status === 'PENDING_PAYMENT' && (
        <p className="mt-4 text-sm text-ink-muted">
          Сторінка оновиться автоматично, щойно ми отримаємо підтвердження оплати.
        </p>
      )}
    </div>
  );
}
