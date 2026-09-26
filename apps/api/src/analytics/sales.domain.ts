import type { SalesStatsDto, SoldRowDto } from '@dt/contracts';

/**
 * Зведення продажів. Чисті функції, без бази — як і сусідній `stats.domain`.
 *
 * ── Чому окремо від решти статистики ──────────────────────────────────
 *
 * Уся інша статистика рахується з подій: їх надсилає браузер, і частина
 * губиться — блокер, відмова від cookie, закрита вкладка. Для питання
 * «звідки прийшли» ця втрата стерпна, бо вона однакова для всіх джерел.
 *
 * Для питання «скільки заробили» вона нестерпна. Тому продажі рахуються
 * із замовлень, і тільки з них. Ці два числа ніколи не збіжаться між
 * собою, і зводити їх не треба: подія відповідає на «де загубились»,
 * замовлення — на «на чому заробили».
 */

export interface SoldTag {
  readonly key: string;
  readonly label: string;
}

/** Один рядок проданого замовлення, уже з назвами. */
export interface SoldRow {
  readonly orderId: string;
  readonly quantity: number;
  /** Знімок ціни на момент замовлення, після знижки. */
  readonly lineTotalMinor: number;
  /** null — базовий одяг без принта. */
  readonly print: SoldTag | null;
  readonly breeds: readonly SoldTag[];
  readonly collections: readonly SoldTag[];
  readonly garment: SoldTag;
  readonly colour: SoldTag;
  readonly size: SoldTag;
}

interface Bucket {
  label: string;
  quantity: number;
  revenueMinor: number;
}

function add(into: Map<string, Bucket>, tag: SoldTag, quantity: number, revenueMinor: number): void {
  const found = into.get(tag.key);
  if (found === undefined) {
    into.set(tag.key, { label: tag.label, quantity, revenueMinor });
    return;
  }
  found.quantity += quantity;
  found.revenueMinor += revenueMinor;
}

function rows(from: Map<string, Bucket>, limit: number): SoldRowDto[] {
  return [...from.entries()]
    .map(([key, b]) => ({ key, label: b.label, quantity: b.quantity, revenueMinor: b.revenueMinor }))
    // За грошима, не за штуками: три худі по 1700 важливіші за пʼять
    // футболок по 590, і список має відкриватись саме тим, що годує.
    .sort((a, b) => b.revenueMinor - a.revenueMinor || b.quantity - a.quantity)
    .slice(0, limit);
}

/**
 * Розкласти суму рядка між кількома мітками без утрати копійок.
 *
 * Принт «такса і йорк» належить двом породам. Зарахувати йому повну суму
 * обом означає, що стовпчик доходу за породами буде більшим за загальний
 * дохід — і перша ж людина, яка додасть числа, перестане вірити звіту.
 * Тому сума ділиться, а залишок від ділення лягає на першу мітку: так
 * підсумок сходиться до копійки.
 *
 * Для принта з однією породою — а таких більшість — не змінюється нічого.
 */
function split(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  const out = new Array<number>(parts).fill(base);
  out[0] = (out[0] as number) + (total - base * parts);
  return out;
}

const TOP = 15;

export function summariseSales(days: number, sold: readonly SoldRow[]): SalesStatsDto {
  const prints = new Map<string, Bucket>();
  const breeds = new Map<string, Bucket>();
  const collections = new Map<string, Bucket>();
  const garments = new Map<string, Bucket>();
  const sizes = new Map<string, Bucket>();
  const colours = new Map<string, Bucket>();

  const orderIds = new Set<string>();
  let items = 0;
  let revenueMinor = 0;
  let printedItems = 0;

  for (const row of sold) {
    orderIds.add(row.orderId);
    items += row.quantity;
    revenueMinor += row.lineTotalMinor;

    add(garments, row.garment, row.quantity, row.lineTotalMinor);
    add(sizes, row.size, row.quantity, row.lineTotalMinor);
    add(colours, row.colour, row.quantity, row.lineTotalMinor);

    if (row.print === null) continue;
    printedItems += row.quantity;
    add(prints, row.print, row.quantity, row.lineTotalMinor);

    const perBreed = split(row.lineTotalMinor, row.breeds.length);
    row.breeds.forEach((b, i) => add(breeds, b, row.quantity, perBreed[i] as number));

    const perCollection = split(row.lineTotalMinor, row.collections.length);
    row.collections.forEach((c, i) => add(collections, c, row.quantity, perCollection[i] as number));
  }

  const orders = orderIds.size;

  return {
    days,
    totals: {
      orders,
      items,
      revenueMinor,
      averageOrderMinor: orders === 0 ? 0 : Math.round(revenueMinor / orders),
      printedHundredths: items === 0 ? 0 : Math.round((printedItems / items) * 10_000),
    },
    prints: rows(prints, TOP),
    breeds: rows(breeds, TOP),
    collections: rows(collections, TOP),
    garments: rows(garments, TOP),
    sizes: rows(sizes, TOP),
    colours: rows(colours, TOP),
  };
}
