import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';

/**
 * Таблиця адмінки.
 *
 * Ця розмітка була скопійована байт у байт у восьми файлах. Проблема не в
 * дублюванні як такому, а в тому, що разом із нею скопіювався один і той
 * самий недогляд — а в двох місцях не скопіювався зовсім, і там таблиця
 * розпирала екран на телефоні.
 *
 * `TableWrap` завжди дає горизонтальний скрол саме таблиці, а не сторінці:
 * коли їде вся сторінка, зникає й ліва навігація, і людина не розуміє, куди
 * поділася адмінка.
 */
export function TableWrap({ children, minWidth = '44rem' }: { children: ReactNode; minWidth?: string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>{children}</table>
    </div>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-ink text-left">{children}</tr>
    </thead>
  );
}

export function Th({ className = '', children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={`label-eyebrow whitespace-nowrap px-3 py-2 first:pl-0 last:pr-0 ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Tr({ children }: { children: ReactNode }) {
  return <tr className="border-b border-line align-middle">{children}</tr>;
}

export function Td({ className = '', children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-3 py-2.5 first:pl-0 last:pr-0 ${className}`} {...rest}>{children}</td>
  );
}

/** Рядок «нічого немає» на всю ширину — щоб таблиця не лишалася безголовою. */
export function TdEmpty({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="py-6 text-center text-sm text-ink-subtle">{children}</td>
    </tr>
  );
}
