'use client';

import type { PriceAdjustKind } from '@dt/contracts';

/**
 * Поле суми, яке знає, у чому вона.
 *
 * У базі й гроші, і ставка лежать цілими числами — копійки й соті відсотка.
 * Людина ж вводить «50» і «10 %». Перетворення живе тут, в одному місці, бо
 * саме на ньому найлегше помилитися на два порядки: ввести 10 замість 1000
 * і зробити знижку 0,1 % замість 10 %.
 */

export function toStored(kind: PriceAdjustKind, typed: string): number | null {
  const parsed = Number(typed.replace(',', '.'));
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

export function fromStored(amount: number): string {
  return String(amount / 100);
}

export function AmountField({
  kind, value, onChange, disabled, label,
}: {
  kind: PriceAdjustKind;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-ink-muted">
      {label}
      <span className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-28 rounded-card border border-line px-2 py-1 text-right tabular-nums text-ink focus:border-ink"
        />
        <span className="text-ink-subtle">{kind === 'PERCENT' ? '%' : '₴'}</span>
      </span>
    </label>
  );
}
