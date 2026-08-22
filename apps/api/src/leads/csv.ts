/** Quote a field only if it needs it \u2014 comma, quote, or newline inside it. */
export function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Excel opens UTF-8 CSV correctly only with a BOM prefix. */
export function rowsToCsv(rows: readonly (readonly string[])[]): string {
  const body = rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
  return `\uFEFF${body}`;
}
