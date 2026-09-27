/**
 * Які кольори принт НЕ друкує — з урахуванням колекцій.
 *
 * Правило ставиться на колекцію (усі «Бабаки в пабі» тонуть на яскравому),
 * а окремий принт може його скоригувати в обидва боки:
 *   • заборонити ще щось — власна заборона;
 *   • повернути колір, який колекція забороняє, — дозвіл.
 *
 *   підсумок = (заборони його колекцій − його дозволи) ∪ його заборони
 *
 * Власна заборона сильніша за власний дозвіл: якщо обидва стоять на одному
 * кольорі, це суперечність у даних, і обережніше не друкувати.
 */
export interface ColourRuleInput {
  /** Заборони кожної колекції, куди входить принт. */
  readonly collectionExcluded: ReadonlyArray<ReadonlyArray<string>>;
  readonly printExcluded: ReadonlyArray<string>;
  readonly printAllowed: ReadonlyArray<string>;
}

export function effectiveExcludedColours(input: ColourRuleInput): Set<string> {
  const allowed = new Set(input.printAllowed);
  const out = new Set<string>();
  for (const list of input.collectionExcluded) {
    for (const id of list) if (!allowed.has(id)) out.add(id);
  }
  for (const id of input.printExcluded) out.add(id);
  return out;
}

/** Prisma-select, якого досить, щоб порахувати підсумок для принта. */
export const COLOUR_RULES_SELECT = {
  colourExclusions: { select: { colourId: true } },
  colourAllowances: { select: { colourId: true } },
  collections: { select: { collection: { select: { colourExclusions: { select: { colourId: true } } } } } },
} as const;

export interface ColourRulesRow {
  colourExclusions: ReadonlyArray<{ colourId: string }>;
  colourAllowances: ReadonlyArray<{ colourId: string }>;
  collections: ReadonlyArray<{ collection: { colourExclusions: ReadonlyArray<{ colourId: string }> } }>;
}

export function excludedColoursOf(row: ColourRulesRow): Set<string> {
  return effectiveExcludedColours({
    collectionExcluded: row.collections.map((c) => c.collection.colourExclusions.map((e) => e.colourId)),
    printExcluded: row.colourExclusions.map((e) => e.colourId),
    printAllowed: row.colourAllowances.map((e) => e.colourId),
  });
}
