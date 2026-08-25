'use client';

import type { MeasurementKey, SizeDto } from '@dt/contracts';

/**
 * Розмірна сітка виробу.
 *
 * Найдорожча відсутня деталь на сторінці товару. Розмір — єдине рішення в
 * покупці, яке людина не може перевірити після оплати й не може виправити
 * без повернення; без сітки вона або йде порівнювати з чужою футболкою, або
 * не купує. Сітка тут ЗАВЖДИ повна: не «розмір M», а всі розміри поряд, бо
 * обирають порівнянням, а не читанням одного рядка.
 *
 * Замір показуємо лише той, що справді є в даних, — колонки будуються з
 * рядків. Порожня колонка «рукав» на виробі без рукавів гірша за її
 * відсутність.
 */

const LABELS: Record<MeasurementKey, string> = {
  WIDTH: 'Ширина',
  LENGTH: 'Довжина',
  SLEEVE: 'Рукав',
  WAIST: 'Талія',
  HIP: 'Стегна',
};

const ORDER: readonly MeasurementKey[] = ['LENGTH', 'WIDTH', 'SLEEVE', 'WAIST', 'HIP'];

export function SizeChart({ sizes, highlight }: { sizes: readonly SizeDto[]; highlight?: string | null }) {
  const present = new Set<MeasurementKey>();
  for (const s of sizes) for (const m of s.measurements) present.add(m.key);
  const keys = ORDER.filter((k) => present.has(k));

  if (sizes.length === 0 || keys.length === 0) return null;

  return (
    <details className="mt-6 rounded-card border border-line">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink marker:text-ink-subtle">
        Розмірна сітка
      </summary>
      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full min-w-max border-collapse text-sm tabular-nums">
          <caption className="pb-2 text-left text-xs text-ink-subtle">
            Сантиметри. Заміри виробу, не тіла. Можливе відхилення в допустимих межах.{' '}
            <a href="/vyroby" className="underline hover:text-ink">Сітки всіх виробів</a>
          </caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-line py-2 pr-4 text-left font-medium text-ink-muted">
                Розмір
              </th>
              {sizes.map((s) => (
                <th
                  key={s.id}
                  scope="col"
                  aria-current={s.id === highlight ? 'true' : undefined}
                  className={[
                    'border-b border-line px-3 py-2 text-center font-semibold',
                    s.id === highlight ? 'text-accent' : 'text-ink',
                  ].join(' ')}
                >
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key}>
                <th scope="row" className="border-b border-line py-2 pr-4 text-left font-normal text-ink-muted">
                  {LABELS[key]}
                </th>
                {sizes.map((s) => (
                  <td
                    key={s.id}
                    className={[
                      'border-b border-line px-3 py-2 text-center',
                      s.id === highlight ? 'font-semibold text-accent' : 'text-ink',
                    ].join(' ')}
                  >
                    {s.measurements.find((m) => m.key === key)?.value ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
