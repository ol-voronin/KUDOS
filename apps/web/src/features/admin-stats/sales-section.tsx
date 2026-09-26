'use client';

import { useQuery } from '@tanstack/react-query';
import { SalesStatsDto, formatUAH, minor, type SoldRowDto } from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';
import { TableSkeleton } from '@/components/ui';

/**
 * Що саме купують.
 *
 * Це єдиний блок екрана, який рахується із замовлень, а не з подій. Різниця
 * не косметична: подія покупки може не дійти — блокер, відмова від cookie,
 * закрита вкладка, — а замовлення в базі є завжди. Тому вище на екрані ми
 * питаємо «звідки прийшли й де загубились», а тут — «на чому заробили».
 *
 * Два числа з різних джерел ніколи не збіжаться між собою. Зводити їх не
 * треба; треба знати, яке з них про що.
 */
function getSales(days: number): Promise<SalesStatsDto> {
  return apiFetch(`/admin/analytics/sales?days=${days}`, SalesStatsDto);
}

export function SalesSection({ days }: { days: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-sales', days],
    queryFn: () => getSales(days),
  });

  if (isLoading) return <TableSkeleton rows={4} cols={3} />;
  if (isError) return <p className="text-danger">Не вдалося завантажити продажі.</p>;
  if (!data) return null;

  const printed = (data.totals.printedHundredths / 100).toFixed(0);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="font-display text-lg font-bold text-ink">Що купують</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Рахується із замовлень, а не з подій на сайті: подія може не дійти, замовлення —
          ні. Суми — знімки на момент покупки, після знижки, тож зміна прайсу не переписує
          минулі місяці.
        </p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Замовлення" value={String(data.totals.orders)} />
          <Tile label="Штук продано" value={String(data.totals.items)} />
          <Tile label="Середній чек" value={formatUAH(minor(data.totals.averageOrderMinor))} />
          <Tile
            label="З принтом"
            value={`${printed} %`}
            hint="решта — базовий одяг без друку"
          />
        </dl>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Ranked
          title="Принти"
          note="Найкращий кандидат на повтор і на рекламу."
          rows={data.prints}
        />
        <Ranked
          title="Породи"
          note="Принт із двома породами ділить дохід між ними, а не подвоює його — тому підсумок сходиться із загальним."
          rows={data.breeds}
        />
        <Ranked title="Колекції" rows={data.collections} />
        <Ranked title="Вироби" rows={data.garments} />
        <Ranked
          title="Розміри"
          note="Це не звіт про моду, а підказка цеху: що тримати на складі."
          rows={data.sizes}
          moneyless
        />
        <Ranked title="Кольори" rows={data.colours} moneyless />
      </div>
    </div>
  );
}

function Ranked({
  title, note, rows, moneyless,
}: { title: string; note?: string; rows: readonly SoldRowDto[]; moneyless?: boolean }) {
  return (
    <section>
      <h3 className="font-display text-base font-bold text-ink">{title}</h3>
      {note && <p className="mt-1 text-xs text-ink-subtle">{note}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-muted">
              <th scope="col" className="py-2 pr-4 font-medium">Назва</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Штук</th>
              {!moneyless && <th scope="col" className="px-3 py-2 text-right font-medium">Дохід</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={moneyless ? 2 : 3} className="py-3 text-ink-subtle">
                  Поки нічого не продано.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-line">
                <th scope="row" className="py-2 pr-4 text-left font-normal text-ink">{row.label}</th>
                <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{row.quantity}</td>
                {!moneyless && (
                  <td className="px-3 py-2 text-right tabular-nums text-ink">
                    {formatUAH(minor(row.revenueMinor))}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
