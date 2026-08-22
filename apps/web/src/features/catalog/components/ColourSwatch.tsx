'use client';

import type { SelectableColour } from '../variant-selection';

/**
 * Falls back to a photo when we have no hex, and to the supplier code when we
 * have neither. Own-production colours currently exist only as numbers on a
 * physical swatch card, so rendering a made-up colour would be a lie.
 */
export function ColourSwatch({
  colour,
  selected,
  onSelect,
}: {
  colour: SelectableColour;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const disabled = colour.state === 'UNAVAILABLE';
  const label = colour.name ?? `Колір ${colour.supplierCode}`;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={() => onSelect(colour.id)}
      title={colour.state === 'MADE_TO_ORDER' ? `${label} — під замовлення` : label}
      className={[
        'flex min-h-12 min-w-12 items-center justify-center rounded-pill border-2 transition',
        selected ? 'border-ink' : 'border-line',
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:border-ink-subtle',
      ].join(' ')}
    >
      {colour.hex ? (
        <span className="h-8 w-8 rounded-full border border-line" style={{ backgroundColor: colour.hex }} />
      ) : colour.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={colour.imageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <span className="text-xs font-semibold text-ink-subtle">{colour.supplierCode}</span>
      )}
    </button>
  );
}
