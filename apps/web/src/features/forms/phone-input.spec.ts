import { describe, expect, it } from 'vitest';
import { normalisePhone } from '@dt/contracts';
import { formatUaPhoneInput, phoneValueOnBlur, phoneValueOnFocus } from './phone-input';

describe('formatUaPhoneInput', () => {
  it('після +38 набирають 0XX — виходить канонічний номер', () => {
    expect(formatUaPhoneInput('+380671234567')).toBe('+380671234567');
    expect(normalisePhone(formatUaPhoneInput('+380671234567'))).toBe('+380671234567');
  });

  it('префікс не стирається', () => {
    for (const raw of ['', '+', '+3', ' ']) expect(formatUaPhoneInput(raw)).toBe('+38');
  });

  it('вставлений чи автозаповнений номер у будь-якому вигляді зводиться до +380…', () => {
    for (const raw of ['0671234567', '067 123 45 67', '380671234567', '+38 (067) 123-45-67', '+38+380671234567']) {
      expect(formatUaPhoneInput(raw)).toBe('+380671234567');
    }
  });

  it('зайві цифри обрізаються, літери ігноруються', () => {
    expect(formatUaPhoneInput('+3806712345678999')).toBe('+380671234567');
    expect(formatUaPhoneInput('+38067abc')).toBe('+38067');
  });
});

describe('фокус і блюр', () => {
  it('порожнє поле на фокусі отримує +38, заповнене не чіпаємо', () => {
    expect(phoneValueOnFocus('')).toBe('+38');
    expect(phoneValueOnFocus('+38067')).toBe('+38067');
  });

  it('на блюрі самотній +38 прибирається', () => {
    expect(phoneValueOnBlur('+38')).toBe('');
    expect(phoneValueOnBlur('+38067')).toBe('+38067');
  });
});
