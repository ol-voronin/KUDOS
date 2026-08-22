import { formatUAH, minor } from '@dt/contracts';
import { describe, expect, it } from 'vitest';
import { formatOrderPaid } from './format-order-notification';

const base = {
  orderNumber: 42,
  customerName: 'Оля',
  customerPhone: '+380671234567',
  printTitle: 'Корги в листі',
  garmentName: 'Оверсайз худі',
  colourName: 'Чорний',
  sizeLabel: 'L',
  quantity: 1,
  totalMinor: minor(160000),
};

describe('formatOrderPaid', () => {
  it('містить номер замовлення, ім\u2019я, телефон і суму', () => {
    const msg = formatOrderPaid(base);
    expect(msg).toContain('№42');
    expect(msg).toContain('Оля');
    expect(msg).toContain('+380671234567');
    expect(msg).toContain(formatUAH(base.totalMinor));
  });

  it('не ламається на назві з кутовими дужками', () => {
    const msg = formatOrderPaid({ ...base, printTitle: 'Корги <3 & Co' });
    expect(msg).toContain('Корги &lt;3 &amp; Co');
  });

  it('додає нотатку, якщо вона є', () => {
    const msg = formatOrderPaid({ ...base, note: 'довжину коротше' });
    expect(msg).toContain('довжину коротше');
  });

  it('без нотатки повідомлення не перевищує очікувану кількість рядків', () => {
    const withNote = formatOrderPaid({ ...base, note: 'x' });
    const withoutNote = formatOrderPaid(base);
    expect(withoutNote.split('\n').length).toBeLessThan(withNote.split('\n').length);
  });
});
