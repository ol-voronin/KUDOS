/**
 * Правила ціни: надбавки й знижки.
 *
 * Чисті функції, без Nest і без Prisma. Це важливо саме тут: ціна рахується
 * у трьох місцях — вітрина, каса, калькулятор в адмінці, — і всі три мусять
 * дати однакову суму. Єдиний спосіб це гарантувати — щоб усі три викликали
 * одну функцію, а не «майже таку саму».
 *
 * Порядок дій зафіксовано і він не довільний:
 *
 *     ціна виробу = база + Σ надбавок           (або ручна ціна варіанта)
 *     ціна одиниці = ціна виробу + друк
 *     рядок        = ціна одиниці × кількість
 *     до сплати    = рядок − одна найкраща знижка
 *
 * Надбавки складаються, знижки — ні. Це різні речі: надбавка описує, чим
 * цей виріб відрізняється від базового (розмір, тканина, колір), і таких
 * відмінностей може бути кілька одночасно. Знижка описує домовленість із
 * покупцем, а домовленість діє одна. Складання знижок — найкоротший шлях
 * продати за 0 ₴ через дві акції, які нікому не спало на думку перевірити
 * разом.
 */

import {
  addMinor,
  clampToZero,
  type DiscountScope,
  type Minor,
  minor,
  mulMinor,
  type PriceAdjustKind,
  type PriceModifierTarget,
  percentOfMinor,
  subMinor,
} from '@dt/contracts';

/** Надбавка так, як вона лежить у базі. */
export interface PriceModifierRule {
  readonly id: string;
  readonly name: string;
  readonly target: PriceModifierTarget;
  readonly sizeLabel: string | null;
  readonly fabricId: string | null;
  readonly colourId: string | null;
  /** null — правило діє на весь асортимент. */
  readonly garmentId: string | null;
  readonly kind: PriceAdjustKind;
  readonly amount: number;
  readonly isActive: boolean;
}

/** Знижка так, як вона лежить у базі. */
export interface DiscountRule {
  readonly id: string;
  readonly name: string;
  readonly scope: DiscountScope;
  readonly garmentId: string | null;
  readonly collectionId: string | null;
  readonly kind: PriceAdjustKind;
  readonly amount: number;
  readonly minQty: number;
  readonly startsAt: Date | null;
  readonly endsAt: Date | null;
  readonly isActive: boolean;
}

/** Ознаки конкретного виробу, за якими шукаються надбавки. */
export interface ModifierSubject {
  readonly garmentId: string;
  readonly sizeLabel: string | null;
  readonly fabricId: string | null;
  readonly colourId: string | null;
}

export interface PriceStep {
  readonly label: string;
  readonly amountMinor: Minor;
}

export interface ModifiedPrice {
  readonly amountMinor: Minor;
  readonly steps: readonly PriceStep[];
}

/**
 * Чи стосується правило цього виробу.
 *
 * Правило без `garmentId` діє на весь асортимент — це навмисно поведінка за
 * замовчуванням, бо «великі розміри дорожчі» майже завжди правда для всього.
 * Звуження до виробу лишається можливим і має вищий пріоритет у тому сенсі,
 * що це окреме правило, яке людина створює свідомо.
 */
export function modifierApplies(rule: PriceModifierRule, subject: ModifierSubject): boolean {
  if (!rule.isActive) return false;
  if (rule.garmentId !== null && rule.garmentId !== subject.garmentId) return false;

  switch (rule.target) {
    case 'SIZE_LABEL':
      return rule.sizeLabel !== null && rule.sizeLabel === subject.sizeLabel;
    case 'FABRIC':
      return rule.fabricId !== null && rule.fabricId === subject.fabricId;
    case 'COLOUR':
      return rule.colourId !== null && rule.colourId === subject.colourId;
  }
}

/** Стабільний порядок: інакше розкладка «стрибає» між запитами. */
const TARGET_ORDER: Readonly<Record<PriceModifierTarget, number>> = {
  SIZE_LABEL: 0,
  FABRIC: 1,
  COLOUR: 2,
};

function orderModifiers(rules: readonly PriceModifierRule[]): PriceModifierRule[] {
  return [...rules].sort((a, b) => {
    const byTarget = TARGET_ORDER[a.target] - TARGET_ORDER[b.target];
    if (byTarget !== 0) return byTarget;
    const byName = a.name.localeCompare(b.name, 'uk');
    return byName !== 0 ? byName : a.id.localeCompare(b.id);
  });
}

/**
 * Ціна виробу з надбавками.
 *
 * Відсотки рахуються від базової ціни, а не від уже збільшеної. Через це
 * результат не залежить від порядку правил — а якби відсотки накладалися
 * один на одний, «+10 % за розмір» і «+10 % за тканину» давали б різну суму
 * залежно від того, яке правило створили першим. Пояснити таке покупцеві
 * неможливо.
 *
 * Ручна ціна варіанта перекриває все: правила описують систему, а override —
 * свідомий виняток із неї, і виняток має бути сильнішим за систему, інакше
 * він не виняток.
 */
export function garmentPriceWithModifiers(
  basePriceMinor: Minor,
  priceOverrideMinor: Minor | null,
  subject: ModifierSubject,
  rules: readonly PriceModifierRule[],
): ModifiedPrice {
  if (priceOverrideMinor !== null) {
    return {
      amountMinor: priceOverrideMinor,
      steps: [{ label: 'Ручна ціна варіанта', amountMinor: priceOverrideMinor }],
    };
  }

  const steps: PriceStep[] = [{ label: 'База', amountMinor: basePriceMinor }];
  let total = basePriceMinor;

  for (const rule of orderModifiers(rules)) {
    if (!modifierApplies(rule, subject)) continue;
    const delta = rule.kind === 'PERCENT'
      ? percentOfMinor(basePriceMinor, rule.amount)
      : minor(rule.amount);
    if (delta === 0) continue;
    steps.push({ label: rule.name, amountMinor: delta });
    total = addMinor(total, delta);
  }

  // Надбавки бувають відʼємні (знижка на непопулярний колір), і кілька таких
  // разом теоретично дають мінус. Нижче нуля ціна не опускається.
  return { amountMinor: clampToZero(total), steps };
}

// ---------------------------------------------------------------------------
// Знижки
// ---------------------------------------------------------------------------

export interface DiscountSubject {
  readonly garmentId: string;
  readonly collectionIds: readonly string[];
  readonly quantity: number;
  readonly now: Date;
}

export interface AppliedDiscount {
  readonly id: string;
  readonly name: string;
  readonly amountMinor: Minor;
}

export function discountApplies(rule: DiscountRule, subject: DiscountSubject): boolean {
  if (!rule.isActive) return false;
  if (subject.quantity < rule.minQty) return false;
  if (rule.startsAt !== null && subject.now < rule.startsAt) return false;
  if (rule.endsAt !== null && subject.now >= rule.endsAt) return false;

  switch (rule.scope) {
    case 'ALL':
      return true;
    case 'GARMENT':
      return rule.garmentId !== null && rule.garmentId === subject.garmentId;
    case 'COLLECTION':
      return rule.collectionId !== null && subject.collectionIds.includes(rule.collectionId);
  }
}

/**
 * Скільки грошей дає ця знижка на цей рядок.
 *
 * Фіксована знижка задана «з одиниці товару», тож множиться на кількість:
 * інакше «−50 ₴» на десяти футболках означало б −5 ₴ на кожній, і опт із
 * фіксованою знижкою поводився б протилежно очікуванню.
 */
export function discountAmountFor(
  rule: DiscountRule,
  subtotalMinor: Minor,
  quantity: number,
): Minor {
  const raw = rule.kind === 'PERCENT'
    ? percentOfMinor(subtotalMinor, rule.amount)
    : mulMinor(minor(rule.amount), quantity);
  return minor(Math.min(raw, subtotalMinor));
}

/**
 * Одна знижка — найвигідніша для покупця.
 *
 * За рівних сум перемагає та, що названа першою за абеткою: не тому, що це
 * справедливо, а тому, що результат мусить бути однаковим при кожному
 * виклику. Ціна, яка залежить від порядку рядків у вибірці, — це ціна, яка
 * інколи інша на сторінці й у касі.
 */
export function bestDiscount(
  rules: readonly DiscountRule[],
  subject: DiscountSubject,
  subtotalMinor: Minor,
): AppliedDiscount | null {
  let best: AppliedDiscount | null = null;

  for (const rule of rules) {
    if (!discountApplies(rule, subject)) continue;
    const amountMinor = discountAmountFor(rule, subtotalMinor, subject.quantity);
    if (amountMinor <= 0) continue;
    if (
      best === null
      || amountMinor > best.amountMinor
      || (amountMinor === best.amountMinor && rule.name.localeCompare(best.name, 'uk') < 0)
    ) {
      best = { id: rule.id, name: rule.name, amountMinor };
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Повна розкладка рядка
// ---------------------------------------------------------------------------

export interface LineQuote {
  readonly steps: readonly PriceStep[];
  readonly unitMinor: Minor;
  readonly quantity: number;
  readonly subtotalMinor: Minor;
  readonly discount: AppliedDiscount | null;
  readonly totalMinor: Minor;
}

/**
 * Те, що бачить і адмін у калькуляторі, і покупець на сторінці товару.
 *
 * Одна функція на обидва випадки — щоб «чому в адмінці 780, а в кошику 800»
 * не могло статися в принципі.
 */
export function quoteLine(input: {
  readonly basePriceMinor: Minor;
  readonly priceOverrideMinor: Minor | null;
  readonly printPriceMinor: Minor | null;
  readonly printLabel: string;
  readonly subject: ModifierSubject;
  readonly modifiers: readonly PriceModifierRule[];
  readonly discounts: readonly DiscountRule[];
  readonly discountSubject: DiscountSubject;
}): LineQuote {
  const garment = garmentPriceWithModifiers(
    input.basePriceMinor,
    input.priceOverrideMinor,
    input.subject,
    input.modifiers,
  );

  const steps: PriceStep[] = [...garment.steps];
  let unit = garment.amountMinor;

  if (input.printPriceMinor !== null && input.printPriceMinor !== 0) {
    steps.push({ label: input.printLabel, amountMinor: input.printPriceMinor });
    unit = addMinor(unit, input.printPriceMinor);
  }

  const quantity = input.discountSubject.quantity;
  const subtotal = mulMinor(unit, quantity);
  const discount = bestDiscount(input.discounts, input.discountSubject, subtotal);

  return {
    steps,
    unitMinor: unit,
    quantity,
    subtotalMinor: subtotal,
    discount,
    totalMinor: discount === null ? subtotal : clampToZero(subMinor(subtotal, discount.amountMinor)),
  };
}
