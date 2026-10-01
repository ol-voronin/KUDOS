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
  /*
   * Обраний стан — не лише кольором обвідки (WCAG 1.4.1): товща обвідка з
   * відступом + галочка всередині. Колір галочки — контрастний до заливки.
   */
  const tick = colour.hex !== null && isLight(colour.hex) ? '#0b0b0b' : '#ffffff';

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`Колір: ${label}${colour.state === 'MADE_TO_ORDER' ? ' (під замовлення)' : ''}`}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={() => onSelect(colour.id)}
      title={colour.state === 'MADE_TO_ORDER' ? `${label} — під замовлення` : label}
      className={[
        'relative flex min-h-11 min-w-11 items-center justify-center rounded-pill border-2 transition',
        selected ? 'border-ink ring-2 ring-ink ring-offset-1' : 'border-line',
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
      {selected && (
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tick} strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="absolute"
        >
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      )}
    </button>
  );
}

/** Світла заливка (відносна яскравість > 0.45) — галочка тоді чорна. */
function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || m[1] === undefined) return false;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = ch;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45;
}
