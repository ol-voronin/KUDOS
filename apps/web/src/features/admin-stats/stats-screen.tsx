'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminStatsDto, formatUAH, minor } from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';
import { DailyChart } from './daily-chart';
import { SalesSection } from './sales-section';
import { TableSkeleton } from '@/components/ui';

const RANGES = [7, 30, 90] as const;

function getStats(days: number): Promise<AdminStatsDto> {
  return apiFetch(`/admin/analytics/stats?days=${days}`, AdminStatsDto);
}

/**
 * Своя статистика.
 *
 * Головне питання цього екрана — не «скільки було переглядів», а «яка
 * реклама принесла гроші». Тому таблиця джерел стоїть вище за таблицю
 * сторінок і сортується за доходом, а не за трафіком: джерело, з якого
 * приходять тисячі й не купують, у цьому списку має бути внизу.
 */
export function StatsScreen() {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-stats', days],
    queryFn: () => getStats(days),
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={days === r}
            onClick={() => setDays(r)}
            className={[
              'rounded-pill border px-4 py-1.5 text-sm transition',
              days === r ? 'border-ink bg-ink text-surface' : 'border-line text-ink-muted hover:border-ink',
            ].join(' ')}
          >
            {r} днів
          </button>
        ))}
      </div>

      {isLoading && <TableSkeleton rows={4} cols={6} />}
      {isError && <p className="text-danger">Не вдалося завантажити статистику.</p>}

      {data && (
        <>
          <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Tile label="Візити" value={String(data.totals.visits)} />
            <Tile label="Перегляди" value={String(data.totals.views)} />
            <Tile label="Заявки" value={String(data.totals.leads)} />
            <Tile label="Замовлення" value={String(data.totals.orders)} />
            <Tile label="Дохід" value={formatUAH(minor(data.totals.revenueMinor))} />
            <Tile
              label="Конверсія"
              value={`${(data.totals.conversionHundredths / 100).toFixed(1)} %`}
              hint="заявки й замовлення на візит"
            />
          </dl>

          <div className="flex flex-col gap-6 rounded-card border border-line p-4">
            <DailyChart
              title="Візити за день"
              points={data.daily}
              pick={(p) => p.visits}
              ariaTotalLabel={`${data.totals.visits} візитів за ${days} днів`}
            />
            <DailyChart
              title="Заявки за день"
              points={data.daily}
              pick={(p) => p.leads}
              ariaTotalLabel={`${data.totals.leads} заявок за ${days} днів`}
            />
          </div>

          <SalesSection days={days} />

          <section>
            <h2 className="font-display text-lg font-bold text-ink">Звідки приходять</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Спершу те, що принесло гроші. Атрибуція за першим дотиком: враховується те,
              що привело людину на сайт, а не сторінка, з якої вона надіслала форму.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-ink-muted">
                    <th scope="col" className="py-2 pr-4 font-medium">Джерело</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Візити</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Заявки</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Замовлення</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Дохід</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sources.length === 0 && (
                    <tr><td colSpan={5} className="py-3 text-ink-subtle">Поки нічого.</td></tr>
                  )}
                  {data.sources.map((row) => (
                    <tr key={row.label} className="border-b border-line">
                      <th scope="row" className="py-2 pr-4 text-left font-normal text-ink">{row.label}</th>
                      <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{row.visits}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{row.leads}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{row.orders}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink">
                        {row.revenueMinor === 0 ? '—' : formatUAH(minor(row.revenueMinor))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">Сторінки</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-ink-muted">
                    <th scope="col" className="py-2 pr-4 font-medium">Адреса</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Перегляди</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pages.length === 0 && (
                    <tr><td colSpan={2} className="py-3 text-ink-subtle">Поки нічого.</td></tr>
                  )}
                  {data.pages.map((row) => (
                    <tr key={row.path} className="border-b border-line">
                      <th scope="row" className="py-2 pr-4 text-left font-normal text-ink-muted">{row.path}</th>
                      <td className="px-3 py-2 text-right tabular-nums text-ink">{row.views}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-line p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className="mt-1 font-display text-xl font-bold tabular-nums text-ink">{value}</dd>
      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}
