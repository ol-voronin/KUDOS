import { describe, expect, it } from 'vitest';
import { addWorkingDays, formatShipWindow, shipWindow } from './delivery-estimate';

// Понеділок, 1 вересня 2025.
const MONDAY = new Date(2025, 8, 1);

describe('addWorkingDays', () => {
  it('нуль днів — це той самий день', () => {
    expect(addWorkingDays(MONDAY, 0).getDate()).toBe(1);
  });

  it('перестрибує вихідні', () => {
    // Пн +5 робочих = наступний понеділок, а не субота.
    const d = addWorkingDays(MONDAY, 5);
    expect(d.getDate()).toBe(8);
    expect(d.getDay()).toBe(1);
  });

  it('ніколи не приземляється на суботу чи неділю', () => {
    for (let i = 1; i <= 30; i += 1) {
      const day = addWorkingDays(MONDAY, i).getDay();
      expect(day).not.toBe(0);
      expect(day).not.toBe(6);
    }
  });

  it('від пʼятниці той самий строк дає пізнішу дату, ніж від понеділка', () => {
    // Саме заради цього дні робочі: «за 3 дні» у пʼятницю — це середа.
    const friday = new Date(2025, 8, 5);
    expect(addWorkingDays(friday, 3).getDate()).toBe(10);
    expect(addWorkingDays(MONDAY, 3).getDate()).toBe(4);
  });
});

describe('formatShipWindow', () => {
  it('не повторює місяць, коли він один', () => {
    expect(formatShipWindow(new Date(2025, 8, 2), new Date(2025, 8, 5))).toBe('2–5 вересня');
  });

  it('називає обидва місяці, коли вікно їх перетинає', () => {
    expect(formatShipWindow(new Date(2025, 7, 30), new Date(2025, 8, 4)))
      .toBe('30 серпня — 4 вересня');
  });

  it('одна дата — один рядок без діапазону', () => {
    expect(formatShipWindow(new Date(2025, 8, 3), new Date(2025, 8, 3))).toBe('3 вересня');
  });
});

describe('shipWindow', () => {
  it('строк пошиття ДОДАЄТЬСЯ до строку друку, а не замінює його', () => {
    // Виріб, який спершу шиють, не може виїхати швидше за той, що на складі.
    const inStock = shipWindow(4, 7, null, MONDAY);
    const sewn = shipWindow(4, 7, 5, MONDAY);
    expect(sewn.from.getTime()).toBeGreaterThan(inStock.from.getTime());
  });
});
