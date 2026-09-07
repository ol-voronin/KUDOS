'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  OrderDraftResponseDto, formatUAH, minor, type DeliveryMethod,
} from '@dt/contracts';
import { Button, ErrorBanner, FieldShell, Skeleton, inputClass } from '@/components/ui';
import { attribution } from '@/features/analytics/client';
import { ApiError, apiFetch } from '@/lib/api-client';
import { toCartItems, useCart } from './cart-store';
import { useCartQuote } from './use-cart-quote';

const PHONE_PATTERN = /^\+380\d{9}$/;

/**
 * Оформлення: контакти, доставка, підтвердження. Оплати тут немає.
 *
 * ── Чому одна сторінка, а не три кроки ────────────────────────────────
 *
 * Полів рівно пʼять. Розбити пʼять полів на три екрани з прогресом означає
 * зробити з двох хвилин пʼять і додати три місця, де людина може піти. Крок
 * має сенс, коли на наступному екрані щось перераховується; тут не
 * перераховується нічого.
 *
 * ── Чому телефон перевіряється тут і на сервері ───────────────────────
 *
 * Тут — щоб сказати про помилку одразу, а не після відправлення. На сервері
 * — тому що клієнтську перевірку можна обійти, а телефон із помилкою
 * означає замовлення, на яке неможливо відповісти.
 */
const DELIVERY_OPTIONS: ReadonlyArray<{ value: DeliveryMethod; label: string; hint: string }> = [
  { value: 'NP_BRANCH', label: 'Відділення Нової Пошти', hint: 'Номер відділення' },
  { value: 'NP_POSTOMAT', label: 'Поштомат Нової Пошти', hint: 'Номер поштомата' },
  { value: 'NP_COURIER', label: 'Курʼєр Нової Пошти', hint: 'Вулиця, будинок, квартира' },
  { value: 'PICKUP', label: 'Самовивіз', hint: '' },
];

export function CheckoutForm() {
  const router = useRouter();
  const { lines, clear, ready } = useCart();
  const { data: quote, isLoading } = useCartQuote();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState<DeliveryMethod>('NP_BRANCH');
  const [city, setCity] = useState('');
  const [branch, setBranch] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [otherRecipient, setOtherRecipient] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const option = DELIVERY_OPTIONS.find((o) => o.value === method);
  const needsAddress = method !== 'PICKUP';

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!PHONE_PATTERN.test(phone)) {
      setError('Введи телефон у форматі +380XXXXXXXXX');
      return;
    }
    if (otherRecipient && recipientPhone !== '' && !PHONE_PATTERN.test(recipientPhone)) {
      setError('Телефон одержувача теж має бути у форматі +380XXXXXXXXX');
      return;
    }
    if (needsAddress && (city.trim() === '' || branch.trim() === '')) {
      setError('Вкажи місто й відділення');
      return;
    }

    setSending(true);
    try {
      const result = await apiFetch('/checkout/order', OrderDraftResponseDto, {
        method: 'POST',
        body: JSON.stringify({
          items: toCartItems(lines),
          customer: { name, phone, marketingConsent: false },
          delivery: {
            method,
            city: needsAddress ? city.trim() : '',
            branch: needsAddress ? branch.trim() : '',
            recipientName: otherRecipient ? recipientName.trim() : '',
            recipientPhone: otherRecipient ? recipientPhone.trim() : '',
          },
          note: note.trim(),
          attribution: attribution(),
        }),
      });
      // Кошик чистимо тільки після того, як сервер підтвердив замовлення:
      // помилка мережі не має коштувати людині зібраного кошика.
      clear();
      router.push(`/order/${result.orderId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося оформити замовлення');
      setSending(false);
    }
  }

  if (ready && lines.length === 0) {
    return (
      <p className="text-ink-muted">
        Кошик порожній. <a href="/prints" className="link-sweep text-ink">Повернутись у каталог</a>
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_minmax(0,22rem)]">
      <div className="flex flex-col gap-8">
        <section>
          <h2 className="label-eyebrow mb-4">Хто замовляє</h2>
          <div className="flex flex-col gap-4 sm:max-w-md">
            <FieldShell label="Імʼя" htmlFor="co-name">
              <input
                id="co-name" type="text" required autoComplete="name" maxLength={120}
                value={name} onChange={(e) => setName(e.target.value)}
                className={`${inputClass()} w-full`}
              />
            </FieldShell>
            <FieldShell label="Телефон" htmlFor="co-phone" hint="У форматі +380XXXXXXXXX">
              <input
                id="co-phone" type="tel" required autoComplete="tel" inputMode="tel"
                placeholder="+380XXXXXXXXX"
                value={phone} onChange={(e) => setPhone(e.target.value)}
                className={`${inputClass()} w-full`}
              />
            </FieldShell>
          </div>
        </section>

        <section>
          <h2 className="label-eyebrow mb-4">Куди везти</h2>

          <div className="flex flex-col gap-2 sm:max-w-md">
            {DELIVERY_OPTIONS.map((o) => (
              <label
                key={o.value}
                className={`flex cursor-pointer items-center gap-3 rounded-card border px-4 py-3 text-sm transition-colors ${
                  method === o.value ? 'border-ink bg-surface-sunken' : 'border-line hover:border-line-strong'
                }`}
              >
                <input
                  type="radio" name="delivery" value={o.value}
                  checked={method === o.value}
                  onChange={() => setMethod(o.value)}
                  className="h-4 w-4 accent-ink"
                />
                <span className="text-ink">{o.label}</span>
              </label>
            ))}
          </div>

          {needsAddress && (
            <div className="mt-4 flex flex-col gap-4 sm:max-w-md">
              <FieldShell label="Місто" htmlFor="co-city">
                <input
                  id="co-city" type="text" required maxLength={120}
                  autoComplete="address-level2" placeholder="Харків"
                  value={city} onChange={(e) => setCity(e.target.value)}
                  className={`${inputClass()} w-full`}
                />
              </FieldShell>
              <FieldShell
                label={option?.hint ?? 'Відділення'}
                htmlFor="co-branch"
                hint="Можна просто номер — решту знайдемо самі"
              >
                <input
                  id="co-branch" type="text" required maxLength={200}
                  value={branch} onChange={(e) => setBranch(e.target.value)}
                  className={`${inputClass()} w-full`}
                />
              </FieldShell>
            </div>
          )}

          {/*
            Одержувач іншою людиною — не рідкість, а звичайний подарунок, і
            Нова Пошта видає посилку за іменем. Поля сховані за галочкою:
            більшості вони не потрібні, а два зайві поля на касі коштують
            дорожче за одну галочку.
          */}
          <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-ink">
            <input
              type="checkbox" checked={otherRecipient}
              onChange={(e) => setOtherRecipient(e.target.checked)}
              className="h-4 w-4 accent-ink"
            />
            Отримувати буде інша людина
          </label>

          {otherRecipient && (
            <div className="mt-4 flex flex-col gap-4 sm:max-w-md">
              <FieldShell label="Імʼя одержувача" htmlFor="co-rec-name">
                <input
                  id="co-rec-name" type="text" maxLength={120}
                  value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
                  className={`${inputClass()} w-full`}
                />
              </FieldShell>
              <FieldShell label="Телефон одержувача" htmlFor="co-rec-phone">
                <input
                  id="co-rec-phone" type="tel" inputMode="tel" placeholder="+380XXXXXXXXX"
                  value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)}
                  className={`${inputClass()} w-full`}
                />
              </FieldShell>
            </div>
          )}
        </section>

        <section>
          <h2 className="label-eyebrow mb-4">Побажання</h2>
          <textarea
            rows={3} maxLength={500}
            value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Наприклад: подарунок, потрібно до пʼятниці"
            className={`${inputClass()} w-full sm:max-w-md`}
          />
        </section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-card bg-surface-sunken p-5">
          <h2 className="label-eyebrow">Замовлення</h2>

          <ul className="mt-4 flex flex-col gap-3 text-sm">
            {quote === undefined && isLoading && <li><Skeleton className="h-4 w-full" /></li>}
            {quote?.lines.map((l) => (
              <li key={`${l.printSlug ?? 'blank'}-${l.variantId}`} className="flex justify-between gap-3">
                <span className="min-w-0 text-ink-muted">
                  {l.title} <span className="text-ink-subtle">× {l.quantity}</span>
                </span>
                <span className="shrink-0 tabular-nums text-ink">{formatUAH(minor(l.lineTotalMinor))}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-baseline justify-between border-t border-line-strong pt-4">
            <span className="font-medium text-ink">До сплати</span>
            {quote === undefined
              ? <Skeleton className="h-8 w-28" />
              : (
                <span className="font-display text-2xl font-bold tabular-nums text-ink">
                  {formatUAH(minor(quote.totalMinor))}
                </span>
              )}
          </div>

          {error !== null && <div className="mt-4"><ErrorBanner>{error}</ErrorBanner></div>}

          <Button type="submit" size="lg" full className="mt-5" disabled={sending || quote?.purchasable !== true}>
            {sending ? 'Оформлюємо…' : 'Замовити'}
          </Button>

          {/*
            Головне, що людина мусить знати ДО натискання: грошей зараз не
            візьмуть. Сюрприз у вигляді платіжної форми на цьому кроці — це
            найдорожчий спосіб втратити замовлення.
          */}
          <p className="mt-3 text-xs leading-relaxed text-ink-muted">
            Зараз нічого не списується. Ми звіримо наявність, напишемо тобі й
            надішлемо рахунок — оплатиш, коли підтвердимо.
          </p>
        </div>
      </aside>
    </form>
  );
}
