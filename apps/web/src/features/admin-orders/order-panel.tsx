'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { formatUAH, minor, OrderStatus, type AdminOrderDto } from '@dt/contracts';
import { AdminSelect, Button, ErrorBanner, Skeleton, useToast } from '@/components/ui';
import { ApiError } from '@/lib/api-client';
import { createOrderInvoice, getOrder, updateOrderStatus } from './api';
import { STATUS_LABELS } from './orders-table';

const DELIVERY_LABELS: Record<string, string> = {
  NP_BRANCH: 'Нова Пошта, відділення',
  NP_POSTOMAT: 'Нова Пошта, поштомат',
  NP_COURIER: 'Нова Пошта, курʼєр',
  PICKUP: 'Самовивіз',
};

/**
 * Картка замовлення.
 *
 * Панель збоку, а не окрема сторінка: замовлення опрацьовують підряд, і
 * повернення до списку після кожного — це зайвий крок помножений на
 * кількість замовлень за день.
 *
 * Головна дія тут — «Виставити рахунок». Вона й тільки вона перетворює
 * замовлення на гроші, тому вона єдина заливкою, і поруч із нею написано,
 * що саме станеться: гроші заблокуються, а спишуться після збирання.
 */
export function OrderPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['admin-order', id], queryFn: () => getOrder(id) });

  useEffect(() => {
    function onKey(e: KeyboardEvent): void { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function invalidate(next: AdminOrderDto): void {
    queryClient.setQueryData(['admin-order', id], next);
    void queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
  }

  const status = useMutation({
    mutationFn: (value: OrderStatus) => updateOrderStatus(id, value),
    onSuccess: (next) => { invalidate(next); toast('Стан змінено'); },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Не вдалося змінити стан'),
  });

  const invoice = useMutation({
    mutationFn: () => createOrderInvoice(id),
    onSuccess: (result) => {
      setInvoiceUrl(result.pageUrl);
      void queryClient.invalidateQueries({ queryKey: ['admin-order', id] });
      void queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast('Рахунок виставлено — надішліть посилання покупцеві');
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Не вдалося виставити рахунок'),
  });

  const paymentUrl = invoiceUrl ?? data?.paymentPageUrl ?? null;

  return (
    <>
      <button
        type="button"
        aria-label="Закрити"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-ink/30"
      />
      <aside
        aria-label="Замовлення"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-line bg-surface p-6"
      >
        {isLoading || !data ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" delay={80} />
            <Skeleton className="h-24 w-full" delay={160} />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold uppercase text-ink">Замовлення №{data.number}</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {new Date(data.placedAt).toLocaleString('uk-UA')}
                </p>
              </div>
              <Button variant="quiet" size="sm" onClick={onClose}>Закрити</Button>
            </div>

            <section className="mt-6">
              <h3 className="label-eyebrow">Покупець</h3>
              <p className="mt-2 text-ink">{data.customer.name}</p>
              <a href={`tel:${data.customer.phone}`} className="link-sweep text-ink-muted">
                {data.customer.phone}
              </a>
            </section>

            <section className="mt-6">
              <h3 className="label-eyebrow">Доставка</h3>
              <p className="mt-2 text-ink">{DELIVERY_LABELS[data.delivery.method] ?? data.delivery.method}</p>
              {data.delivery.city !== '' && (
                <p className="text-ink-muted">{data.delivery.city}, {data.delivery.branch}</p>
              )}
              {data.delivery.recipientName !== '' && (
                <p className="mt-1 text-sm text-ink-muted">
                  Одержувач: {data.delivery.recipientName} {data.delivery.recipientPhone}
                </p>
              )}
            </section>

            <section className="mt-6">
              <h3 className="label-eyebrow">Позиції</h3>
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {data.items.map((item, i) => (
                  <li key={i} className="flex justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block text-ink">{item.printTitle}</span>
                      <span className="text-ink-muted">
                        {item.garmentName}, {item.colourName}, {item.sizeLabel} × {item.quantity}
                      </span>
                      {item.promisedLeadTimeDays !== null && (
                        <span className="block text-xs text-ink-subtle">
                          обіцяно {item.promisedLeadTimeDays} днів
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-ink">{formatUAH(minor(item.lineTotalMinor))}</span>
                  </li>
                ))}
              </ul>

              <dl className="mt-3 flex flex-col gap-1 text-sm">
                <div className="flex justify-between"><dt className="text-ink-muted">Товари</dt><dd className="tabular-nums">{formatUAH(minor(data.subtotalMinor))}</dd></div>
                {data.discountMinor > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Знижка {data.discountName ?? ''}</dt>
                    <dd className="tabular-nums text-accent">−{formatUAH(minor(data.discountMinor))}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-line pt-2 font-medium">
                  <dt className="text-ink">Разом</dt>
                  <dd className="font-display tabular-nums text-ink">{formatUAH(minor(data.totalMinor))}</dd>
                </div>
              </dl>
            </section>

            {data.note !== '' && (
              <section className="mt-6">
                <h3 className="label-eyebrow">Побажання</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{data.note}</p>
              </section>
            )}

            {error !== null && <div className="mt-6"><ErrorBanner>{error}</ErrorBanner></div>}

            <section className="mt-6">
              <h3 className="label-eyebrow">Рахунок</h3>
              {paymentUrl === null ? (
                <>
                  <Button
                    size="md"
                    full
                    className="mt-2"
                    disabled={invoice.isPending || data.status === 'CANCELLED'}
                    onClick={() => { setError(null); invoice.mutate(); }}
                  >
                    {invoice.isPending ? 'Виставляємо…' : 'Виставити рахунок'}
                  </Button>
                  <p className="mt-2 text-xs leading-relaxed text-ink-subtle">
                    Створить посилання на оплату на {formatUAH(minor(data.totalMinor))}. Гроші
                    заблокуються, а спишуться після того, як ви зберете замовлення.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 break-all rounded-card bg-surface-sunken p-3 text-sm text-ink">{paymentUrl}</p>
                  <Button
                    variant="outline"
                    size="md"
                    full
                    className="mt-2"
                    onClick={() => {
                      void navigator.clipboard.writeText(paymentUrl).then(
                        () => toast('Посилання скопійовано'),
                        () => toast('Не вдалося скопіювати — виділіть вручну'),
                      );
                    }}
                  >
                    Скопіювати посилання
                  </Button>
                  {data.paymentStatus !== null && (
                    <p className="mt-2 text-xs text-ink-subtle">Стан платежу: {data.paymentStatus}</p>
                  )}
                </>
              )}
            </section>

            <section className="mt-6">
              <h3 className="label-eyebrow">Стан замовлення</h3>
              <AdminSelect
                label=""
                value={data.status}
                onChange={(e) => { setError(null); status.mutate(e.target.value as OrderStatus); }}
                disabled={status.isPending}
              >
                {OrderStatus.options.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                ))}
              </AdminSelect>
            </section>

            {(data.utmSource !== '' || data.utmCampaign !== '') && (
              <p className="mt-6 text-xs text-ink-subtle">
                Джерело: {data.utmSource || '—'} · {data.utmCampaign || '—'}
              </p>
            )}
          </>
        )}
      </aside>
    </>
  );
}
