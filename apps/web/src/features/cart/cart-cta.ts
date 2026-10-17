/**
 * Стан кнопки «Оформити замовлення» в кошику.
 *
 * Раніше кнопка мовчки ставала напівпрозорою й переставала реагувати на
 * тап (`pointer-events-none`), поки йде розрахунок, коли він упав і коли в
 * кошику є недоступна позиція, — а пояснення було лише для останнього
 * випадку (аудит 17.10.2026, 03-ux П3, #8). Тепер у кожного стану свій вигляд:
 *
 *   counting — розрахунок у дорозі: «Рахуємо суму…» зі спінером;
 *   error    — розрахунок не прийшов: кнопка «Порахувати ще раз»;
 *   blocked  — є позиція, яку не можна купити: пояснення, що прибрати;
 *   ready    — посилання на оформлення.
 */
export type CartCtaState = 'counting' | 'error' | 'blocked' | 'ready';

export function cartCtaState(q: { hasQuote: boolean; purchasable: boolean | undefined; isError: boolean }): CartCtaState {
  if (!q.hasQuote) return q.isError ? 'error' : 'counting';
  return q.purchasable === true ? 'ready' : 'blocked';
}
