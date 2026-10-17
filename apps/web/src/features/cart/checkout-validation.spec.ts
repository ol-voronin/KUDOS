import { describe, expect, it } from 'vitest';
import { formatUaPhoneInput } from '@/features/forms/phone-input';
import {
  FIELD_IDS, fieldError, firstInvalid, phoneError, validateCheckout, type CheckoutValues,
} from './checkout-validation';

const valid: CheckoutValues = {
  name: 'Оксана',
  phone: '+380671234567',
  method: 'NP_BRANCH',
  city: 'Харків',
  branch: '12',
  otherRecipient: false,
  recipientPhone: '',
};

describe('validateCheckout', () => {
  it('заповнена форма — без помилок', () => {
    expect(validateCheckout(valid)).toEqual({});
    expect(firstInvalid(validateCheckout(valid))).toBeUndefined();
  });

  it('порожня форма — помилка біля кожного обовʼязкового поля, фокус на імені', () => {
    const errors = validateCheckout({ ...valid, name: '', phone: '', city: '', branch: '' });
    expect(Object.keys(errors)).toEqual(['name', 'phone', 'city', 'branch']);
    expect(firstInvalid(errors)).toBe('name');
    expect(FIELD_IDS[firstInvalid(errors)!]).toBe('co-name');
  });

  it('перше невалідне поле — у порядку сторінки, а не в порядку перевірки', () => {
    const errors = validateCheckout({ ...valid, phone: '+38050', branch: '' });
    expect(firstInvalid(errors)).toBe('phone');
  });

  it('імʼя з однієї літери не проходить, як і на сервері (min 2)', () => {
    expect(fieldError('name', { ...valid, name: 'А' })).toBeDefined();
    expect(fieldError('name', { ...valid, name: '  Ян  ' })).toBeUndefined();
  });

  it('самовивіз не питає місто й відділення', () => {
    expect(validateCheckout({ ...valid, method: 'PICKUP', city: '', branch: '' })).toEqual({});
  });

  it('текст помилки адреси залежить від способу доставки', () => {
    expect(fieldError('branch', { ...valid, method: 'NP_POSTOMAT', branch: '' })).toMatch(/поштомата/);
    expect(fieldError('branch', { ...valid, method: 'NP_COURIER', branch: '' })).toMatch(/вулиця/);
  });

  it('телефон одержувача необовʼязковий, але якщо почали — має бути повним', () => {
    expect(fieldError('recipientPhone', { ...valid, otherRecipient: true, recipientPhone: '' })).toBeUndefined();
    expect(fieldError('recipientPhone', { ...valid, otherRecipient: true, recipientPhone: '+38067' })).toBeDefined();
    // Галочку зняли — поле не перевіряється.
    expect(fieldError('recipientPhone', { ...valid, otherRecipient: false, recipientPhone: '+38067' })).toBeUndefined();
  });
});

describe('phoneError', () => {
  it('порожньо й самотній +38 — «потрібен телефон»', () => {
    expect(phoneError('', true)).toMatch(/Потрібен телефон/);
    expect(phoneError('+38', true)).toMatch(/Потрібен телефон/);
  });

  it('недописаний номер — скільки цифр бракує, з правильним відмінком', () => {
    expect(phoneError(formatUaPhoneInput('050'), true)).toBe('Допиши ще 7 цифр: має бути 0XX XXX XX XX');
    expect(phoneError(formatUaPhoneInput('06712345'), true)).toBe('Допиши ще 2 цифри: має бути 0XX XXX XX XX');
    expect(phoneError(formatUaPhoneInput('067123456'), true)).toBe('Допиши ще 1 цифру: має бути 0XX XXX XX XX');
  });

  it('номер не з нуля — підказка про 0', () => {
    expect(phoneError('+38671234567', true)).toMatch(/починатися з 0/);
  });

  it('повний номер у будь-якому вигляді після поля — без помилки', () => {
    for (const raw of ['0671234567', '+38 (067) 123-45-67', '380671234567']) {
      expect(phoneError(formatUaPhoneInput(raw), true)).toBeUndefined();
    }
  });
});
