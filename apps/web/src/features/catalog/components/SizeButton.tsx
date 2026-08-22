'use client';

import type { SelectableSize } from '../variant-selection';

/**
 * Sizes never share a single design across the range (nine different size
 * schemas), so the label is rendered verbatim — never re-derived or guessed.
 */
export function SizeButton({
  size,
  selected,
  onSelect,
}: {
  size: SelectableSize;
  selected: boolean;
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
        'min-h-10 min-w-10 rounded-pill border-2 px-3 text-sm font-medium transition',
        selected ? 'border-ink bg-ink text-surface' : 'border-line text-ink-muted',
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:border-ink-subtle',
      ].join(' ')}
    >
      {size.label}
    </button>
  );
}
