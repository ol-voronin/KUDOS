'use client';

import { useState, type ReactNode } from 'react';

/**
 * «Показати всі» для довгого списку.
 *
 * Усі елементи вже в розмітці (пошуковик і скрінрідер бачать повний список),
 * а зайві до натискання ховає CSS: елементи з класом `collapsible-extra`
 * всередині згорнутого блока не показуються (правило в globals.css).
 */
export function ShowMore({
  children, total, label,
}: { children: ReactNode; total: number; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div data-collapsed={open ? undefined : ''}>
      {children}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 min-h-12 w-full rounded-pill border border-ink px-6 text-sm font-medium text-ink transition hover:bg-ink hover:text-surface"
        >
          {label} ({total})
        </button>
      )}
    </div>
  );
}
