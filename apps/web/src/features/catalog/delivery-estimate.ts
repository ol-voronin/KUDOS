/**
 * Коли посилка виїде — датою, а не кількістю днів.
 *
 * ── Чому це важливо ───────────────────────────────────────────────────
 *
 * «4–7 робочих днів» покупець однаково перекладає в дату — просто робить це
 * сам, у голові, з помилкою й не на нашу користь. Baymard знаходить це в
 * кожному дослідженні кошика: строк, названий днями, читається як «десь за
 * тиждень», а названий датою — як зобовʼязання. Друге і продає, і зменшує
 * кількість питань «а коли вже».
 *
 * ── Дні робочі ────────────────────────────────────────────────────────
 *
 * «Пʼять днів» у понеділок і «пʼять днів» у пʼятницю — це різні дати, а
 * рахує людина саме дати. Тому субота й неділя пропускаються.
 *
 * Свят тут немає навмисно: перелік державних свят треба підтримувати, і
 * застарілий перелік гірший за його відсутність — він дає точну на вигляд
 * дату, яка мовчки бреше. Поки їх немає, оцінка трохи оптимістична в кілька
 * днів на рік, і про це знає той, хто відправляє.
 */

const MONTHS_GENITIVE = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];

/** Додає N робочих днів. 0 днів — той самий день. */
export function addWorkingDays(from: Date, days: number): Date {
  const date = new Date(from.getTime());
  let left = Math.max(0, Math.trunc(days));
  while (left > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return date;
}

/**
 * «2–5 вересня» або «30 серпня — 4 вересня».
 *
 * Місяць не повторюється, коли він один: це той рівень стислості, після
 * якого рядок читається як дата, а не як службова відмітка.
 */
export function formatShipWindow(min: Date, max: Date): string {
  const sameMonth = min.getMonth() === max.getMonth();
  const monthOf = (d: Date): string => MONTHS_GENITIVE[d.getMonth()] ?? '';
  if (min.getDate() === max.getDate() && sameMonth) {
    return `${min.getDate()} ${monthOf(min)}`;
  }
  return sameMonth
    ? `${min.getDate()}–${max.getDate()} ${monthOf(max)}`
    : `${min.getDate()} ${monthOf(min)} — ${max.getDate()} ${monthOf(max)}`;
}

/**
 * Вікно відправки для позиції.
 *
 * `leadTimeDays` — це строк ПОШИТТЯ виробу, якого немає на складі; він
 * додається до строку друку, а не замінює його. Виріб, який спершу шиють,
 * а потім друкують, не може виїхати швидше за той, що вже лежить.
 */
export function shipWindow(
  productionDaysMin: number,
  productionDaysMax: number,
  leadTimeDays: number | null,
  now: Date = new Date(),
): { from: Date; to: Date; label: string } {
  const extra = leadTimeDays ?? 0;
  const from = addWorkingDays(now, productionDaysMin + extra);
  const to = addWorkingDays(now, productionDaysMax + extra);
  return { from, to, label: formatShipWindow(from, to) };
}
