import { describe, expect, it } from 'vitest';
import {
  PAYMENT_TEXT, freeShippingProgress, productionLine, returnLine, shippingSummary,
} from '@/config/order-terms';
import { paymentText } from '@/config/product-copy';
import { cartCtaState } from './cart-cta';

describe('кнопка «Оформити замовлення» в кошику', () => {
  it('поки рахується — «рахуємо», а не мовчки сіра', () => {
    expect(cartCtaState({ hasQuote: false, purchasable: undefined, isError: false })).toBe('counting');
  });
  it('розрахунок упав — кнопка повтору', () => {
    expect(cartCtaState({ hasQuote: false, purchasable: undefined, isError: true })).toBe('error');
  });
  it('є недоступна позиція — пояснення', () => {
    expect(cartCtaState({ hasQuote: true, purchasable: false, isError: false })).toBe('blocked');
  });
  it('усе гаразд — посилання на оформлення', () => {
    expect(cartCtaState({ hasQuote: true, purchasable: true, isError: false })).toBe('ready');
  });
  it('старий розрахунок є, а фоновий перерахунок упав — кнопка лишається робочою', () => {
    expect(cartCtaState({ hasQuote: true, purchasable: true, isError: true })).toBe('ready');
  });
});

describe('доставка', () => {
  it('до порогу — орієнтир тарифу НП і коли платити', () => {
    const s = shippingSummary(119_000, 300_000);
    expect(s.free).toBe(false);
    expect(s.value).toBe('Нова Пошта, ~80–100 ₴');
    expect(s.note).toMatch(/оплачуєш при отриманні/);
  });
  it('від порогу — безкоштовно', () => {
    expect(shippingSummary(300_000, 300_000)).toMatchObject({ free: true, value: 'Безкоштовно' });
  });
  it('поріг 0 — безкоштовної доставки немає', () => {
    expect(shippingSummary(500_000, 0).free).toBe(false);
    expect(freeShippingProgress(500_000, 0)).toBeNull();
  });
  it('прогрес до безкоштовної доставки: скільки бракує і від якої суми', () => {
    const p = freeShippingProgress(119_000, 300_000)!;
    expect(p.missingMinor).toBe(181_000);
    expect(p.ratio).toBeCloseTo(0.397, 2);
    expect(p.text.replace(/\s/g, ' ')).toBe('Безкоштовна доставка від 3 000 ₴: бракує 1 810 ₴.');
    expect(freeShippingProgress(300_000, 300_000)).toBeNull();
  });
});

describe('строк і повернення', () => {
  it('строк із налаштувань плюс строк позицій під замовлення', () => {
    expect(productionLine(5)).toBe('Друкуємо до 5 робочих днів і одразу відправляємо.');
    expect(productionLine(5, 5)).toBe('Друкуємо до 5 робочих днів і одразу відправляємо. Цей колір готуємо під замовлення, тож разом до 10 робочих днів.');
    expect(productionLine(1)).toBe('Друкуємо до 1 робочого дня і одразу відправляємо.');
  });
  it('річ із принтом — лише брак; базовий одяг — днів із налаштувань', () => {
    expect(returnLine({ hasPrinted: true, hasBlank: false }, 14)).toMatch(/лише за браку або нашої помилки/);
    expect(returnLine({ hasPrinted: false, hasBlank: true }, 14)).toMatch(/протягом 14 днів/);
    expect(returnLine({ hasPrinted: false, hasBlank: true }, 21)).toMatch(/протягом 21 дня/);
  });
});

describe('оплата: один текст', () => {
  it('картка товару бере той самий текст, що кошик і оформлення', () => {
    for (const printed of [true, false]) {
      expect(paymentText({ returnDays: 14, freeShippingFromMinor: 300_000 }, printed)[0]).toBe(PAYMENT_TEXT);
    }
  });
  it('текст не обіцяє рахунку потім і післяплати', () => {
    expect(PAYMENT_TEXT).not.toMatch(/рахунок|післяплат|наявність/);
  });
});
