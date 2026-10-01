'use client';

import { useEffect } from 'react';
import { formatUAH, minor } from '@dt/contracts';
import { fireConversion } from '@/features/analytics/client';
import { ga4Purchase } from '@/features/analytics/ga4';
import { readOrder } from '@/features/analytics/order-snapshot';
import { useOrderStatus } from '../hooks/useOrderStatus';
import { Skeleton } from '@/components/ui';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Прийнято, перевіряємо наявність',
  PENDING_PAYMENT: 'Очікуємо оплату',
  PAID: 'Оплачено',
  IN_PRODUCTION: 'У виробництві',
  SHIPPED: 'Відправлено',
  COMPLETED: 'Виконано',
  CANCELLED: 'Скасовано',
};

const STATUS_TONE: Record<string, string> = {
  NEW: 'bg-surface-sunken text-ink',
  PENDING_PAYMENT: 'bg-accent-soft text-accent-strong',
  PAID: 'bg-info-soft text-info',
  IN_PRODUCTION: 'bg-info-soft text-info',
  SHIPPED: 'bg-info-soft text-info',
  COMPLETED: 'bg-ok-soft text-ok',
  CANCELLED: 'bg-danger-soft text-danger',
};

/**
 * Стан замовлення сам по собі не каже всього про гроші: HOLD лишає
 * замовлення в `PENDING_PAYMENT`, а невдала оплата переводить його в
 * `CANCELLED`. Тут уточнюємо підпис за станом рахунку, щоб людина не
 * дивилась на «Очікуємо оплату», коли вже заплатила, і на «Скасовано»,
 * коли просто не пройшла картка.
 */
type View = 'HOLD' | 'PAYMENT_FAILED' | 'REFUNDED' | null;

function paymentView(status: string, paymentStatus: string | null | undefined): View {
  if (status === 'PENDING_PAYMENT' && paymentStatus === 'HOLD') return 'HOLD';
  if (status === 'CANCELLED' && (paymentStatus === 'FAILURE' || paymentStatus === 'EXPIRED')) return 'PAYMENT_FAILED';
  if (status === 'CANCELLED' && paymentStatus === 'REVERSED') return 'REFUNDED';
  return null;
}

const VIEW_LABELS: Record<Exclude<View, null>, string> = {
  HOLD: 'Оплату заблоковано',
  PAYMENT_FAILED: 'Оплата не пройшла',
  REFUNDED: 'Оплату повернуто',
};

const VIEW_TONE: Record<Exclude<View, null>, string> = {
  HOLD: 'bg-info-soft text-info',
  PAYMENT_FAILED: 'bg-danger-soft text-danger',
  REFUNDED: 'bg-surface-sunken text-ink',
};

export function OrderStatusView({ orderId }: { orderId: string }) {
  const { data, isLoading, isError } = useOrderStatus(orderId);

  // Оплата — тільки в теги, без запису в нашу базу: її вже записав вебхук
  // Monobank, і другий запис подвоїв би дохід у звіті. А от Google — і
  // Analytics, і Ads — інакше про неї не дізнається: обидва теги живуть
  // тільки в браузері, а вебхук приходить на сервер.
  //
  // Оберіг від повторів у `sessionStorage`: людина цілком може оновити
  // сторінку статусу, і кожне оновлення інакше було б новою покупкою. Для
  // GA4 є ще друга лінія — `transaction_id`, за яким він відкидає дублі
  // сам, навіть якщо сховище недоступне.
  useEffect(() => {
    if (data?.status !== 'PAID') return;
    const key = `dt.conv.${orderId}`;
    try {
      if (window.sessionStorage.getItem(key) !== null) return;
      window.sessionStorage.setItem(key, '1');
    } catch { /* сховище недоступне — тоді просто спрацює один раз за візит */ }
    /*
     * Дві різні суми, і плутати їх дорого.
     *
     * У GA4 йде повна сума замовлення разом із доставкою — так того чекає
     * сам GA4, а доставка додається окремим полем, щоб її було видно.
     * У Google Ads як цінність конверсії йде сума БЕЗ доставки: ставки
     * рахуються від неї, і платити за клік, вважаючи маржею чужу
     * пересилку, — найшвидший спосіб зробити прибуткову кампанію
     * збитковою.
     */
    const snapshot = readOrder(orderId);
    const shippingMinor = snapshot?.shippingMinor ?? 0;

    fireConversion('purchase', data.totalMinor - shippingMinor);
    ga4Purchase({
      transactionId: String(data.orderNumber),
      valueMinor: data.totalMinor,
      shippingMinor,
      items: snapshot?.items ?? [],
    });
  }, [data?.status, data?.totalMinor, data?.orderNumber, orderId]);

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }
  if (isError || !data) {
    return <p className="text-danger">Не вдалося знайти замовлення.</p>;
  }

  const view = paymentView(data.status, data.paymentStatus);

  return (
    <div aria-live="polite">
      <h1 className="font-display text-2xl font-bold uppercase text-ink">Замовлення №{data.orderNumber}</h1>
      <span
        className={[
          'mt-3 inline-flex rounded-pill px-3 py-1 text-sm font-semibold',
          (view === null ? STATUS_TONE[data.status] : VIEW_TONE[view]) ?? 'bg-surface-sunken text-ink-subtle',
        ].join(' ')}
      >
        {view === null ? STATUS_LABELS[data.status] ?? data.status : VIEW_LABELS[view]}
      </span>
      <p className="mt-3 text-lg font-semibold text-ink">{formatUAH(minor(data.totalMinor))}</p>
      {/*
        Найважливіший текст на цій сторінці — той, що для стану `NEW`.
        Людина щойно натиснула «Замовити» й не побачила платіжної форми;
        якщо їй не сказати чому, вона вирішить, що замовлення не пройшло, і
        оформить його вдруге.
      */}
      {data.status === 'NEW' && (
        <div className="mt-4 max-w-prose text-sm leading-relaxed text-ink-muted">
          <p>
            Дякуємо! Замовлення прийняте, зараз нічого платити не треба.
            Ми звіряємо наявність і найближчим часом напишемо тобі — після
            підтвердження надішлемо рахунок на оплату.
          </p>
          <p className="mt-2">Номер замовлення варто зберегти — за ним нас швидше знайти.</p>
        </div>
      )}
      {data.status === 'PENDING_PAYMENT' && view === null && (
        <p className="mt-4 text-sm text-ink-muted">
          Сторінка оновиться автоматично, щойно ми отримаємо підтвердження оплати.
        </p>
      )}
      {view === 'HOLD' && (
        <div className="mt-4 max-w-prose text-sm leading-relaxed text-ink-muted">
          <p>
            Дякуємо! Гроші заблоковані на твоїй картці, але ще не списані.
            Ми звіримо наявність і лише тоді їх спишемо.
          </p>
          <p className="mt-2">Номер замовлення варто зберегти — за ним нас швидше знайти.</p>
        </div>
      )}
      {view === 'PAYMENT_FAILED' && (
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-muted">
          Гроші з картки не списані. Спробуй оформити замовлення ще раз або напиши нам
          з номером замовлення — допоможемо.
        </p>
      )}
      {data.status === 'PAID' && (
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-muted">
          Дякуємо! Оплату отримали.
        </p>
      )}
    </div>
  );
}
