import { describe, expect, it } from 'vitest';
import { summariseSales, type SoldRow } from './sales.domain';

const garment = { key: 'futbolka-klasychna', label: 'Класична футболка' };
const colour = { key: 'chornyi', label: 'Чорний' };
const size = { key: 'M', label: 'M' };

function row(over: Partial<SoldRow> = {}): SoldRow {
  return {
    orderId: 'o1',
    quantity: 1,
    lineTotalMinor: 74_000,
    print: { key: 'pab-taksa', label: 'Такса в пабі' },
    breeds: [{ key: 'taksa', label: 'Такса' }],
    collections: [{ key: 'pab', label: 'Бабаки в пабі' }],
    garment,
    colour,
    size,
    ...over,
  };
}

describe('зведення продажів', () => {
  it('порожній період не вигадує чисел', () => {
    const s = summariseSales(30, []);
    expect(s.totals).toEqual({
      orders: 0, items: 0, revenueMinor: 0, averageOrderMinor: 0, printedHundredths: 0,
    });
    expect(s.prints).toEqual([]);
  });

  it('замовлення рахуються унікальними, штуки — сумою', () => {
    const s = summariseSales(30, [
      row({ orderId: 'a', quantity: 2 }),
      row({ orderId: 'a', quantity: 1 }),
      row({ orderId: 'b', quantity: 1 }),
    ]);
    expect(s.totals.orders).toBe(2);
    expect(s.totals.items).toBe(4);
  });

  it('середній чек — це дохід на замовлення, а не на рядок', () => {
    const s = summariseSales(30, [
      row({ orderId: 'a', lineTotalMinor: 60_000 }),
      row({ orderId: 'a', lineTotalMinor: 40_000 }),
    ]);
    expect(s.totals.revenueMinor).toBe(100_000);
    expect(s.totals.averageOrderMinor).toBe(100_000);
  });

  it('базовий одяг не потрапляє в принти, але потрапляє у вироби', () => {
    const s = summariseSales(30, [
      row({ print: null, breeds: [], collections: [] }),
      row(),
    ]);
    expect(s.prints).toHaveLength(1);
    expect(s.garments[0]?.quantity).toBe(2);
    expect(s.totals.printedHundredths).toBe(5_000);
  });

  /*
   * Головна перевірка всього файлу. Принт із двома породами не має
   * подвоювати дохід: інакше стовпчик за породами переростає загальний
   * дохід, і звіту перестають вірити.
   */
  it('принт із двома породами ділить дохід, а не подвоює його', () => {
    const s = summariseSales(30, [row({
      lineTotalMinor: 100_001,
      breeds: [{ key: 'taksa', label: 'Такса' }, { key: 'york', label: 'Йорк' }],
    })]);
    const sum = s.breeds.reduce((acc, b) => acc + b.revenueMinor, 0);
    expect(sum).toBe(100_001);
    expect(s.breeds.map((b) => b.revenueMinor).sort((a, b) => a - b)).toEqual([50_000, 50_001]);
  });

  it('штуки за породою не діляться — половини футболки не буває', () => {
    const s = summariseSales(30, [row({
      quantity: 3,
      breeds: [{ key: 'taksa', label: 'Такса' }, { key: 'york', label: 'Йорк' }],
    })]);
    expect(s.breeds.every((b) => b.quantity === 3)).toBe(true);
  });

  it('списки впорядковані за грошима, а не за штуками', () => {
    const s = summariseSales(30, [
      row({ orderId: 'a', quantity: 5, lineTotalMinor: 29_500, print: { key: 'cheap', label: 'Дешевий' }, breeds: [], collections: [] }),
      row({ orderId: 'b', quantity: 1, lineTotalMinor: 170_000, print: { key: 'rich', label: 'Дорогий' }, breeds: [], collections: [] }),
    ]);
    expect(s.prints.map((p) => p.key)).toEqual(['rich', 'cheap']);
  });
});
