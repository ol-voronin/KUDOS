/**
 * Транслітерація й slug для українських назв.
 *
 * Потрібне не заради краси: slug принта — це адреса сторінки, яку побачить
 * Google і яку скопіюють у Telegram. Кирилиця в URL перетворюється на
 * %D0%BA%D0%BE... і в переписці виглядає як сміття, тому назву треба звести
 * до латиниці ще у формі — і показати результат людині до збереження.
 *
 * Таблиця — офіційна українська латиниця (постанова КМУ №55), з одним
 * спрощенням: апостроф і мʼякий знак просто зникають, бо в URL їм місця немає.
 */

const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh',
  з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ю: 'iu', я: 'ia', ь: '', "'": '', 'ʼ': '',
  // Російські літери — на випадок, якщо назву скопіювали звідкись.
  ы: 'y', э: 'e', ъ: '', ё: 'e',
};

/** Особливий випадок: на початку слова «є/ї/й/ю/я» читаються інакше. */
const WORD_INITIAL: Record<string, string> = {
  є: 'ye', ї: 'yi', й: 'y', ю: 'yu', я: 'ya',
};

export function transliterate(input: string): string {
  let out = '';
  let atWordStart = true;
  for (const char of input) {
    const lower = char.toLowerCase();
    const isLetter = /[a-zа-яґєії'ʼ0-9]/i.test(lower);
    if (!isLetter) {
      out += char;
      atWordStart = true;
      continue;
    }
    // Латиниця й цифри проходять як є, зі збереженням регістру: slugify
    // опустить його сам, а transliterate може знадобитись і окремо.
    const mapped = (atWordStart ? WORD_INITIAL[lower] : undefined) ?? MAP[lower] ?? char;
    out += mapped;
    atWordStart = false;
  }
  return out;
}

/**
 * Назва → slug. Порожній результат означає, що з назви не вийшло нічого
 * придатного (самі емодзі, наприклад) — тоді викликач має попросити ввести
 * slug руками, а не зберігати порожній.
 */
export function slugify(input: string): string {
  return transliterate(input.trim().toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/** Чи придатний рядок як slug — те саме правило, що й у zod-схемі. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
