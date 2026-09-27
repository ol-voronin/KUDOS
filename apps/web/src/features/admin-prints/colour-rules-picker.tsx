'use client';

import type { ColourOptionDto } from '@dt/contracts';

/**
 * Кольори, на яких НЕ друкуємо — для колекції або для окремого принта.
 *
 * Логіка навпаки від решти чипів: позначений колір — це колір, на якому
 * НЕ друкується. Тому позначені — червоним перекресленням, а не чорною
 * заливкою «вибрано»: заливка тут читалася б як «доступно».
 *
 * У формі принта є ще успадковані заборони — від його колекцій. Вони
 * показані пунктиром із позначкою «колекція», і клік по такому кольору не
 * забороняє його вдруге, а навпаки — дозволяє саме цьому принту. Повторний
 * клік повертає правило колекції.
 */
export function ColourRulesPicker({
  colours, excluded, allowed = [], inherited = [], onChange, legend, note,
}: {
  colours: readonly ColourOptionDto[];
  excluded: readonly string[];
  allowed?: readonly string[];
  inherited?: readonly string[];
  onChange: (next: { excluded: string[]; allowed: string[] }) => void;
  legend: string;
  note: string;
}) {
  if (colours.length === 0) return null;
  const inheritedSet = new Set(inherited);

  function toggle(id: string) {
    const ex = [...excluded];
    const al = [...allowed];
    if (ex.includes(id)) {
      onChange({ excluded: ex.filter((x) => x !== id), allowed: al });
    } else if (inheritedSet.has(id)) {
      onChange({ excluded: ex, allowed: al.includes(id) ? al.filter((x) => x !== id) : [...al, id] });
    } else {
      onChange({ excluded: [...ex, id], allowed: al });
    }
  }

  const inheritedCount = [...inheritedSet].filter((id) => !allowed.includes(id)).length;

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink">{legend}</legend>
      <p className="mb-2 text-sm text-ink-muted">{note}</p>
      {inheritedSet.size > 0 && (
        <p className="mb-2 text-xs text-ink-subtle">
          Пунктиром — заборони колекції ({inheritedCount}). Клік по такому кольору дозволить його лише цьому принту.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {colours.map((c) => {
          const own = excluded.includes(c.id);
          const fromCollection = inheritedSet.has(c.id);
          const reallowed = fromCollection && allowed.includes(c.id) && !own;
          const banned = own || (fromCollection && !reallowed);
          const state = own
            ? 'не друкуємо'
            : fromCollection && !reallowed
              ? 'не друкуємо — правило колекції'
              : reallowed
                ? 'друкуємо всупереч колекції'
                : 'друкуємо';
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={banned}
              title={`${c.name}: ${state}`}
              onClick={() => toggle(c.id)}
              className={[
                'inline-flex min-h-10 items-center gap-2 rounded-pill border-2 px-3.5 text-sm font-medium transition',
                own ? 'border-danger text-danger' : '',
                !own && fromCollection && !reallowed ? 'border-dashed border-danger/70 text-danger/80' : '',
                reallowed ? 'border-ink text-ink' : '',
                !banned && !reallowed ? 'border-line text-ink-muted hover:border-ink-subtle' : '',
              ].join(' ')}
            >
              <span
                aria-hidden
                className="h-4 w-4 shrink-0 rounded-full border border-line"
                {...(c.hex ? { style: { backgroundColor: c.hex } } : {})}
              />
              <span className={banned ? 'line-through' : ''}>{c.name}</span>
              {!own && fromCollection && !reallowed && (
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide no-underline">колекція</span>
              )}
              {reallowed && <span className="text-[0.65rem] font-semibold uppercase tracking-wide">✓ цьому принту</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
