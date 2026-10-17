import type { GarmentType } from './enums';

/**
 * Розбір пошукового запиту — чиста функція, без бази.
 *
 * ── Чому не `contains` у SQL ──────────────────────────────────────────
 *
 * Пошук шукав увесь рядок підрядком у назві. Звідси аудит 17.10.2026:
 * «футболка», «худі», «мопс футболка», «собака», «такси», «стаффорд» —
 * нуль результатів, хоча реклама веде людей саме з такими словами. Три
 * причини, і жодну не виправити одним `ILIKE`:
 *
 *  1. **Слово-виріб — не назва принта.** «Футболка з таксою» означає
 *     «принт із таксою на футболці». Тому вироби тут розпізнаються окремо і
 *     стають фільтром за типом виробу, а не словом, яке шукають у назві.
 *  2. **Відмінки й мови.** «такса / таксою / такси / таксой», «худі / худи»,
 *     «шпіц / шпиц», «стафорд / стаффорд», «тер’єр / терьер». Тому і запит,
 *     і те, в чому шукаємо, проходять ту саму нормалізацію (і/ї/и/ы → и,
 *     є/е/э → е, без апострофів і мʼякого знака, подвоєні літери в одну), а
 *     слова порівнюються за основою без закінчення.
 *  3. **Кілька слів.** Рядок «мопс футболка» не входить у жодну назву.
 *     Кожне слово шукається окремо, і принт має відповісти на всі (AND).
 *
 * «Собака», «пес», «бабака» на цьому сайті нічого не звужують — тут усе про
 * собак. Такі слова не відсіюють, а означають «весь каталог».
 */

/** Нормалізація для порівняння: однаково для запиту і для того, де шукаємо. */
export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’'ʼ`‘´]/g, '')
    .replace(/ё/g, 'е')
    .replace(/[іїыи]/g, 'и')
    .replace(/[єэ]/g, 'е')
    .replace(/ґ/g, 'г')
    .replace(/[ьъ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    // «стаффорд» / «стафорд», «амстафф» / «амстаф»: подвоєння в обох мовах
    // пишуть як завгодно, тож рахуємо його однією літерою з обох боків.
    .replace(/(\p{L})\1+/gu, '$1')
    .trim();
}

/** Слова після нормалізації. */
export function words(text: string): string[] {
  const n = normalize(text);
  return n === '' ? [] : n.split(' ');
}

/*
 * Закінчення, які відкидаються для порівняння за основою. Уже в
 * нормалізованому вигляді (і → и, є → е). Довші перевіряються першими.
 */
const ENDINGS = [
  'ами', 'ями', 'ого', 'ому', 'ему', 'ими', 'ови', 'еви',
  'ою', 'ею', 'ом', 'ем', 'ам', 'ям', 'ах', 'ях', 'ов', 'ев', 'ей', 'ой', 'ий', 'им',
  'ая', 'яя', 'ую', 'юю', 'ое', 'ее', 'ие', 'их',
  'а', 'я', 'у', 'ю', 'и', 'е', 'о', 'й',
];

/** Основа слова: без найдовшого закінчення, але не коротша за три літери. */
export function stem(word: string): string {
  for (const ending of ENDINGS) {
    if (word.length - ending.length >= 3 && word.endsWith(ending)) {
      return word.slice(0, -ending.length);
    }
  }
  return word;
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
}

/**
 * Чи відповідає слово запиту слову з назви.
 *
 *  · початок слова — для набору наживо («так» → «такса»). Саме початок, а не
 *    будь-який підрядок: інакше «дог» знаходив би «бульдога»;
 *  · однакова основа — відмінки («таксою» → «такса»);
 *  · майже однакова основа — різні мови одного слова («французским» →
 *    «французький»): спільний початок щонайменше шість літер, і обидві
 *    основи довші за нього не більше ніж на дві літери. Інакше «мальтіпу»
 *    знаходив би «мальтезе». Короткі слова мають збігтися основою точно.
 */
export function wordMatches(token: string, word: string): boolean {
  if (word.startsWith(token)) return true;
  const a = stem(token);
  const b = stem(word);
  if (a === b) return true;
  const cp = commonPrefix(a, b);
  return cp >= 6 && cp >= Math.max(a.length, b.length) - 2;
}

/** Чи відповідає слово запиту хоч одному слову з набору. */
export function anyWordMatches(token: string, haystack: readonly string[]): boolean {
  return haystack.some((w) => wordMatches(token, w));
}

// ---------------------------------------------------------------------------
// Словники. Усе в нормалізованому вигляді.
// ---------------------------------------------------------------------------

/** Початки слів → тип виробу. Порядок неважливий: збіги не перетинаються. */
const GARMENT_PREFIXES: ReadonlyArray<readonly [string, readonly GarmentType[]]> = [
  ['футбол', ['TSHIRT']],
  ['tshirt', ['TSHIRT']],
  ['tee', ['TSHIRT']],
  ['shirt', ['TSHIRT']],
  ['худи', ['HOODIE']],
  ['худак', ['HOODIE']],
  ['hood', ['HOODIE']],
  ['кенгуру', ['HOODIE']],
  ['свитшот', ['SWEATSHIRT']],
  ['свитш', ['SWEATSHIRT']],
  ['sweat', ['SWEATSHIRT']],
  // «Кофта» й «толстовка» в розмові — і худі, і світшот.
  ['кофт', ['HOODIE', 'SWEATSHIRT']],
  ['толстовк', ['HOODIE', 'SWEATSHIRT']],
];

/** Слова «про собаку взагалі»: на цьому сайті вони нічого не звужують. */
const DOG_PREFIXES = ['собак', 'собач', 'песик', 'песел', 'цуцен', 'щен', 'dog', 'бабак', 'babak'];
const DOG_WORDS = new Set(['пес', 'пса', 'псом', 'пси', 'псам', 'псами', 'песи']);

/** Службові й «порожні» для каталогу слова. Пишуться як є, нормалізуються тут. */
const STOP_WORDS = new Set([
  'з', 'зі', 'із', 'зо', 'с', 'со', 'і', 'и', 'та', 'або', 'или', 'для', 'на', 'в', 'у', 'во', 'по', 'от', 'від',
  'купити', 'купить', 'ціна', 'цена', 'недорого', 'замовити', 'заказать',
  'принт', 'принтом', 'принтами', 'принти', 'принтов', 'print', 'одяг', 'одежда', 'мерч',
  'оверсайз', 'oversize', 'унісекс', 'unisex', 'with', 'and',
].map(normalize));
const STOP_PREFIXES = ['жиноч', 'женск', 'чолович', 'мужск', 'дитяч', 'детск'];

/*
 * Латиниця для того, що на сайті записано латиницею, і навпаки: колекція
 * «Polo Бабаки», слаги `winter-*` (F*ck winter).
 */
const ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['поло', 'polo'],
  ['зим', 'winter'],
  ['winter', 'зима'],
];

function garmentTypesOf(token: string): readonly GarmentType[] | null {
  for (const [prefix, types] of GARMENT_PREFIXES) {
    if (token.startsWith(prefix)) return types;
  }
  return null;
}

function isDogWord(token: string): boolean {
  return DOG_WORDS.has(token) || DOG_PREFIXES.some((p) => token.startsWith(p));
}

function isStopWord(token: string): boolean {
  return STOP_WORDS.has(token) || STOP_PREFIXES.some((p) => token.startsWith(p));
}

export interface ParsedQuery {
  /** Змістовні слова: кожне має знайтися (AND). */
  readonly terms: readonly string[];
  /** Вироби, названі в запиті («худі з таксою» → HOODIE). */
  readonly garmentTypes: readonly GarmentType[];
}

/**
 * Запит → змістовні слова + вироби.
 *
 * Якщо запит складається лише зі службових слів («та», «на» — це й початок
 * набору «такса»), їх не викидаємо: інакше підказки на дві літери
 * показували б увесь каталог.
 */
export function parseQuery(query: string): ParsedQuery {
  const tokens = words(query);
  const terms: string[] = [];
  const garments = new Set<GarmentType>();
  const stops: string[] = [];
  let neutral = false;

  for (const token of tokens) {
    const types = garmentTypesOf(token);
    if (types) { types.forEach((t) => garments.add(t)); continue; }
    if (isDogWord(token)) { neutral = true; continue; }
    if (isStopWord(token)) { stops.push(token); continue; }
    terms.push(token);
  }

  const onlyStops = terms.length === 0 && garments.size === 0 && !neutral;
  return { terms: onlyStops ? stops : terms, garmentTypes: [...garments] };
}

/** Чи відповідає слово запиту набору слів, з урахуванням латиниці/кирилиці. */
export function termMatches(term: string, haystack: readonly string[]): boolean {
  if (anyWordMatches(term, haystack)) return true;
  return ALIASES.some(([from, to]) => term.startsWith(from) && anyWordMatches(to, haystack));
}

/** AND: кожне змістовне слово запиту має знайтися в наборі. */
export function matchesAll(terms: readonly string[], haystack: readonly string[]): boolean {
  return terms.every((t) => termMatches(t, haystack));
}

/** OR: хоч одне слово запиту знайшлося — для порід і колекцій. */
export function matchesAny(terms: readonly string[], haystack: readonly string[]): boolean {
  return terms.some((t) => termMatches(t, haystack));
}

/** Слова для пошуку з кількох полів, без дублів. Слаг ріжеться по дефісах. */
export function haystackOf(...fields: ReadonlyArray<string | null | undefined | readonly string[]>): string[] {
  const out = new Set<string>();
  for (const field of fields) {
    if (field === null || field === undefined) continue;
    const list = typeof field === 'string' ? [field] : field;
    for (const value of list) for (const w of words(value)) out.add(w);
  }
  return [...out];
}

// ---------------------------------------------------------------------------
// Пошук по завантаженому каталогу.
// ---------------------------------------------------------------------------

export interface SearchableBreed {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly synonyms: readonly string[];
}

export interface SearchableCollection {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
}

export interface SearchablePrint {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly breedIds: readonly string[];
  readonly collectionIds: readonly string[];
}

export interface CatalogSearchHit {
  /** Породи за кількістю слів запиту, які в них знайшлися. */
  readonly breedIds: string[];
  readonly collectionIds: string[];
  /** Принти в тому порядку, в якому прийшли. */
  readonly printIds: string[];
  readonly garmentTypes: readonly GarmentType[];
}

/**
 * Запит → що знайшлося. Каталог — сотня принтів і кілька десятків порід,
 * тож шукаємо в памʼяті: так «таксою» і «такса» порівнюються однією
 * функцією, а не двома реалізаціями (SQL і JS), які колись розійдуться.
 *
 * Принт відповідає слову запиту, якщо слово є в його назві чи слагу, у
 * назві чи синонімах його породи або в назві його колекції. Тому «мопс»
 * знаходить і принт «Мопс», і «Такса і йорк» за «йорком».
 *
 * Запит без змістовних слів, але з виробом чи «собакою» («худі»,
 * «футболка з собакою») — це «покажіть каталог»: повертаються всі принти,
 * а вибір виробу далі звужує фільтр.
 */
export function searchCatalog(
  query: string,
  catalog: {
    readonly breeds: readonly SearchableBreed[];
    readonly collections: readonly SearchableCollection[];
    readonly prints: readonly SearchablePrint[];
  },
): CatalogSearchHit {
  const parsed = parseQuery(query);
  const tokens = words(query);
  if (tokens.length === 0) return { breedIds: [], collectionIds: [], printIds: [], garmentTypes: [] };

  const breedWords = new Map(catalog.breeds.map((b) => [b.id, haystackOf(b.name, b.synonyms, b.slug.split('-'))]));
  const collectionTitles = new Map(catalog.collections.map((c) => [c.id, haystackOf(c.title, c.slug.split('-'))]));
  // Опис — лише для видачі самої колекції («зима» → F*ck winter). Принтам
  // він не передається: «та» чи «тут» з опису не мають тягнути пів каталогу.
  const collectionWords = new Map(catalog.collections.map((c) => [c.id, haystackOf(c.title, c.slug.split('-'), c.description)]));

  const { terms } = parsed;
  const breedIds = terms.length === 0 ? [] : catalog.breeds
    .map((b) => ({ id: b.id, hits: terms.filter((t) => termMatches(t, breedWords.get(b.id) ?? [])).length }))
    .filter((b) => b.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map((b) => b.id);

  const collectionIds = terms.length === 0 ? [] : catalog.collections
    .filter((c) => matchesAny(terms, collectionWords.get(c.id) ?? []))
    .map((c) => c.id);

  const printIds = catalog.prints
    .filter((p) => terms.length === 0 || matchesAll(terms, haystackOf(
      p.title,
      p.slug.split('-'),
      ...p.breedIds.map((id) => breedWords.get(id) ?? []),
      ...p.collectionIds.map((id) => collectionTitles.get(id) ?? []),
    )))
    .map((p) => p.id);

  return { breedIds, collectionIds, printIds, garmentTypes: parsed.garmentTypes };
}
