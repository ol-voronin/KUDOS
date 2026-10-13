'use client';

import { useEffect } from 'react';
import { formatUAH, minor } from '@dt/contracts';
import { fireConversion, setAdsUserData } from '@/features/analytics/client';
import { ga4Purchase } from '@/features/analytics/ga4';
import { readOrder } from '@/features/analytics/order-snapshot';
import { claimPurchaseOnce, isPurchaseConfirmed } from '@/features/analytics/purchase';
import { useOrderStatus } from '../hooks/useOrderStatus';
import { Skeleton } from '@/components/ui';
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from '@/config/social';

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

  // Оплата — тільки в теги, без запису в нашу базу: її пише вебхук
  // Monobank, і другий запис подвоїв би дохід у звіті. А от Google — і
  // Analytics, і Ads — інакше про неї не дізнається: обидва теги живуть
  // тільки в браузері, а вебхук приходить на сервер.
  //
  // Момент — успішна авторизація оплати (HOLD) або будь-який стан після
  // оплати, а не лише `PAID`: див. `isPurchaseConfirmed`. Раніше подія
  // чекала на `PAID`, який при HOLD ставиться вручну через дні, і Google Ads
  // не бачив жодної покупки.
  //
  // Оберіг від повторів — `localStorage` на номер замовлення (оновлення,
  // друга вкладка, повернення з закладки) плюс `transaction_id`, за яким
  // дублі відкидають і GA4, і Google Ads.
  const purchaseConfirmed = data !== undefined && isPurchaseConfirmed(data.status, data.paymentStatus);
  const orderNumber = data?.orderNumber;
  const totalMinor = data?.totalMinor;
  useEffect(() => {
    if (!purchaseConfirmed || orderNumber === undefined || totalMinor === undefined) return;
    if (!claimPurchaseOnce(orderId)) return;
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
    // Той самий ідентифікатор, що й у GA4: номер замовлення. Він однозначно
    // відповідає замовленню і саме його адмін бачить у CRM — коригування й
    // офлайн-імпорт у Google Ads робитимуться за ним.
    const transactionId = String(orderNumber);

    setAdsUserData(snapshot?.sha256Phone);
    fireConversion('purchase', totalMinor - shippingMinor, { transactionId });
    ga4Purchase({
      transactionId,
      valueMinor: totalMinor,
      shippingMinor,
      items: snapshot?.items ?? [],
    });
  }, [purchaseConfirmed, orderId, orderNumber, totalMinor]);

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
      {INSTAGRAM_URL !== '' && view !== 'PAYMENT_FAILED' && (
        <p className="mt-6 max-w-prose text-sm leading-relaxed text-ink-muted">
          Поки друкуємо — зазирни до нас в{' '}
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="font-medium text-ink underline underline-offset-4">
            Instagram @{INSTAGRAM_HANDLE}
          </a>
          . Познач нас на фото в обновці — покажемо в сторіс.
        </p>
      )}
    </div>
  );
}
