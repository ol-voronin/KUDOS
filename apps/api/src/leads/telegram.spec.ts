import { describe, expect, it } from 'vitest';
import { escapeHtml, formatLead } from './telegram';

describe('formatLead', () => {
  it('містить ім’я і телефон', () => {
    const msg = formatLead({ name: 'Оля', phone: '+380671234567' });
    expect(msg).toContain('Оля');
    expect(msg).toContain('+380671234567');
  });

  it('не ламається на імені з кутовими дужками', () => {
    expect(formatLead({ name: 'Аня <3 & Co', phone: '+380671234567' }))
      .toContain('Аня &lt;3 &amp; Co');
  });

  it('додає повідомлення, якщо воно є', () => {
    expect(formatLead({ name: 'О', phone: '+380671234567', message: 'худі з коргі' }))
      .toContain('худі з коргі');
  });

  it('escape по порядку: & перед <', () => {
    expect(escapeHtml('<')).toBe('&lt;');
  });
});
