'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { formatUAH, minor, type AdminPriceRulesDto, type PrintSizeTier } from '@dt/contracts';
import { ApiError } from '@/lib/api-client';
import { quotePrice } from './rules-api';
import { ErrorBanner } from '@/components/ui';

const TIER_LABEL: Record<PrintSizeTier, string> = {
  MINI: 'Міні',
  MEDIUM: 'Середній',
  MAXI: 'Максі',
};

/**
 * Калькулятор.
 *
 * Найважливіший екран у всьому розділі, хоч нічого й не зберігає. Правил може
 * бути десяток, вони перетинаються, і без розкладки єдиний спосіб дізнатися,
 * що вийде за 2XL у начосі при десяти штуках, — оформити тестове замовлення.
 *
 * Рахує сервер тією самою функцією, що й каса. Це не оптимізація, а вимога:
 * калькулятор, який рахує «майже так само», гірший за жоден — йому вірять.
 */
export function PriceCalculator({ data }: { data: AdminPriceRulesDto }) {
  const [garmentId, setGarmentId] = useState(data.options.garments[0]?.id ?? '');
  const [sizeLabel, setSizeLabel] = useState('');
  const [fabricId, setFabricId] = useState('');
  const [colourId, setColourId] = useState('');
  const [printTier, setPrintTier] = useState<PrintSizeTier | ''>('MEDIUM');
  const [quantity, setQuantity] = useState('1');

  const quote = useMutation({ mutationFn: quotePrice });

  const qty = Number(quantity);
  const canSubmit = garmentId !== '' && Number.isInteger(qty) && qty >= 1;
  const result = quote.data;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Калькулятор</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Показує, у що складається ціна після всіх правил. Рахує той самий код, що й каса.
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-4 rounded-card border border-line p-4"
        onSubmit={(e) => {
          e.preventDefault();
          quote.mutate({
            garmentId,
            fabricId: fabricId === '' ? null : fabricId,
            colourId: colourId === '' ? null : colourId,
            sizeLabel: sizeLabel === '' ? null : sizeLabel,
            printTier: printTier === '' ? null : printTier,
            quantity: qty,
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Виріб
          <select
            value={garmentId}
            onChange={(e) => setGarmentId(e.target.value)}
            className="rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
          >
            {data.options.garments.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Розмір
          <select
            value={sizeLabel}
            onChange={(e) => setSizeLabel(e.target.value)}
            className="rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
          >
            <option value="">—</option>
            {data.options.sizeLabels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Тканина
          <select
            value={fabricId}
            onChange={(e) => setFabricId(e.target.value)}
            className="rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
          >
            <option value="">—</option>
            {data.options.fabrics.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Колір
          <select
            value={colourId}
            onChange={(e) => setColourId(e.target.value)}
            className="rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
          >
            <option value="">—</option>
            {data.options.colours.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Друк
          <select
            value={printTier}
            onChange={(e) => setPrintTier(e.target.value as PrintSizeTier | '')}
            className="rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
          >
            <option value="">без друку</option>
            {(Object.keys(TIER_LABEL) as PrintSizeTier[]).map((t) => (
              <option key={t} value={t}>{TIER_LABEL[t]}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Кількість
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-24 rounded-card border border-line px-2 py-1 text-right tabular-nums text-ink focus:border-ink"
          />
        </label>

        <button
          type="submit"
          disabled={!canSubmit || quote.isPending}
          className="min-h-10 rounded-pill bg-ink px-5 text-sm font-semibold text-surface transition hover:bg-ink/85 disabled:opacity-40"
        >
          Порахувати
        </button>
      </form>

      {quote.error && (
        <ErrorBanner>
          {quote.error instanceof ApiError ? quote.error.message : 'Не вдалося порахувати'}
        </ErrorBanner>
      )}

      {result && (
        <div className="max-w-md rounded-card border border-line p-4">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {result.steps.map((s, i) => (
                <tr key={`${s.label}-${i}`} className="border-b border-line last:border-0">
                  <th scope="row" className="py-1 text-left font-normal text-ink-muted">{s.label}</th>
                  <td className="py-1 text-right tabular-nums text-ink">
                    {s.amountMinor < 0 ? '−' : ''}{formatUAH(minor(Math.abs(s.amountMinor)))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line-strong">
                <th scope="row" className="pt-2 text-left font-medium text-ink">Одиниця</th>
                <td className="pt-2 text-right font-medium tabular-nums text-ink">
                  {formatUAH(minor(result.unitMinor))}
                </td>
              </tr>
              {result.quantity > 1 && (
                <tr>
                  <th scope="row" className="py-1 text-left font-normal text-ink-muted">
                    × {result.quantity}
                  </th>
                  <td className="py-1 text-right tabular-nums text-ink-muted">
                    {formatUAH(minor(result.subtotalMinor))}
                  </td>
                </tr>
              )}
              {result.discountName !== null && (
                <tr>
                  <th scope="row" className="py-1 text-left font-normal text-ok">
                    {result.discountName}
                  </th>
                  <td className="py-1 text-right tabular-nums text-ok">
                    −{formatUAH(minor(result.discountMinor))}
                  </td>
                </tr>
              )}
              <tr className="border-t border-line-strong">
                <th scope="row" className="pt-2 text-left font-display font-bold text-ink">До сплати</th>
                <td className="pt-2 text-right font-display text-lg font-bold tabular-nums text-ink">
                  {formatUAH(minor(result.totalMinor))}
                </td>
              </tr>
            </tfoot>
          </table>

          {result.discountName === null && (
            <p className="mt-3 text-xs text-ink-subtle">
              Жодна знижка не діє на цю кількість і на цю дату.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
