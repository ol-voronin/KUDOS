'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  OrderDraftResponseDto, formatUAH, minor, type DeliveryMethod,
} from '@dt/contracts';
import { Button, ErrorBanner, Skeleton } from '@/components/ui';
import { attribution, hashPhone, track } from '@/features/analytics/client';
import {
  ga4AddPaymentInfo, ga4AddShippingInfo, ga4BeginCheckout, itemFromCartLine, type Ga4Item,
} from '@/features/analytics/ga4';
import { rememberOrder } from '@/features/analytics/order-snapshot';
import { ApiError, apiFetch } from '@/lib/api-client';
import { Field, TextArea } from '@/features/forms/fields';
import { phoneInputHandlers, phoneValueOnBlur } from '@/features/forms/phone-input';
import { toCartItems, useCart } from './cart-store';
import {
  FIELD_IDS, fieldError, firstInvalid, validateCheckout,
  type CheckoutErrors, type CheckoutField, type CheckoutValues,
} from './checkout-validation';
import { OrderTerms, ShippingRow, type OrderTermsSettings } from './order-terms-view';
import { useCartQuote } from './use-cart-quote';

/**
 * Оформлення: контакти, доставка, підтвердження. Якщо Monobank підключений,
 * сервер одразу виставляє HOLD-рахунок, і після оформлення ведемо людину на
 * сторінку оплати; інакше — на сторінку «дякуємо», рахунок прийде пізніше.
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
 *
 * ── Чому публічні поля, а не адмінські ────────────────────────────────
 *
 * Каса була зібрана на полях адмінки: 14 px (iOS Safari зумить сторінку на
 * фокусі), 38 px заввишки, рамка 1.28:1, помилка — одна плашка в підсумку,
 * без `aria-invalid` і звʼязку з полем (аудит 17.10.2026, 03-ux #11–12,
 * 05-a11y). Публічний `Field` усе це вже вміє: 16 px, 52 px, помилка під
 * полем через `aria-describedby`. Перевірка — на blur і при відправленні,
 * фокус — на перше поле з помилкою (`checkout-validation.ts`).
 */
const DELIVERY_OPTIONS: ReadonlyArray<{ value: DeliveryMethod; label: string; hint: string }> = [
  { value: 'NP_BRANCH', label: 'Відділення Нової Пошти', hint: 'Номер відділення' },
  { value: 'NP_POSTOMAT', label: 'Поштомат Нової Пошти', hint: 'Номер поштомата' },
  { value: 'NP_COURIER', label: 'Курʼєр Нової Пошти', hint: 'Вулиця, будинок, квартира' },
  { value: 'PICKUP', label: 'Самовивіз', hint: '' },
];

/**
 * `orderingDisabled` — превʼю-збірка: форму видно цілком (її теж правлять),
 * але кнопка неактивна. Справжній захист — у middleware.ts, кнопка лише
 * не дає натиснути й здивуватись помилці.
 */
export function CheckoutForm({
  orderingDisabled = false, settings,
}: { orderingDisabled?: boolean; settings: OrderTermsSettings }) {
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
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const values: CheckoutValues = { name, phone, method, city, branch, otherRecipient, recipientPhone };

  /*
   * Помилка поля зʼявляється, коли людина з нього пішла (blur), а не на
   * кожну літеру: червоне поле посеред набору номера — це докір за те, що
   * ще не дописав. Але щойно помилку показано, вона перераховується на
   * кожну зміну й зникає, як тільки поле стало правильним.
   */
  function check(field: CheckoutField, patch: Partial<CheckoutValues> = {}): void {
    const message = fieldError(field, { ...values, ...patch });
    setErrors((prev) => ({ ...prev, [field]: message }));
  }
  function recheck(field: CheckoutField, patch: Partial<CheckoutValues>): void {
    if (errors[field] !== undefined) check(field, patch);
  }

  const phoneField = phoneInputHandlers(phone, (v) => { setPhone(v); recheck('phone', { phone: v }); });
  const recipientPhoneField = phoneInputHandlers(recipientPhone, (v) => {
    setRecipientPhone(v);
    recheck('recipientPhone', { recipientPhone: v });
  });

  const payOnline = quote?.payOnline === true;
  const option = DELIVERY_OPTIONS.find((o) => o.value === method);
  const needsAddress = method !== 'PICKUP';

  /*
   * Початок оформлення.
   *
   * Подія `checkout_started` існувала в переліку від самого початку, але її
   * ніхто не надсилав — і воронка обривалася рівно перед касою: ми бачили,
   * скільки людей поклали річ у кошик, і скільки заплатили, але не бачили,
   * скільки дійшло до форми й пішло з неї. Саме цей відрізок і показує, чи
   * проблема в товарі, чи у формі.
   *
   * Момент — поява розрахунку, а не монтування форми: до нього невідома
   * сума, а подія без суми не дає порівняти кинуті оформлення з оплаченими.
   * Один раз за візит на сторінку: перерахунок кошика не є новим
   * оформленням.
   */
  const items: Ga4Item[] = (quote?.lines ?? []).map(itemFromCartLine);

  const checkoutSent = useRef(false);
  useEffect(() => {
    if (quote === undefined || checkoutSent.current) return;
    checkoutSent.current = true;
    track('checkout_started', { valueMinor: quote.totalMinor });
    ga4BeginCheckout(items);
  }, [quote, items]);

  /*
   * Спосіб доставки — окрема подія, і саме вона робить воронку корисною.
   * Між «почав оформлення» і «заплатив» є два кроки, на яких люди зникають
   * по-різному: один спіткнувся об доставку, другий — об оплату. Без цих
   * двох подій обидва виглядають однаково, як «не купив».
   *
   * Надсилаємо при ЗМІНІ способу, а не при кожному кліку: значення за
   * замовчуванням людина не обирала, і рахувати його вибором — брехня.
   */
  const shippingSent = useRef(false);
  function chooseMethod(next: DeliveryMethod): void {
    setMethod(next);
    // Інший спосіб — інший текст помилки для адреси («номер поштомата»).
    if (errors.branch !== undefined) check('branch', { method: next });
    if (shippingSent.current && next === method) return;
    shippingSent.current = true;
    const label = DELIVERY_OPTIONS.find((o) => o.value === next)?.label ?? next;
    ga4AddShippingInfo(label, items);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const found = validateCheckout(values);
    setErrors(found);
    const first = firstInvalid(found);
    if (first !== undefined) {
      document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }
    // Превʼю: форму можна перевірити цілком, але замовлення не йде.
    if (orderingDisabled) {
      setError('Це тестова версія сайту: замовлення тут вимкнене.');
      return;
    }

    setSending(true);
    try {
      const result = await apiFetch('/checkout/order', OrderDraftResponseDto, {
        method: 'POST',
        body: JSON.stringify({
          items: toCartItems(lines),
          customer: { name: name.trim(), phone, marketingConsent: false },
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
      /*
       * `add_payment_info` — у мить підтвердження замовлення: це останній
       * крок, який покупець робить на нашому сайті, і саме його треба
       * порівнювати з оплатою. Назва каже, чи пішов він платити одразу.
       */
      ga4AddPaymentInfo(
        result.paymentPageUrl === undefined ? 'Monobank (рахунок після підтвердження)' : 'Monobank (hold при оформленні)',
        items,
      );

      /*
       * Знімок замовлення для події покупки.
       *
       * Сторінка статусу знає суму й номер, але не знає, ЩО купили:
       * публічний ендпоінт статусу складу замовлення не віддає, і
       * розширювати його не можна — ключем там є самий лише ідентифікатор
       * замовлення. Тому перелік товарів лишається в браузері того, хто
       * замовив, і живе рівно до оплати.
       */
      rememberOrder(result.orderId, {
        items,
        valueMinor: result.totalMinor,
        shippingMinor: quote?.shippingMinor ?? 0,
        discountMinor: quote?.discountMinor ?? 0,
        sha256Phone: (await hashPhone(phone)) ?? undefined,
      });

      // Кошик чистимо тільки після того, як сервер підтвердив замовлення:
      // помилка мережі не має коштувати людині зібраного кошика.
      clear();
      if (result.paymentPageUrl !== undefined) {
        // Сторінка Monobank — інший сайт, тож повний перехід, а не router.
        // Після оплати Monobank поверне на `/order/:id`.
        window.location.assign(result.paymentPageUrl);
        return;
      }
      router.push(`/order/${result.orderId}`);
    } catch (err) {
      setError(err instanceof ApiError
        ? err.message
        : 'Не вийшло оформити. Спробуй ще раз або напиши нам у Telegram, оформимо вручну.');
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
    <form onSubmit={submit} noValidate className="grid gap-10 lg:grid-cols-[1fr_minmax(0,22rem)]">
      <div className="flex flex-col gap-8">
        <section>
          <h2 className="label-eyebrow mb-4">Хто замовляє</h2>
          <div className="flex flex-col gap-4 sm:max-w-md">
            <Field
              id={FIELD_IDS.name} label="Імʼя" required autoComplete="name" maxLength={120}
              value={name}
              onChange={(v) => { setName(v); recheck('name', { name: v }); }}
              onBlur={() => check('name')}
              error={errors.name}
            />
            <Field
              id={FIELD_IDS.phone} label="Телефон" type="tel" required autoComplete="tel"
              placeholder="+38 0XX XXX XX XX"
              hint="+38 уже стоїть, допиши номер з 0: 0XX XXX XX XX"
              {...phoneField}
              onBlur={() => {
                const v = phoneValueOnBlur(phone);
                setPhone(v);
                check('phone', { phone: v });
              }}
              error={errors.phone}
            />
          </div>
        </section>

        <section>
          {/*
            `fieldset` + `legend`: без них диктор казав «Відділення Нової
            Пошти, перемикач, 1 з 4» і не казав, про що вибір (05-a11y).
          */}
          <fieldset className="min-w-0">
            <legend className="label-eyebrow mb-4">Куди везти</legend>

            <div className="flex flex-col gap-2 sm:max-w-md">
              {DELIVERY_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={`flex min-h-13 cursor-pointer items-center gap-3 rounded-card border px-4 py-3 text-base transition-colors focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2 ${
                    method === o.value ? 'border-ink bg-surface-sunken' : 'border-[#868680] hover:border-ink'
                  }`}
                >
                  <input
                    type="radio" name="delivery" value={o.value}
                    checked={method === o.value}
                    onChange={() => chooseMethod(o.value)}
                    className="h-5 w-5 accent-ink"
                  />
                  <span className="text-ink">{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {needsAddress && (
            <div className="mt-4 flex flex-col gap-4 sm:max-w-md">
              <Field
                id={FIELD_IDS.city} label="Місто" required autoComplete="address-level2" maxLength={120}
                placeholder="Харків"
                value={city}
                onChange={(v) => { setCity(v); recheck('city', { city: v }); }}
                onBlur={() => check('city')}
                error={errors.city}
              />
              <Field
                id={FIELD_IDS.branch} label={option?.hint ?? 'Відділення'} required maxLength={200}
                // Номер відділення чи поштомата — цифрова клавіатура; адреса курʼєра — звичайна.
                inputMode={method === 'NP_COURIER' ? 'text' : 'numeric'}
                autoComplete={method === 'NP_COURIER' ? 'street-address' : 'off'}
                hint={method === 'NP_COURIER' ? undefined : 'Можна просто номер — решту знайдемо самі'}
                value={branch}
                onChange={(v) => { setBranch(v); recheck('branch', { branch: v }); }}
                onBlur={() => check('branch')}
                error={errors.branch}
              />
            </div>
          )}

          {/*
            Одержувач іншою людиною — не рідкість, а звичайний подарунок, і
            Нова Пошта видає посилку за іменем. Поля сховані за галочкою:
            більшості вони не потрібні, а два зайві поля на касі коштують
            дорожче за одну галочку.
          */}
          <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-base text-ink">
            <input
              type="checkbox" checked={otherRecipient}
              onChange={(e) => {
                setOtherRecipient(e.target.checked);
                if (!e.target.checked) setErrors((prev) => ({ ...prev, recipientPhone: undefined }));
              }}
              className="h-5 w-5 accent-ink"
            />
            Отримувати буде інша людина
          </label>

          {otherRecipient && (
            <div className="mt-4 flex flex-col gap-4 sm:max-w-md">
              <Field
                id="co-rec-name" label="Імʼя одержувача" maxLength={120}
                value={recipientName} onChange={setRecipientName}
              />
              <Field
                id={FIELD_IDS.recipientPhone} label="Телефон одержувача" type="tel"
                placeholder="+38 0XX XXX XX XX"
                {...recipientPhoneField}
                onBlur={() => {
                  const v = phoneValueOnBlur(recipientPhone);
                  setRecipientPhone(v);
                  check('recipientPhone', { recipientPhone: v });
                }}
                error={errors.recipientPhone}
              />
            </div>
          )}
        </section>

        <section className="sm:max-w-md">
          <h2 className="label-eyebrow mb-4">Побажання</h2>
          <TextArea
            id="co-note" label="Що нам варто знати? (необовʼязково)" rows={3} maxLength={500}
            value={note} onChange={setNote}
            placeholder="Наприклад: подарунок, потрібно до пʼятниці"
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
                <span className="min-w-0 text-ink">
                  {l.title} <span className="text-ink-muted">× {l.quantity}</span>
                  {/* Розмір і колір: «Амстаф × 1» без них не каже, що саме замовляєш (03-ux #15). */}
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {[l.printSlug === null ? null : l.garmentName, l.colourName, l.sizeLabel].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-ink">{formatUAH(minor(l.lineTotalMinor))}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-sm">
            <ShippingRow quote={quote} settings={settings} />
          </dl>

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

          {orderingDisabled && (
            <p className="mt-4 text-sm text-ink-muted">Це тестова версія сайту: замовлення тут вимкнене.</p>
          )}

          {/*
            Поки розрахунок у дорозі, кнопка каже, що відбувається, а не
            просто сіріє (03-ux #8). Перевірку полів можна пройти й у
            превʼю: сервер там однаково замовлення не прийме.
          */}
          <Button
            type="submit" size="lg" full className="mt-5"
            disabled={sending || quote?.purchasable !== true}
            aria-busy={quote === undefined || sending ? true : undefined}
          >
            {quote === undefined || sending
              ? (
                <>
                  <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-surface border-t-transparent" />
                  {sending ? 'Оформлюємо…' : 'Рахуємо суму…'}
                </>
              )
              : payOnline ? 'Замовити й оплатити' : 'Замовити'}
          </Button>

          {/*
            Головне, що людина мусить знати ДО натискання: що буде з
            грошима, коли отримає річ і що з поверненням. Текст про оплату
            той самий, що в кошику, на товарі й у FAQ (`config/order-terms`).
          */}
          <OrderTerms quote={quote} settings={settings} />
        </div>
      </aside>
    </form>
  );
}
