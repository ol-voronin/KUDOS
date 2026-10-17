import Link from 'next/link';
import type { CartQuoteDto } from '@dt/contracts';
import { Skeleton } from '@/components/ui';
import {
  PAYMENT_TERMS_HREF, PAYMENT_TEXT, PAYMENT_TEXT_LATER, RETURN_TERMS_HREF,
  freeShippingProgress, productionLine, returnLine, shippingSummary,
} from '@/config/order-terms';

/**
 * Числа з налаштувань сайту (`/admin/nalashtuvannya`), які сторінка кошика
 * й оформлення передає сюди з сервера. Поріг безкоштовної доставки береться
 * з розрахунку кошика, коли він уже є, — це те саме значення з бази.
 */
export interface OrderTermsSettings {
  readonly productionDaysMax: number;
  readonly returnDays: number;
  readonly freeShippingFromMinor: number;
}

/**
 * Рядок «Доставка» для `<dl>` підсумку. До порогу — орієнтир тарифу Нової
 * Пошти, від порогу — «Безкоштовно». Раніше тут стояло «за тарифами
 * перевізника» без жодної цифри (аудит 17.10.2026, 03-ux #2).
 */
export function ShippingRow({ quote, settings }: { quote: CartQuoteDto | undefined; settings: OrderTermsSettings }) {
  const s = quote === undefined ? null : shippingSummary(quote.subtotalMinor, quote.freeShippingFromMinor || settings.freeShippingFromMinor);
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-muted">Доставка</dt>
      <dd className="min-w-0 text-right">
        {s === null
          ? <Skeleton className="ml-auto h-4 w-32" />
          : (
            <>
              <span className={`block tabular-nums text-ink ${s.free ? 'font-medium' : ''}`}>{s.value}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{s.note}</span>
            </>
          )}
      </dd>
    </div>
  );
}

/** Скільки бракує до безкоштовної доставки — смужкою й текстом. */
export function FreeShippingProgress({ quote, settings }: { quote: CartQuoteDto | undefined; settings: OrderTermsSettings }) {
  if (quote === undefined) return null;
  const p = freeShippingProgress(quote.subtotalMinor, quote.freeShippingFromMinor || settings.freeShippingFromMinor);
  if (p === null) return null;
  return (
    <div className="mt-3">
      {/* Смужка — лише візуальний дубль тексту під нею. */}
      <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-pill bg-line">
        <div className="h-full rounded-pill bg-ink" style={{ width: `${Math.round(p.ratio * 100)}%` }} />
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{p.text}</p>
    </div>
  );
}

/**
 * Три речі, які людина мусить знати ДО кнопки: коли отримає, що буде з
 * грошима і що з поверненням. Раніше їх не було ні в кошику, ні на
 * оформленні — лише в згорнутих блоках товару (аудит 17.10.2026, 03-ux
 * #6, #7, #21; 02-copy C-3).
 *
 * Поки розрахунок не прийшов, текст про оплату не показуємо взагалі:
 * інакше спершу видно одну модель оплати, а через мить іншу (03-ux #5).
 */
export function OrderTerms({ quote, settings }: { quote: CartQuoteDto | undefined; settings: OrderTermsSettings }) {
  const hasPrinted = quote?.lines.some((l) => l.printSlug !== null) ?? true;
  const hasBlank = quote?.lines.some((l) => l.printSlug === null) ?? false;
  return (
    <ul className="mt-4 flex flex-col gap-2.5 border-t border-line-strong pt-4 text-xs leading-relaxed text-ink-muted">
      <TermsItem icon="clock">
        {productionLine(settings.productionDaysMax, quote?.maxLeadTimeDays ?? 0)}
      </TermsItem>
      <TermsItem icon="card">
        {quote === undefined
          ? <Skeleton className="h-3 w-full" />
          : <>{quote.payOnline === true ? PAYMENT_TEXT : PAYMENT_TEXT_LATER}{' '}
              <Link href={PAYMENT_TERMS_HREF} className="text-ink underline underline-offset-2">Детальніше</Link></>}
      </TermsItem>
      <TermsItem icon="return">
        {returnLine({ hasPrinted, hasBlank }, settings.returnDays)}{' '}
        <Link href={RETURN_TERMS_HREF} className="text-ink underline underline-offset-2">Умови повернення</Link>
      </TermsItem>
    </ul>
  );
}

const ICONS = {
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  card: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>,
  return: <><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>,
} as const;

function TermsItem({ icon, children }: { icon: keyof typeof ICONS; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px shrink-0 text-ink">
        {ICONS[icon]}
      </svg>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}
