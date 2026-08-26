/**
 * Money is ALWAYS an integer number of kopiykas (1 UAH = 100 kopiykas).
 *
 * Floats are banned in this codebase for money: 0.1 + 0.2 !== 0.3, and a
 * rounding drift of one kopiyka per line item becomes a reconciliation
 * problem the moment there is a second person looking at the numbers.
 *
 * Rendering to "1 600 ₴" happens once, at the edge, in `formatUAH`.
 */
export type Minor = number & { readonly __brand: 'Minor' };

export const KOPIYKAS_IN_UAH = 100;

export function minor(value: number): Minor {
  if (!Number.isInteger(value)) {
    throw new TypeError(`Money must be an integer amount of kopiykas, got ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Money amount is outside the safe integer range: ${value}`);
  }
  return value as Minor;
}

/** 1600 UAH -> 160000 kopiykas. Accepts at most two decimal places. */
export function fromUAH(uah: number): Minor {
  const scaled = Math.round(uah * KOPIYKAS_IN_UAH);
  if (Math.abs(scaled - uah * KOPIYKAS_IN_UAH) > 1e-6) {
    throw new RangeError(`UAH amount has sub-kopiyka precision: ${uah}`);
  }
  return minor(scaled);
}

export function addMinor(...amounts: Minor[]): Minor {
  return minor(amounts.reduce<number>((sum, a) => sum + a, 0));
}

export function subMinor(a: Minor, b: Minor): Minor {
  return minor(a - b);
}

/** Multiplication by an integer quantity only — never by a fractional rate. */
export function mulMinor(amount: Minor, quantity: number): Minor {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new TypeError(`Quantity must be a non-negative integer, got ${quantity}`);
  }
  return minor(amount * quantity);
}

/**
 * Відсоток від суми, у сотих відсотка: 1000 = 10 %.
 *
 * Окрема функція, а не множення на 0.1, і причина та сама, чому в цьому файлі
 * узагалі немає чисел із комою. Ставка — це не гроші, тому вона й зберігається
 * цілим числом; єдине місце, де вона зустрічається з грошима, — цей рядок,
 * і тут одразу відбувається округлення до копійки.
 *
 * Округлення симетричне: −0.5 копійки йде в −1, а не в 0, як зробив би
 * `Math.round`. Інакше знижка й така сама надбавка дають різні за модулем
 * суми, і рядок замовлення не сходиться сам із собою на одну копійку.
 */
export const PERCENT_SCALE = 10_000;

export function percentOfMinor(amount: Minor, hundredthsOfPercent: number): Minor {
  if (!Number.isInteger(hundredthsOfPercent)) {
    throw new TypeError(`Ставка має бути цілим числом сотих відсотка, отримано ${hundredthsOfPercent}`);
  }
  const raw = (amount * hundredthsOfPercent) / PERCENT_SCALE;
  return minor(Math.sign(raw) * Math.round(Math.abs(raw)));
}

export function clampToZero(amount: Minor): Minor {
  return minor(Math.max(0, amount));
}

const uahFormatter = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatUAH(amount: Minor): string {
  return uahFormatter.format(amount / KOPIYKAS_IN_UAH);
}
