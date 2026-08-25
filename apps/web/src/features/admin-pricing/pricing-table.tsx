'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatUAH, minor, type AdminGarmentDto, type AdminPricingDto } from '@dt/contracts';
import { ApiError } from '@/lib/api-client';
import { getPricing, updateGarment, updatePrintPrices } from './api';

const KEY = ['admin-pricing'];

const TIER_LABEL: Record<string, string> = {
  MINI: 'Міні',
  MEDIUM: 'Середній',
  MAXI: 'Максі',
};

/**
 * Ціни.
 *
 * Екран існує через одну обставину: базові ціни виробів залиті сідером як
 * заглушки. Заглушка нормальна рівно доти, доки її можна виправити без
 * деплою — інакше «тимчасова ціна» доживає до першого замовлення за
 * неправильною сумою. Тому тут же стоїть і перемикач вітрини: ціна й рішення
 * «показувати» — це одна дія, і розводити її по двох екранах означає
 * гарантувати, що виріб вилізе на сайт із чужою цифрою.
 *
 * Гривні, не копійки. У базі — копійки, і це правильно; але людина, яка
 * призначає ціну, думає в гривнях, і перевід має робити машина.
 */
export function PricingTable() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: KEY, queryFn: getPricing });

  const save = useMutation({
    mutationFn: ({ id, ...dto }: { id: string; basePriceMinor?: number; isPublished?: boolean }) =>
      updateGarment(id, dto),
    onSuccess: (fresh) => qc.setQueryData(KEY, fresh),
  });

  const savePrints = useMutation({
    mutationFn: updatePrintPrices,
    onSuccess: (fresh) => qc.setQueryData(KEY, fresh),
  });

  if (isLoading) return <p className="text-ink-muted">Завантаження…</p>;
  if (isError || !data) return <p className="text-danger">Не вдалося завантажити ціни.</p>;

  const cheapestPrint = data.printPrices.length > 0
    ? Math.min(...data.printPrices.map((p) => p.priceMinor))
    : 0;

  const error = save.error ?? savePrints.error;

  return (
    <div className="flex flex-col gap-10">
      {error && (
        <p className="rounded-card border border-danger px-4 py-3 text-sm text-danger" role="alert">
          {error instanceof ApiError ? error.message : 'Не вдалося зберегти'}
        </p>
      )}

      <section>
        <h2 className="font-display text-lg font-bold text-ink">Вироби</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Ціна голого виробу, без друку. У колонці «на сайті» — те, що побачить покупець
          із найдешевшим принтом ({formatUAH(minor(cheapestPrint))}).
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Виріб</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Ціна, ₴</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">На сайті</th>
                <th scope="col" className="px-3 py-2 text-center font-medium">Кольорів</th>
                <th scope="col" className="px-3 py-2 text-center font-medium">Розмірів</th>
                <th scope="col" className="px-3 py-2 text-center font-medium">Варіантів</th>
                <th scope="col" className="px-3 py-2 text-center font-medium">У вітрині</th>
              </tr>
            </thead>
            <tbody>
              {data.garments.map((g) => (
                <GarmentRow
                  key={g.id}
                  garment={g}
                  cheapestPrint={cheapestPrint}
                  busy={save.isPending}
                  onSave={(dto) => save.mutate({ id: g.id, ...dto })}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <PrintPrices
        prices={data.printPrices}
        busy={savePrints.isPending}
        onSave={(prices) => savePrints.mutate({ prices })}
      />
    </div>
  );
}

function GarmentRow({
  garment, cheapestPrint, busy, onSave,
}: {
  garment: AdminGarmentDto;
  cheapestPrint: number;
  busy: boolean;
  onSave: (dto: { basePriceMinor?: number; isPublished?: boolean }) => void;
}) {
  const [uah, setUah] = useState(String(garment.basePriceMinor / 100));

  // Поле керується локально, поки його редагують, але має підхопити значення
  // з сервера після збереження — інакше два відкриті таби розходяться мовчки.
  useEffect(() => { setUah(String(garment.basePriceMinor / 100)); }, [garment.basePriceMinor]);

  const parsed = Number(uah.replace(',', '.'));
  const valid = Number.isFinite(parsed) && parsed >= 0;
  const dirty = valid && Math.round(parsed * 100) !== garment.basePriceMinor;
  const empty = garment.variantCount === 0;

  return (
    <tr className="border-b border-line">
      <th scope="row" className="py-2 pr-4 text-left font-normal">
        <span className="block font-medium text-ink">{garment.name}</span>
        <span className="block text-xs text-ink-subtle">{garment.slug}</span>
      </th>
      <td className="px-3 py-2 text-right">
        <input
          type="text"
          inputMode="decimal"
          value={uah}
          aria-label={`Ціна: ${garment.name}`}
          aria-invalid={!valid}
          onChange={(e) => setUah(e.target.value)}
          onBlur={() => { if (dirty) onSave({ basePriceMinor: Math.round(parsed * 100) }); }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          disabled={busy}
          className={[
            'w-24 rounded-card border px-2 py-1 text-right tabular-nums text-ink',
            valid ? 'border-line focus:border-ink' : 'border-danger',
            dirty ? 'bg-sun-soft' : '',
          ].join(' ')}
        />
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-ink-muted">
        {formatUAH(minor(garment.basePriceMinor + cheapestPrint))}
      </td>
      <td className="px-3 py-2 text-center tabular-nums text-ink-muted">{garment.colourCount}</td>
      <td className="px-3 py-2 text-center tabular-nums text-ink-muted">{garment.sizeCount}</td>
      <td className="px-3 py-2 text-center tabular-nums text-ink-muted">{garment.variantCount}</td>
      <td className="px-3 py-2 text-center">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={garment.isPublished}
            // Виріб без жодного варіанта не можна показувати: обрати в ньому
            // нічого, і сторінка принта покаже назву без кольорів і розмірів.
            disabled={busy || (empty && !garment.isPublished)}
            onChange={(e) => onSave({ isPublished: e.target.checked })}
            className="h-4 w-4"
          />
          <span className="sr-only">Показувати {garment.name} у вітрині</span>
        </label>
        {empty && <span className="block text-xs text-ink-subtle">немає варіантів</span>}
      </td>
    </tr>
  );
}

function PrintPrices({
  prices, busy, onSave,
}: {
  prices: AdminPricingDto['printPrices'];
  busy: boolean;
  onSave: (prices: Array<{ tier: 'MINI' | 'MEDIUM' | 'MAXI'; priceMinor: number }>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(Object.fromEntries(prices.map((p) => [p.tier, String(p.priceMinor / 100)])));
  }, [prices]);

  return (
    <section>
      <h2 className="font-display text-lg font-bold text-ink">Друк</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Ціна друку залежить від розміру макета, а не від виробу чи методу.
      </p>

      <div className="mt-4 flex flex-wrap gap-4">
        {prices.map((p) => (
          <label key={p.tier} className="flex flex-col gap-1 text-sm text-ink-muted">
            {TIER_LABEL[p.tier] ?? p.tier}
            <input
              type="text"
              inputMode="decimal"
              value={draft[p.tier] ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, [p.tier]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              onBlur={() => {
                const next = prices.map((row) => {
                  const raw = Number((draft[row.tier] ?? '').replace(',', '.'));
                  return {
                    tier: row.tier,
                    priceMinor: Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) : row.priceMinor,
                  };
                });
                if (next.some((row, i) => row.priceMinor !== prices[i]?.priceMinor)) onSave(next);
              }}
              disabled={busy}
              className="w-28 rounded-card border border-line px-2 py-1 text-right tabular-nums text-ink focus:border-ink"
            />
          </label>
        ))}
      </div>
    </section>
  );
}
