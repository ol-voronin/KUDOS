'use client';

/**
 * Розмір, який людина вже обирала.
 *
 * Найдорожча дія на сторінці товару — не «купити», а «згадати, який у мене
 * розмір». Людина йде дивитися таблицю, повертається, обирає — і робить це
 * знову на кожному наступному товарі, хоча відповідь та сама.
 *
 * Тому запамʼятовується не ідентифікатор варіанта, а **напис** розміру: «M»
 * на футболці й «M» на худі — це різні рядки в базі, але для покупця це та
 * сама відповідь. Ідентифікатор став би непридатним щойно людина перейшла б
 * на інший виріб.
 *
 * Свідомо не вважається персональними даними: у сховищі лежить рядок «M»,
 * без будь-чого, що дозволяє впізнати людину, і він не залишає браузер.
 */
const KEY = 'dt.size';

export function readRememberedSize(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(KEY);
    return value === null || value === '' ? null : value;
  } catch {
    // Приватний режим або вимкнене сховище. Підказка не варта збою сторінки.
    return null;
  }
}

export function rememberSize(label: string): void {
  if (typeof window === 'undefined' || label === '') return;
  try {
    window.localStorage.setItem(KEY, label);
  } catch { /* мовчки */ }
}
