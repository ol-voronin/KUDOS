import type { PrintSizeTier } from '@dt/contracts';

/**
 * Зона друку на фото виробу — серце авто-мокапів.
 *
 * Ідея: мокапи на кожну пару принт×колір ніхто не малює руками. Фото
 * виробу знімаються В ОДНОМУ ракурсі на всі кольори, тож зону друку
 * достатньо описати один раз НА ВИРІБ — і будь-який макет лягає на
 * будь-який колір сам. Змінюється колір → підміняється фото-підкладка,
 * принт лишається на місці.
 *
 * Числа — частки від ширини/висоти кадру (0..1), виміряні по чинних фото
 * з `public/garments/`. Якщо колись фото перезнімуть в іншому ракурсі —
 * підкрутити треба лише цю таблицю, більше ніде нічого.
 *
 *   x, y — лівий верхній кут зони друку;
 *   w    — ширина зони (максимальна, для MAXI-принтів).
 *
 * Висота не задається: макет зберігає власні пропорції від ширини.
 */
export interface PrintArea {
  readonly x: number;
  readonly y: number;
  readonly w: number;
}

const AREAS: Readonly<Record<string, PrintArea>> = {
  // Футболки: класична зона на грудях, від лінії пахв.
  'futbolka-klasychna':          { x: 0.31, y: 0.30, w: 0.38 },
  'futbolka-oversayz-cholovicha': { x: 0.31, y: 0.32, w: 0.38 },
  'futbolka-oversayz-zhinocha':   { x: 0.31, y: 0.32, w: 0.38 },
  // Світшоти: корпус трохи ширший, зона така сама по центру.
  'svitshot-klasychnyi': { x: 0.33, y: 0.30, w: 0.34 },
  'hibryd-svitshot':     { x: 0.33, y: 0.30, w: 0.34 },
  // Худі: зона нижча (під шнурками) і менша — вище кишені-кенгуру.
  'hudi-klasychnyi': { x: 0.36, y: 0.50, w: 0.28 },
  'hibryd-hudi':     { x: 0.36, y: 0.50, w: 0.28 },
};

/** Розумне замовчування для виробу, якого ще немає в таблиці. */
const DEFAULT_AREA: PrintArea = { x: 0.31, y: 0.31, w: 0.38 };

export function printAreaFor(garmentSlug: string): PrintArea {
  return AREAS[garmentSlug] ?? DEFAULT_AREA;
}

/**
 * Частка зони, яку займає принт свого розміру. Ті самі пропорції, що в
 * цінових ярусах: MAXI заповнює зону, MINI — нагрудний значок.
 */
const TIER_SCALE: Readonly<Record<PrintSizeTier, number>> = {
  MINI: 0.55,
  MEDIUM: 0.8,
  MAXI: 1,
};

export function tierScale(tier: PrintSizeTier): number {
  return TIER_SCALE[tier];
}
