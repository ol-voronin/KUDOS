import type { Selectability } from '../variant-selection';

/**
 * Three states, not two. "Під замовлення" with a real number of days is an
 * honest promise; the same badge without a number would be a guess, and the
 * data model refuses to produce one.
 */
export function AvailabilityBadge({
  state,
  leadTimeDays,
}: {
  state: Selectability;
  leadTimeDays: number | null;
}) {
  if (state === 'AVAILABLE') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-ok-soft px-3 py-1 text-xs font-semibold text-ok">
        <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
        Є в наявності
      </span>
    );
  }
  if (state === 'MADE_TO_ORDER' && leadTimeDays !== null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        Виготовимо за {leadTimeDays} дн.
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-sunken px-3 py-1 text-xs font-semibold text-ink-subtle">
      <span className="h-1.5 w-1.5 rounded-full bg-ink-subtle" aria-hidden="true" />
      Немає
    </span>
  );
}
