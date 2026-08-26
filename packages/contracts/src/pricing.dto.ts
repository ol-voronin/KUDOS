import { z } from 'zod';
import { PrintSizeTier } from './enums';

/**
 * Правила ціни: надбавки й знижки.
 *
 * Межа між ними — момент застосування, і вона важлива:
 *
 *     надбавка формує ціну виробу      база + розмір + тканина + колір
 *     знижка застосовується до рядка   (ціна + друк) × кількість − знижка
 *
 * Тому це дві різні сутності з різними полями, а не одна таблиця з
 * перемикачем. Одна таблиця виглядає економією, а коштує тим, що на питання
 * «чи діють надбавка за розмір і акція разом» ніхто не може відповісти,
 * дивлячись у дані.
 */

const MinorAmount = z.number().int();
const NonNegativeMinor = z.number().int().nonnegative();

export const PriceModifierTarget = z.enum(['SIZE_LABEL', 'FABRIC', 'COLOUR']);
export type PriceModifierTarget = z.infer<typeof PriceModifierTarget>;

export const PriceAdjustKind = z.enum(['DELTA', 'PERCENT']);
export type PriceAdjustKind = z.infer<typeof PriceAdjustKind>;

export const DiscountScope = z.enum(['ALL', 'GARMENT', 'COLLECTION']);
export type DiscountScope = z.infer<typeof DiscountScope>;

// ---------------------------------------------------------------------------
// Надбавки
// ---------------------------------------------------------------------------

/**
 * Надбавка шукає розмір за написом («2XL»), а не за рядком у таблиці розмірів.
 *
 * Сіток у нас девʼять різних, тож «2XL» — це девʼять різних записів у базі.
 * Правило «великі розміри дорожчі» стосується напису, і зберігати його треба
 * так само: інакше кожен новий виріб мовчки випадає з правила.
 */
export const PriceModifierDto = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  target: PriceModifierTarget,
  sizeLabel: z.string().nullable(),
  fabricId: z.string().uuid().nullable(),
  colourId: z.string().uuid().nullable(),
  /** null — правило діє на весь асортимент. */
  garmentId: z.string().uuid().nullable(),
  kind: PriceAdjustKind,
  /** DELTA — копійки (відʼємне = знижка). PERCENT — соті відсотка. */
  amount: MinorAmount,
  isActive: z.boolean(),
  /** Людські підписи для таблиці — рахує сервер, щоб клієнт не збирав їх сам. */
  targetLabel: z.string(),
  garmentLabel: z.string().nullable(),
});
export type PriceModifierDto = z.infer<typeof PriceModifierDto>;

const modifierShape = {
  name: z.string().min(1).max(80),
  target: PriceModifierTarget,
  sizeLabel: z.string().min(1).max(20).nullable().default(null),
  fabricId: z.string().uuid().nullable().default(null),
  colourId: z.string().uuid().nullable().default(null),
  garmentId: z.string().uuid().nullable().default(null),
  kind: PriceAdjustKind.default('DELTA'),
  amount: MinorAmount,
  isActive: z.boolean().default(true),
};

/**
 * Перевірка «заповнене саме те поле, яке відповідає цілі» стоїть і тут, і
 * в базі через CHECK. Це не дублювання заради надійності: у формі вона дає
 * зрозумілу помилку одразу, а в базі закриває шлях повз форму — сідер,
 * скрипт, ручний SQL.
 */
function targetFieldMatches(
  v: { target: PriceModifierTarget; sizeLabel: string | null; fabricId: string | null; colourId: string | null },
): boolean {
  switch (v.target) {
    case 'SIZE_LABEL': return v.sizeLabel !== null && v.fabricId === null && v.colourId === null;
    case 'FABRIC': return v.fabricId !== null && v.sizeLabel === null && v.colourId === null;
    case 'COLOUR': return v.colourId !== null && v.sizeLabel === null && v.fabricId === null;
  }
}

const TARGET_FIELD_MESSAGE = 'Заповніть саме те поле, якого стосується надбавка: розмір, тканина або колір.';

function percentInRange(v: { kind: PriceAdjustKind; amount: number }): boolean {
  return v.kind !== 'PERCENT' || (v.amount > -10_000 && v.amount <= 100_000);
}

const PERCENT_MESSAGE = 'Відсоток задається в сотих: 1000 = 10 %. Допустимо від −100 % до +1000 %.';

export const PriceModifierCreateDto = z.object(modifierShape)
  .refine(targetFieldMatches, { message: TARGET_FIELD_MESSAGE })
  .refine(percentInRange, { message: PERCENT_MESSAGE });
export type PriceModifierCreateDto = z.infer<typeof PriceModifierCreateDto>;

export const PriceModifierUpdateDto = z.object({
  name: modifierShape.name.optional(),
  kind: PriceAdjustKind.optional(),
  amount: MinorAmount.optional(),
  isActive: z.boolean().optional(),
});
export type PriceModifierUpdateDto = z.infer<typeof PriceModifierUpdateDto>;

// ---------------------------------------------------------------------------
// Знижки
// ---------------------------------------------------------------------------

export const DiscountDto = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  scope: DiscountScope,
  garmentId: z.string().uuid().nullable(),
  collectionId: z.string().uuid().nullable(),
  kind: PriceAdjustKind,
  /** Завжди додатне: це розмір знижки, а не націнка. */
  amount: z.number().int().positive(),
  minQty: z.number().int().min(1),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  isActive: z.boolean(),
  scopeLabel: z.string(),
  /** Чи діє прямо зараз — рахує сервер за своїм годинником, не за годинником браузера. */
  activeNow: z.boolean(),
});
export type DiscountDto = z.infer<typeof DiscountDto>;

const discountShape = {
  name: z.string().min(1).max(80),
  scope: DiscountScope.default('ALL'),
  garmentId: z.string().uuid().nullable().default(null),
  collectionId: z.string().uuid().nullable().default(null),
  kind: PriceAdjustKind.default('PERCENT'),
  amount: z.number().int().positive(),
  minQty: z.number().int().min(1).default(1),
  startsAt: z.string().datetime().nullable().default(null),
  endsAt: z.string().datetime().nullable().default(null),
  isActive: z.boolean().default(true),
};

function discountScopeMatches(
  v: { scope: DiscountScope; garmentId: string | null; collectionId: string | null },
): boolean {
  switch (v.scope) {
    case 'ALL': return v.garmentId === null && v.collectionId === null;
    case 'GARMENT': return v.garmentId !== null && v.collectionId === null;
    case 'COLLECTION': return v.collectionId !== null && v.garmentId === null;
  }
}

function windowOrdered(v: { startsAt: string | null; endsAt: string | null }): boolean {
  if (v.startsAt === null || v.endsAt === null) return true;
  return Date.parse(v.startsAt) < Date.parse(v.endsAt);
}

function discountPercentInRange(v: { kind: PriceAdjustKind; amount: number }): boolean {
  return v.kind !== 'PERCENT' || v.amount <= 10_000;
}

export const DiscountCreateDto = z.object(discountShape)
  .refine(discountScopeMatches, { message: 'Знижка діє або на все, або на виріб, або на колекцію — щось одне.' })
  .refine(windowOrdered, { message: 'Дата початку має бути раніша за дату кінця.' })
  .refine(discountPercentInRange, { message: 'Відсоткова знижка не може бути більшою за 100 % (10000 сотих).' });
export type DiscountCreateDto = z.infer<typeof DiscountCreateDto>;

export const DiscountUpdateDto = z.object({
  name: discountShape.name.optional(),
  kind: PriceAdjustKind.optional(),
  amount: z.number().int().positive().optional(),
  minQty: z.number().int().min(1).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
});
export type DiscountUpdateDto = z.infer<typeof DiscountUpdateDto>;

// ---------------------------------------------------------------------------
// Пояснення ціни
// ---------------------------------------------------------------------------

/**
 * Один рядок розкладки: «Розмір 2XL +50 ₴».
 *
 * Розкладка потрібна не для краси. Правил може бути десяток, і без неї
 * єдиний спосіб дізнатися, звідки взялася підсумкова сума, — читати код.
 * Той самий масив показує адмінка в калькуляторі й сторінка товару покупцю.
 */
export const PriceStepDto = z.object({
  label: z.string(),
  amountMinor: MinorAmount,
});
export type PriceStepDto = z.infer<typeof PriceStepDto>;

export const PriceBreakdownDto = z.object({
  steps: z.array(PriceStepDto),
  /** Ціна одиниці: виріб із надбавками + друк. */
  unitMinor: NonNegativeMinor,
  quantity: z.number().int().min(1),
  subtotalMinor: NonNegativeMinor,
  discountName: z.string().nullable(),
  discountMinor: NonNegativeMinor,
  totalMinor: NonNegativeMinor,
});
export type PriceBreakdownDto = z.infer<typeof PriceBreakdownDto>;

/** Вхід калькулятора в адмінці. */
export const PriceQuoteRequestDto = z.object({
  garmentId: z.string().uuid(),
  fabricId: z.string().uuid().nullable().default(null),
  colourId: z.string().uuid().nullable().default(null),
  sizeLabel: z.string().min(1).max(20).nullable().default(null),
  printTier: PrintSizeTier.nullable().default(null),
  quantity: z.number().int().min(1).max(10_000).default(1),
});
export type PriceQuoteRequestDto = z.infer<typeof PriceQuoteRequestDto>;

const NamedOption = z.object({ id: z.string().uuid(), name: z.string() });

/**
 * Довідники для форм.
 *
 * Їдуть разом із правилами навмисно: без них форма надбавки — це чотири поля
 * для введення UUID руками. Список написів розмірів збирається з реальних
 * сіток, тож правило неможливо створити на розмір, якого не існує.
 */
export const PriceRuleOptionsDto = z.object({
  garments: z.array(NamedOption),
  fabrics: z.array(NamedOption),
  colours: z.array(NamedOption),
  sizeLabels: z.array(z.string()),
  collections: z.array(NamedOption),
});
export type PriceRuleOptionsDto = z.infer<typeof PriceRuleOptionsDto>;

export const AdminPriceRulesDto = z.object({
  modifiers: z.array(PriceModifierDto),
  discounts: z.array(DiscountDto),
  options: PriceRuleOptionsDto,
});
export type AdminPriceRulesDto = z.infer<typeof AdminPriceRulesDto>;
