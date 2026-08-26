import type { BlockList } from '@dt/contracts';

/**
 * Скільки хвилин читати матеріал.
 *
 * Рахується з блоків, а не зберігається полем. Поле редактор або не заповнить,
 * або заповнить один раз — і воно розійдеться з текстом на першій же правці.
 * Похідне від вмісту має рахуватися з вмісту, навіть коли це дрібниця.
 *
 * 180 слів за хвилину — середина для читання з екрана українською. Точність
 * тут і не потрібна: підпис існує, щоб людина оцінила «це на дві хвилини чи
 * на п'ятнадцять», а не щоб звірятися з секундоміром.
 */

const WORDS_PER_MINUTE = 180;

/**
 * Ключі, вміст яких не читають.
 *
 * Перелік того, що виключаємо, а не того, що включаємо, — навмисно. Новий
 * блок із новим текстовим полем має потрапити в підрахунок сам; якби список
 * був білим, кожен новий блок мовчки не рахувався б, і ніхто б не помітив.
 */
const NON_TEXT_KEYS: ReadonlySet<string> = new Set([
  'type', 'href', 'url', 'coverUrl', 'imageUrl', 'src', 'id', 'slug',
  'align', 'variant', 'tone', 'moreHref', 'anchor', 'icon', 'background',
]);

function looksLikeAddress(value: string): boolean {
  return /^(https?:\/\/|\/|#|mailto:|tel:)/.test(value.trim());
}

function collect(value: unknown, key: string, out: string[]): void {
  if (NON_TEXT_KEYS.has(key)) return;

  if (typeof value === 'string') {
    if (!looksLikeAddress(value)) out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collect(item, key, out);
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) collect(v, k, out);
  }
}

export function countWords(blocks: BlockList): number {
  const parts: string[] = [];
  collect(blocks, 'blocks', parts);

  return parts
    .join(' ')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
    .length;
}

/** Завжди щонайменше одна хвилина: «0 хв читання» — це не інформація. */
export function readingMinutes(blocks: BlockList): number {
  return Math.max(1, Math.round(countWords(blocks) / WORDS_PER_MINUTE));
}
