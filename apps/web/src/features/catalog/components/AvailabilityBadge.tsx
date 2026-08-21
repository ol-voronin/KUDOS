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
      <span className="rounded bg-ok-soft px-2 py-1 text-xs font-semibold text-ok">
        Є в наявності
      </span>
    );
  }
  if (state === 'MADE_TO_ORDER' && leadTimeDays !== null) {
    return (
      <span className="rounded bg-accent-soft px-2 py-1 text-xs font-semibold text-accent">
        Пошиємо за {leadTimeDays} дн.
      </span>
    );
  }
  return (
    <span className="rounded bg-surface-sunken px-2 py-1 text-xs font-semibold text-ink-subtle">
      Немає
    </span>
  );
}
