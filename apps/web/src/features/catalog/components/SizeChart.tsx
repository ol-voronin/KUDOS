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
 *
 * ── Чому це панель, а не розгортання на місці ─────────────────────────
 *
 * Таблиця на сім колонок розсовувала картку товару вдвічі, і кнопка
 * купівлі їхала за екран рівно тоді, коли розмір нарешті обрано. Панель
 * показує сітку поверх сторінки й повертає людину точно туди, звідки вона
 * її відкрила.
 *
 * ── Малюнок замірів ───────────────────────────────────────────────────
 *
 * Без нього таблиця чисел неповна: «ширина 52» нічого не каже, доки
 * незрозуміло, що це половина обхвату під пахвами, а не по грудях. Це
 * найчастіша причина повернень «не той розмір» — і найдешевша для
 * усунення.
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
    <div>
      <HowToMeasure keys={keys} />
      <div className="mt-6 overflow-x-auto">
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
    </div>
  );
}

/**
 * Як знімати заміри.
 *
 * Малюнок один на всі вироби: контур футболки з трьома стрілками. Він
 * навмисно схематичний — точний силует худі проти футболки нічого не
 * додає до відповіді «звідки й куди міряти», а окремий малюнок на кожен
 * виріб довелося б малювати ще шість разів і підтримувати.
 */
function HowToMeasure({ keys }: { keys: readonly MeasurementKey[] }) {
  const rows: Array<{ key: MeasurementKey; text: string }> = [
    { key: 'LENGTH', text: 'Від найвищої точки плеча біля коміра — рівно вниз до нижнього краю.' },
    { key: 'WIDTH', text: 'Упоперек, від шва до шва під пахвами. Це половина обхвату, а не весь обхват.' },
    { key: 'SLEEVE', text: 'Від плечового шва до краю рукава.' },
    { key: 'WAIST', text: 'Упоперек у найвужчому місці, від краю до краю.' },
    { key: 'HIP', text: 'Упоперек у найширшому місці, від краю до краю.' },
  ];
  const shown = rows.filter((r) => keys.includes(r.key));
  if (shown.length === 0) return null;

  return (
    <div className="grid gap-5 sm:grid-cols-[9rem_1fr] sm:items-start">
      <svg viewBox="0 0 120 150" className="w-32 text-ink" fill="none" aria-hidden="true">
        {/* Контур футболки */}
        <path
          d="M38 14 L24 20 L10 40 L24 50 L30 42 V136 H90 V42 L96 50 L110 40 L96 20 L82 14 Q60 26 38 14 Z"
          stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="text-line-strong"
        />
        {/* Довжина */}
        <path d="M18 20 V136" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" />
        <path d="M14 24 L18 18 L22 24 M14 132 L18 138 L22 132" stroke="currentColor" strokeWidth="1.2" />
        <text x="6" y="82" fontSize="9" fill="currentColor" transform="rotate(-90 6 82)">A</text>
        {/* Ширина */}
        <path d="M30 60 H90" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" />
        <path d="M34 56 L28 60 L34 64 M86 56 L92 60 L86 64" stroke="currentColor" strokeWidth="1.2" />
        <text x="57" y="55" fontSize="9" fill="currentColor">B</text>
        {/* Рукав */}
        <path d="M30 42 L104 44" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" />
        <text x="66" y="38" fontSize="9" fill="currentColor">C</text>
      </svg>

      <ol className="flex flex-col gap-3 text-sm leading-relaxed text-ink-muted">
        {shown.map((r, i) => (
          <li key={r.key} className="flex gap-3">
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill border border-line-strong text-xs font-semibold text-ink"
            >
              {String.fromCharCode(65 + i)}
            </span>
            <span>
              <b className="font-medium text-ink">{LABELS[r.key]}.</b> {r.text}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
