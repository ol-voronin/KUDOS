/**
 * Поле телефону з готовим «+38».
 *
 * Щойно людина ставить курсор у порожнє поле, там уже стоїть `+38`, і
 * лишається набрати звичні `0XX XXX XX XX`. Префікс не стирається:
 * що б не набрали чи не вставили (`067…`, `380…`, `+380…`, з пробілами),
 * у полі буде `+38` і до 10 цифр. Тобто після введення номера значення
 * одразу має канонічну форму `+380XXXXXXXXX` з `@dt/contracts`.
 * Якщо людина пішла з поля, нічого не набравши, `+38` прибираємо, щоб
 * порожнє обовʼязкове поле не виглядало заповненим.
 */

export const UA_PHONE_PREFIX = '+38';

/** Скільки цифр іде після `+38`: `0` + 9 цифр номера. */
const NATIONAL_DIGITS = 10;

export function formatUaPhoneInput(raw: string): string {
  const trimmed = raw.trim();
  // Стерли частину префікса (`+3`, `+`, порожньо): повертаємо його цілим.
  if (UA_PHONE_PREFIX.startsWith(trimmed)) return UA_PHONE_PREFIX;

  const rest = trimmed.startsWith(UA_PHONE_PREFIX) ? trimmed.slice(UA_PHONE_PREFIX.length) : trimmed;
  const digits = rest.replace(/\D/g, '');
  // Повний номер, вставлений поверх `+38` або без нього: `380…` → `0…`.
  const national = digits.startsWith('380') ? digits.slice(2) : digits;
  return UA_PHONE_PREFIX + national.slice(0, NATIONAL_DIGITS);
}

/** На фокусі: порожнє поле отримує `+38`. */
export function phoneValueOnFocus(value: string): string {
  return value === '' ? UA_PHONE_PREFIX : value;
}

/** На блюрі: самотній `+38` без цифр знову стає порожнім полем. */
export function phoneValueOnBlur(value: string): string {
  return value === UA_PHONE_PREFIX ? '' : value;
}

/** Обробники для `<input type="tel">`: `value` + `onChange`/`onFocus`/`onBlur`. */
export function phoneInputHandlers(value: string, setValue: (next: string) => void) {
  return {
    value,
    onChange: (raw: string) => setValue(formatUaPhoneInput(raw)),
    onFocus: () => setValue(phoneValueOnFocus(value)),
    onBlur: () => setValue(phoneValueOnBlur(value)),
  };
}

/** Те саме для «голого» `<input>`, де `onChange` отримує подію. */
export function phoneEventHandlers(value: string, setValue: (next: string) => void) {
  const { onChange, ...rest } = phoneInputHandlers(value, setValue);
  return { ...rest, onChange: (e: { target: { value: string } }) => onChange(e.target.value) };
}
