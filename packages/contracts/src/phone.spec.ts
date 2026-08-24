import { describe, expect, it } from 'vitest';
import { normalisePhone, PhoneSchema, PHONE_CANONICAL } from './phone';

describe('normalisePhone', () => {
  it('зводить усі поширені записи одного номера до однієї форми', () => {
    const same = [
      '+380671234567',
      '380671234567',
      '0671234567',
      '671234567',
      '+38 (067) 123-45-67',
      ' +380 67 123 45 67 ',
      '067 123 45 67',
    ];
    const results = same.map(normalisePhone);
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe('+380671234567');
  });

  it('це і є той баг, через який заводилось два Customer на одну людину', () => {
    // Стара заявка приймала це, стара оплата — те. Ключ Customer.phone унікальний.
    expect(normalisePhone('380671234567')).toBe(normalisePhone('+380671234567'));
  });

  it('усе, що виходить, збігається з канонічним форматом', () => {
    for (const input of ['0501112233', '+380501112233', '501112233']) {
      expect(normalisePhone(input)).toMatch(PHONE_CANONICAL);
    }
  });

  it('відмовляє на неукраїнських і покалічених номерах', () => {
    for (const bad of ['+1 202 555 0114', '12345', '', '+380671234', '+3806712345678', 'не телефон', '+380abc123456']) {
      expect(normalisePhone(bad)).toBeNull();
    }
  });
});

describe('PhoneSchema', () => {
  it('віддає канонічну форму, а не те, що ввели', () => {
    expect(PhoneSchema.parse('067 123 45 67')).toBe('+380671234567');
  });

  it('падає з людською помилкою', () => {
    const result = PhoneSchema.safeParse('12345');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('+380');
    }
  });
});
