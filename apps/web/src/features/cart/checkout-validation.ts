import type { DeliveryMethod } from '@dt/contracts';

/**
 * Перевірка форми оформлення — окремо від компонента, щоб її можна було
 * перевірити тестом без браузера.
 *
 * Раніше форма перевіряла лише при відправленні, по одній помилці за раз,
 * і показувала її плашкою в підсумку, далеко від поля. Людина на телефоні
 * не бачила, що саме не так (аудит 17.10.2026, 03-ux #11, 05-a11y 3.3.1).
 * Тепер кожне поле має свою помилку: на blur і при відправленні.
 *
 * Правила збігаються із сервером (`OrderDraftRequestDto`): імʼя від 2
 * символів, телефон `+380XXXXXXXXX`, місто й відділення — для всіх способів,
 * крім самовивозу. Сервер однаково перевірить усе ще раз.
 */

export const PHONE_PATTERN = /^\+380\d{9}$/;

export interface CheckoutValues {
  readonly name: string;
  readonly phone: string;
  readonly method: DeliveryMethod;
  readonly city: string;
  readonly branch: string;
  readonly otherRecipient: boolean;
  readonly recipientPhone: string;
}

export type CheckoutField = 'name' | 'phone' | 'city' | 'branch' | 'recipientPhone';

/** Порядок полів на сторінці: на перше невалідне ставимо фокус. */
export const FIELD_ORDER: readonly CheckoutField[] = ['name', 'phone', 'city', 'branch', 'recipientPhone'];

/** `id` інпута для кожного поля — щоб перевести на нього фокус. */
export const FIELD_IDS: Readonly<Record<CheckoutField, string>> = {
  name: 'co-name',
  phone: 'co-phone',
  city: 'co-city',
  branch: 'co-branch',
  recipientPhone: 'co-rec-phone',
};

export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

const BRANCH_MISSING: Readonly<Record<DeliveryMethod, string>> = {
  NP_BRANCH: 'Вкажи номер відділення',
  NP_POSTOMAT: 'Вкажи номер поштомата',
  NP_COURIER: 'Вкажи адресу: вулиця, будинок, квартира',
  PICKUP: '',
};

/**
 * Телефон. Поле саме тримає `+38` і до 10 цифр (`phone-input.ts`), тож
 * помилка буває лише двох видів: порожньо або не дописано. Кажемо, скільки
 * цифр бракує, а не повторюємо формат, якого людина не набирає.
 */
export function phoneError(value: string, required: boolean): string | undefined {
  if (value === '' || value === '+38') return required ? 'Потрібен телефон: напишемо щодо замовлення' : undefined;
  if (PHONE_PATTERN.test(value)) return undefined;
  const national = value.startsWith('+38') ? value.slice(3) : value.replace(/\D/g, '');
  if (!national.startsWith('0')) return 'Номер має починатися з 0: 0XX XXX XX XX';
  const missing = 10 - national.length;
  if (missing > 0) {
    return `Допиши ще ${missing} ${missing === 1 ? 'цифру' : missing < 5 ? 'цифри' : 'цифр'}: має бути 0XX XXX XX XX`;
  }
  return 'Перевір номер: має бути 0XX XXX XX XX';
}

export function fieldError(field: CheckoutField, v: CheckoutValues): string | undefined {
  const needsAddress = v.method !== 'PICKUP';
  switch (field) {
    case 'name': {
      const n = v.name.trim();
      if (n === '') return 'Напиши, як до тебе звертатися';
      if (n.length < 2) return 'Імʼя — хоча б 2 літери';
      return undefined;
    }
    case 'phone':
      return phoneError(v.phone, true);
    case 'city':
      return needsAddress && v.city.trim() === '' ? 'Вкажи місто' : undefined;
    case 'branch':
      return needsAddress && v.branch.trim() === '' ? BRANCH_MISSING[v.method] : undefined;
    case 'recipientPhone':
      return v.otherRecipient ? phoneError(v.recipientPhone, false) : undefined;
  }
}

export function validateCheckout(v: CheckoutValues): CheckoutErrors {
  const errors: CheckoutErrors = {};
  for (const field of FIELD_ORDER) {
    const e = fieldError(field, v);
    if (e !== undefined) errors[field] = e;
  }
  return errors;
}

export function firstInvalid(errors: CheckoutErrors): CheckoutField | undefined {
  return FIELD_ORDER.find((f) => errors[f] !== undefined);
}
