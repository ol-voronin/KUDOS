import { describe, expect, it } from 'vitest';
import { metaFirstName, metaPhone, purchaseEventId, sha256 } from './meta-capi.service';
import { isMetaPurchaseMoment } from '../payments/payments-webhook.service';

describe('Conversions API Meta', () => {
  it('телефон — цифри з кодом країни, без плюса', () => {
    expect(metaPhone('+380671234567')).toBe('380671234567');
    expect(metaPhone('067 123 45 67')).toBe('380671234567');
  });

  it('імʼя — перше слово малими', () => {
    expect(metaFirstName('  Олена Петрівна ')).toBe('олена');
  });

  it('event_id той самий, що в браузері', () => {
    expect(purchaseEventId(42)).toBe('order-42');
  });

  it('sha256 у hex', () => {
    expect(sha256('ua')).toHaveLength(64);
  });

  it('покупка йде один раз: на HOLD або на SUCCESS повз HOLD', () => {
    expect(isMetaPurchaseMoment('PROCESSING', 'HOLD')).toBe(true);
    expect(isMetaPurchaseMoment('HOLD', 'SUCCESS')).toBe(false);
    expect(isMetaPurchaseMoment('PROCESSING', 'SUCCESS')).toBe(true);
    expect(isMetaPurchaseMoment('HOLD', 'FAILURE')).toBe(false);
  });
});
