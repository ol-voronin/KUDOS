'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { formatUAH, minor } from '@dt/contracts';
import { ga4RemoveFromCart, ga4ViewCart, itemFromCartLine } from '@/features/analytics/ga4';
import { ButtonLink, EmptyState, ErrorBanner, Skeleton } from '@/components/ui';
import { PrintThumb } from '@/components/print-thumb';
import { useCart } from './cart-store';
import { useCartQuote } from './use-cart-quote';

/**
 * Кошик.
 *
 * Показує рядки з локального сховища, а суми — з відповіді сервера. Тому
 * поки перерахунок у дорозі, товари вже видно, а на місці цін стоять
 * заглушки: людина бачить, що вона поклала, ще до того, як зʼявиться сума.
 *
 * Позиція, яку більше не можна купити, лишається у списку з причиною й
 * кнопкою «прибрати». Мовчки викинути її означало б, що людина побачить
 * інший підсумок і не зрозуміє, куди подівся товар.
 */
export function CartView() {
  const { lines, setQuantity, remove, ready } = useCart();
  const { data, isLoading, isError } = useCartQuote();

  /*
   * Перегляд кошика — один раз за візит на сторінку. Це перший крок, де
   * людину видно з наміром купити, і різниця між ним і початком оформлення
   * показує, скільки коштує сама сторінка кошика.
   */
  const cartSeen = useRef(false);
  useEffect(() => {
    if (data === undefined || cartSeen.current) return;
    cartSeen.current = true;
    ga4ViewCart(data.lines.map(itemFromCartLine));
  }, [data]);

  /*
   * Видалення з кошика надсилаємо ДО того, як рядок зникне: після виклику
   * `remove` дані про нього вже нема де взяти.
   */
  function removeLine(variantId: string, printSlug: string | null): void {
    const quoted = data?.lines.find((l) => l.variantId === variantId && l.printSlug === printSlug);
    if (quoted !== undefined) ga4RemoveFromCart(itemFromCartLine(quoted, 0));
    remove(variantId, printSlug);
  }

  if (ready && lines.length === 0) {
    return (
      <EmptyState
        title="Кошик порожній"
        hint="Обери принт і виріб — і він зʼявиться тут."
        action={<ButtonLink href="/prints">Дивитись каталог</ButtonLink>}
      />
    );
  }

  const quoteFor = (variantId: string, printSlug: string | null) =>
    data?.lines.find((l) => l.variantId === variantId && l.printSlug === printSlug);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,22rem)]">
      <div className="border-t border-ink">
        {lines.map((line) => {
          const q = quoteFor(line.variantId, line.printSlug);
          // Рядок без принта веде на сторінку виробу; slug виробу знає
          // сервер — доки перерахунок у дорозі, ведемо на список.
          const href = line.printSlug === null
            ? (q?.garmentSlug ? `/vyroby/${q.garmentSlug}` : '/vyroby')
            : `/prints/${line.printSlug}`;
          return (
            <div key={`${line.printSlug ?? 'blank'}-${line.variantId}`} className="flex gap-4 border-b border-line py-4">
              <Link href={href} className="w-20 shrink-0 sm:w-24">
                <PrintThumb src={q?.previewUrl || line.previewUrl} alt={q?.title ?? line.title} />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <Link href={href} className="font-medium text-ink hover:opacity-70">
                  {q?.title ?? line.title}
                </Link>
                {q === undefined
                  ? <Skeleton className="mt-1.5 h-4 w-40" />
                  : (
                    <p className="mt-1 text-sm text-ink-muted">
                      {/* Для базового одягу назва виробу вже в заголовку рядка —
                          не повторюємо її в деталях. */}
                      {[line.printSlug === null ? 'без принта' : q.garmentName, q.colourName, q.sizeLabel]
                        .filter(Boolean).join(' · ')}
                    </p>
                  )}

                {q?.blockedReason != null && (
                  <p className="mt-2 text-sm text-danger">{q.blockedReason}</p>
                )}
                {q?.leadTimeDays != null && q.blockedReason === null && (
                  <p className="mt-1 text-xs text-ink-subtle">Виготовлення {q.leadTimeDays} днів</p>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-4 pt-3">
                  <Stepper
                    value={line.quantity}
                    onChange={(n) => setQuantity(line.variantId, line.printSlug, n)}
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(line.variantId, line.printSlug)}
                    className="tap-sm text-sm text-ink-subtle underline-offset-4 hover:text-danger hover:underline"
                  >
                    Прибрати
                  </button>
                </div>
              </div>

              <div className="w-24 shrink-0 text-right sm:w-32">
                {q === undefined
                  ? <Skeleton className="ml-auto h-6 w-20" />
                  : (
                    <>
                      <p className="font-display text-lg font-bold tabular-nums text-ink">
                        {formatUAH(minor(q.lineTotalMinor))}
                      </p>
                      {q.discountMinor > 0 && (
                        <p className="mt-1 text-xs text-accent">−{formatUAH(minor(q.discountMinor))}</p>
                      )}
                    </>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-card bg-surface-sunken p-5">
          <h2 className="label-eyebrow">Разом</h2>

          {isError && <div className="mt-3"><ErrorBanner>Не вдалося порахувати кошик. Онови сторінку.</ErrorBanner></div>}

          <dl className="mt-4 flex flex-col gap-2 text-sm">
            <Row label="Товари" value={data && formatUAH(minor(data.subtotalMinor))} loading={isLoading} />
            {data != null && data.discountMinor > 0 && (
              <Row label="Знижка" value={`−${formatUAH(minor(data.discountMinor))}`} accent />
            )}
            {/*
              Доставку не вигадуємо. Тариф Нової Пошти залежить від ваги,
              обʼєму й напрямку — назвати його до створення накладної
              неможливо, а поставити правдоподібну цифру означає збрехати
              на суму, яку людина побачить на відділенні.
            */}
            <Row
              label="Доставка"
              value={data != null && data.subtotalMinor >= data.freeShippingFromMinor && data.freeShippingFromMinor > 0
                ? 'за наш рахунок'
                : 'за тарифами перевізника'}
              loading={isLoading}
            />
          </dl>

          <div className="mt-4 flex items-baseline justify-between border-t border-line-strong pt-4">
            <span className="font-medium text-ink">До сплати</span>
            {data === undefined
              ? <Skeleton className="h-8 w-28" />
              : (
                <span className="font-display text-2xl font-bold tabular-nums text-ink">
                  {formatUAH(minor(data.totalMinor))}
                </span>
              )}
          </div>

          {data != null && data.freeShippingFromMinor > 0 && data.subtotalMinor < data.freeShippingFromMinor && (
            <p className="mt-3 text-xs leading-relaxed text-ink-muted">
              Ще {formatUAH(minor(data.freeShippingFromMinor - data.subtotalMinor))} — і доставка за наш рахунок.
            </p>
          )}

          <ButtonLink
            href="/oformlennya"
            size="lg"
            full
            className={`mt-5 ${data?.purchasable === true ? '' : 'pointer-events-none opacity-50'}`}
          >
            Оформити замовлення
          </ButtonLink>

          {data?.purchasable === false && lines.length > 0 && (
            <p className="mt-2 text-center text-xs text-ink-muted">
              Прибери недоступні позиції, щоб продовжити.
            </p>
          )}

          <p className="mt-3 text-center text-xs leading-relaxed text-ink-subtle">
            Оплата не зараз: ми звіримо наявність, напишемо тобі й надішлемо рахунок.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Row({
  label, value, loading = false, accent = false,
}: { label: string; value?: string | undefined; loading?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`tabular-nums ${accent ? 'text-accent' : 'text-ink'}`}>
        {value ?? (loading ? <Skeleton className="h-4 w-20" /> : '—')}
      </dd>
    </div>
  );
}

/**
 * Кількість.
 *
 * Кнопки, а не поле вводу: у полі можна написати «3шт», «-1» і «99», і
 * кожен із цих випадків доводиться перехоплювати. Дві кнопки не мають
 * недійсного стану взагалі.
 */
function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center rounded-pill border border-line">
      <button
        type="button"
        aria-label="Менше"
        onClick={() => onChange(value - 1)}
        className="tap-sm flex h-9 w-9 items-center justify-center text-lg leading-none text-ink hover:bg-surface-sunken"
      >
        −
      </button>
      <span aria-live="polite" className="w-8 text-center text-sm font-medium tabular-nums text-ink">{value}</span>
      <button
        type="button"
        aria-label="Більше"
        disabled={value >= 5}
        onClick={() => onChange(value + 1)}
        className="tap-sm flex h-9 w-9 items-center justify-center text-lg leading-none text-ink hover:bg-surface-sunken disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
