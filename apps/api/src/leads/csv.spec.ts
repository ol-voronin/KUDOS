import { describe, expect, it } from 'vitest';
import { escapeCsvField, rowsToCsv } from './csv';

describe('escapeCsvField', () => {
  it('лишає прості поля без змін', () => {
    expect(escapeCsvField('NEW')).toBe('NEW');
  });

  it('бере в лапки поле з комою', () => {
    expect(escapeCsvField('худі, коргі')).toBe('"худі, коргі"');
  });

  it('екранує внутрішні лапки подвоєнням', () => {
    expect(escapeCsvField('розмір "M"')).toBe('"розмір ""M"""');
  });

  it('бере в лапки поле з переносом рядка', () => {
    expect(escapeCsvField('рядок1\nрядок2')).toBe('"рядок1\nрядок2"');
  });
});

describe('rowsToCsv', () => {
  it('зʼєднує рядки CRLF і додає BOM', () => {
    const csv = rowsToCsv([['a', 'b'], ['1', '2']]);
    expect(csv).toBe('\uFEFFa,b\r\n1,2');
  });
});
