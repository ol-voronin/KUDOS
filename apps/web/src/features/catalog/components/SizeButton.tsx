'use client';

import type { SelectableSize } from '../variant-selection';

/**
 * Sizes never share a single design across the range (nine different size
 * schemas), so the label is rendered verbatim — never re-derived or guessed.
 *
 * `remembered` підсвічує розмір, який людина обирала минулого разу. Підказка,
 * а не вибір: вона нічого не натискає за людину, лише позначає, де шукати.
 */
export function SizeButton({
  size,
  selected,
  remembered = false,
  onSelect,
}: {
  size: SelectableSize;
  selected: boolean;
  remembered?: boolean;
  onSelect: (id: string) => void;
}) {
  const disabled = size.state === 'UNAVAILABLE';

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={() => onSelect(size.id)}
      title={size.state === 'MADE_TO_ORDER' ? `${size.label} — під замовлення` : size.label}
      className={[
        'relative min-h-10 min-w-10 rounded-pill border px-3.5 text-sm font-medium transition',
        selected ? 'border-ink bg-ink text-surface' : 'border-line text-ink hover:border-ink',
        disabled ? 'cursor-not-allowed text-ink-subtle opacity-50 line-through' : '',
      ].join(' ')}
    >
      {size.label}
      {remembered && !selected && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-pill bg-accent"
        />
      )}
      {remembered && <span className="sr-only"> — ваш минулий вибір</span>}
    </button>
  );
}
