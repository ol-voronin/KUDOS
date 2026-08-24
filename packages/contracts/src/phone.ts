import { z } from 'zod';

/**
 * Один формат телефону на весь застосунок.
 *
 * Причина існування цього файлу — реальний баг: заявка приймала
 * `/^\+?\d{10,15}$/`, а оплата й бриф `/^\+380\d{9}$/`. `Customer.phone` —
 * унікальний ключ, за яким робиться upsert, тож той самий покупець,
 * збережений як `380671234567` із заявки й `+380671234567` з оплати, давав
 * два рядки Customer. Це ламало саме ту базу номерів, заради якої все
 * будувалося: «третє замовлення» рахувалося неправильно, а розсилка пішла б
 * двічі.
 *
 * Тому валідація тут не сувора, а **нормалізуюча**: приймаємо все, що реальна
 * людина набирає в формі, і зводимо до однієї канонічної форми
 * `+380XXXXXXXXX` ще до того, як воно доїде до бази.
 */

/** Канонічна форма, у якій телефон лежить у базі. */
export const PHONE_CANONICAL = /^\+380\d{9}$/;

/**
 * Зводить український номер до `+380XXXXXXXXX`.
 * Повертає `null`, якщо з введеного не виходить валідний український номер —
 * рішення, що з цим робити, лишається за схемою.
 */
export function normalisePhone(input: string): string | null {
  // Люди пишуть пробіли, дефіси, дужки й крапки. Жоден із них не є частиною номера.
  const cleaned = input.replace(/[\s()\-. ‐-―]/g, '');
  if (!/^\+?\d+$/.test(cleaned)) return null;

  const explicitlyInternational = cleaned.startsWith('+');
  const digits = cleaned.replace(/^\+/, '');

  // +380XXXXXXXXX / 380XXXXXXXXX — 12 цифр із кодом країни
  if (digits.length === 12 && digits.startsWith('380')) return `+${digits}`;

  // Плюс — це заявка «я пишу номер повністю, з кодом країни». Тоді нічого,
  // крім форми вище, не приймаємо: інакше обрізаний `+380671234` тихо стає
  // `+380380671234`, і в базі зʼявляється чужий валідний на вигляд номер.
  if (explicitlyInternational) return null;

  // 0XXXXXXXXX — як набирають усередині країни
  if (digits.length === 10 && digits.startsWith('0')) return `+38${digits}`;
  // XXXXXXXXX — без нуля, як інколи диктують («67 123 45 67»)
  if (digits.length === 9) return `+380${digits}`;

  return null;
}

/**
 * Схема для будь-якого входу, що приймає телефон.
 * На виході — завжди канонічна форма, незалежно від того, як його набрали.
 */
export const PhoneSchema = z
  .string()
  .trim()
  .min(1, 'Вкажіть телефон')
  .transform((value, ctx) => {
    const normalised = normalisePhone(value);
    if (!normalised) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Телефон у форматі +380XXXXXXXXX',
      });
      return z.NEVER;
    }
    return normalised;
  });
