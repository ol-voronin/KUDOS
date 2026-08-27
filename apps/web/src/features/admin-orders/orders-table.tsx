'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatUAH, minor, OrderStatus } from '@dt/contracts';
import {
  Button, Chip, EmptyState, ErrorBanner, TableSkeleton,
  TableWrap, Thead, Th, Tr, Td,
} from '@/components/ui';
import { listOrders } from './api';
import { OrderPanel } from './order-panel';

/**
 * Замовлення в адмінці.
 *
 * Екран зʼявився разом із кошиком, і не випадково: доки «Оплатити» вело
 * просто на Monobank, замовлення могло жити без інтерфейсу — гроші
 * приходили, сповіщення прилітало в Telegram. Щойно між замовленням і
 * оплатою став людський крок, замовлення в стані «нове» перестало
 * нагадувати про себе саме, і без цього списку воно просто губиться.
 *
 * Тому за замовчуванням фільтр стоїть на «нових»: це єдиний стан, який
 * вимагає дії просто зараз.
 */
export const STATUS_LABELS: Record<string, string> = {
  NEW: 'Нове',
  PENDING_PAYMENT: 'Чекає оплату',
  PAID: 'Оплачено',
  IN_PRODUCTION: 'У виробництві',
  SHIPPED: 'Відправлено',
  COMPLETED: 'Виконано',
  CANCELLED: 'Скасовано',
};

const STATUS_TONE: Record<string, 'neutral' | 'ok' | 'warn' | 'danger' | 'accent'> = {
  NEW: 'accent',
  PENDING_PAYMENT: 'warn',
  PAID: 'ok',
  IN_PRODUCTION: 'neutral',
  SHIPPED: 'neutral',
  COMPLETED: 'ok',
  CANCELLED: 'danger',
};

const FILTERS: ReadonlyArray<{ value: OrderStatus | ''; label: string }> = [
  { value: 'NEW', label: 'Нові' },
  { value: 'PENDING_PAYMENT', label: 'Чекають оплату' },
  { value: 'PAID', label: 'Оплачені' },
  { value: '', label: 'Усі' },
];

export function OrdersTable() {
  const [status, setStatus] = useState<OrderStatus | ''>('NEW');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-orders', status, page],
    queryFn: () => listOrders(status === '' ? undefined : status, page),
  });

  const pages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Фільтр замовлень" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={status === f.value}
            onClick={() => { setStatus(f.value); setPage(1); }}
            className={`tap-sm rounded-pill border px-4 py-2 text-sm transition-colors ${
              status === f.value ? 'border-ink bg-ink text-surface' : 'border-line text-ink hover:border-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isError && <ErrorBanner>Не вдалося завантажити замовлення.</ErrorBanner>}
      {isLoading && <TableSkeleton rows={5} cols={5} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title="Тут порожньо"
          hint={status === 'NEW' ? 'Нових замовлень немає — усі опрацьовані.' : 'Замовлень із таким станом немає.'}
        />
      )}

      {data && data.items.length > 0 && (
        <TableWrap>
          <Thead>
            <Th>№</Th>
            <Th>Покупець</Th>
            <Th>Позицій</Th>
            <Th>Сума</Th>
            <Th>Стан</Th>
            <Th>Коли</Th>
            <Th />
          </Thead>
          <tbody>
            {data.items.map((o) => (
              <Tr key={o.id}>
                <Td><span className="font-medium tabular-nums text-ink">№{o.number}</span></Td>
                <Td>
                  <span className="block text-ink">{o.customerName}</span>
                  <a href={`tel:${o.customerPhone}`} className="text-sm text-ink-muted hover:underline">
                    {o.customerPhone}
                  </a>
                </Td>
                <Td><span className="tabular-nums">{o.itemCount}</span></Td>
                <Td><span className="tabular-nums font-medium text-ink">{formatUAH(minor(o.totalMinor))}</span></Td>
                <Td>
                  <Chip tone={STATUS_TONE[o.status] ?? 'neutral'}>{STATUS_LABELS[o.status] ?? o.status}</Chip>
                </Td>
                <Td>
                  <span className="whitespace-nowrap text-sm text-ink-muted">
                    {new Date(o.placedAt).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </Td>
                <Td>
                  <Button variant="quiet" size="sm" onClick={() => setOpenId(o.id)}>Відкрити</Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <Button variant="quiet" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Назад
          </Button>
          <span className="text-ink-muted">Сторінка {page} з {pages}</span>
          <Button variant="quiet" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Далі →
          </Button>
        </div>
      )}

      {openId !== null && <OrderPanel id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
