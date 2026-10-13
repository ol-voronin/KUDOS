import { describe, expect, it } from 'vitest';
import { hashPhone, normalizePhone } from './client';
import { claimPurchaseOnce, isPurchaseConfirmed } from './purchase';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => { map.delete(k); },
    setItem: (k, v) => { map.set(k, v); },
  };
}

describe('isPurchaseConfirmed', () => {
  it('рахує HOLD як покупку', () => {
    expect(isPurchaseConfirmed('PENDING_PAYMENT', 'HOLD')).toBe(true);
  });

  it('рахує PAID і пізніші стани', () => {
    for (const s of ['PAID', 'IN_PRODUCTION', 'SHIPPED', 'COMPLETED']) {
      expect(isPurchaseConfirmed(s, null)).toBe(true);
    }
  });

  it('не рахує очікування, нове й скасоване', () => {
    expect(isPurchaseConfirmed('NEW', null)).toBe(false);
    expect(isPurchaseConfirmed('PENDING_PAYMENT', 'CREATED')).toBe(false);
    expect(isPurchaseConfirmed('PENDING_PAYMENT', 'PROCESSING')).toBe(false);
    expect(isPurchaseConfirmed('PENDING_PAYMENT', null)).toBe(false);
    expect(isPurchaseConfirmed('CANCELLED', 'HOLD')).toBe(false);
    expect(isPurchaseConfirmed('CANCELLED', 'REVERSED')).toBe(false);
  });
});

describe('claimPurchaseOnce', () => {
  it('пропускає тільки перший раз на замовлення', () => {
    const storage = memoryStorage();
    expect(claimPurchaseOnce('a', storage)).toBe(true);
    expect(claimPurchaseOnce('a', storage)).toBe(false);
    expect(claimPurchaseOnce('b', storage)).toBe(true);
  });

  it('без сховища надсилає (дублі відкине transaction_id)', () => {
    const broken = { getItem: () => { throw new Error('denied'); } } as unknown as Storage;
    expect(claimPurchaseOnce('a', broken)).toBe(true);
  });
});

describe('normalizePhone / hashPhone', () => {
  it('зводить українські формати до E.164', () => {
    expect(normalizePhone('+380671234567')).toBe('+380671234567');
    expect(normalizePhone('380 67 123 45 67')).toBe('+380671234567');
    expect(normalizePhone('067-123-45-67')).toBe('+380671234567');
    expect(normalizePhone('12345')).toBeNull();
  });

  it('однаковий хеш для різних записів того самого номера', async () => {
    const a = await hashPhone('+380671234567');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashPhone('067 123 45 67')).toBe(a);
    expect(await hashPhone('abc')).toBeNull();
  });
});
