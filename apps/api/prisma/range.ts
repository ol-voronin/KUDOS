/**
 * Асортимент власного виробництва — єдине джерело правди.
 *
 * Дані переписані з паспортів виробів (серпень 2026): сім виробів, чотири
 * тканини, двадцять три кольори. Кожне число тут має відповідник у PDF; де
 * паспорти суперечили один одному, розбіжність знята явно й підписана
 * коментарем, а не залагоджена мовчки.
 *
 * Три такі розбіжності:
 *   1. «Гібрид світшот-футболка» у заголовку каже «4 кольори», а перелічує
 *      три. Правильно — три (підтверджено замовником).
 *   2. «Темний синій» / «Темно синій» — одна й та сама фарба. Канонічно —
 *      «Темно синій» (підтверджено замовником).
 *   3. XXL і 2XL — те саме тіло. Канонічно — 2XL (підтверджено замовником).
 *
 * Ціни виробів — ЗАГЛУШКИ. Вони позначені як такі в `PLACEHOLDER_PRICES` і
 * редагуються в адмінці без деплою; сідер ставить їх лише при створенні
 * запису й ніколи не перетирає вручну виправлену ціну.
 */

export interface ColourSpec {
  /** Латинський код — він же імʼя файлу фото й `Colour.supplierCode`. */
  readonly code: string;
  readonly name: string;
  readonly hex: string;
}

/**
 * Гекси зняті з фото виробів у паспортах: домінантний колір тканини під
 * маскою прозорості. Тому вони точні як свотч, але не як фарба — та сама
 * назва на кулірі й на флісі виглядає трохи по-різному. Для вибору кольору
 * сторінка все одно показує фото виробу, а гекс лишається запасним варіантом.
 */
export const COLOURS: readonly ColourSpec[] = [
  { code: 'bilyi',             name: 'Білий',             hex: '#ECECF0' },
  { code: 'slonova-kistka',    name: 'Слонова кістка',    hex: '#E6E2D6' },
  { code: 'molochnyi-shokolad',name: 'Молочний шоколад',  hex: '#8A6053' },
  { code: 'mokryi-pisok',      name: 'Мокрий пісок',      hex: '#C2AB93' },
  { code: 'derevianyi',        name: 'Дерев’яний',        hex: '#846C60' },
  { code: 'mandarynovyi',      name: 'Мандариновий',      hex: '#FC9C18' },
  { code: 'ananasovyi',        name: 'Ананасовий',        hex: '#EEC96C' },
  { code: 'antychna-troianda', name: 'Антична троянда',   hex: '#C07884' },
  { code: 'rozhevyi',          name: 'Рожевий',           hex: '#E4789C' },
  { code: 'chervonyi',         name: 'Червоний',          hex: '#96141F' },
  { code: 'temna-vyshnia',     name: 'Темна вишня',       hex: '#3C1818' },
  { code: 'svitlyi-buzok',     name: 'Світлий бузок',     hex: '#C0B4CC' },
  { code: 'khaki',             name: 'Хакі',              hex: '#48483C' },
  { code: 'zelenyi-mokh',      name: 'Зелений мох',       hex: '#788478' },
  { code: 'zelenyi-marmur',    name: 'Зелений мармур',    hex: '#004E54' },
  { code: 'smarahdovyi',       name: 'Смарагдовий',       hex: '#00786C' },
  { code: 'zelenyi-nefryt',    name: 'Зелений нефрит',    hex: '#8AAB9E' },
  { code: 'akvamaryn',         name: 'Аквамарин',         hex: '#9AA9B7' },
  { code: 'svitlo-biriuzovyi', name: 'Світло бірюзовий',  hex: '#009CC0' },
  { code: 'blakytnyi-safir',   name: 'Блакитний сапфір',  hex: '#00567F' },
  { code: 'temno-synii',       name: 'Темно синій',       hex: '#1E2A38' },
  { code: 'stalevyi-siryi',    name: 'Сталевий сірий',    hex: '#4E5661' },
  { code: 'chornyi',           name: 'Чорний',            hex: '#1A1A1A' },
];

export interface FabricSpec {
  readonly key: string;
  readonly name: string;
  readonly weightGsm: number;
  readonly composition: string;
  /** Скільки днів шиємо виріб із цієї тканини. */
  readonly leadTimeDays: number;
}

export const FABRICS: readonly FabricSpec[] = [
  { key: 'bavovna-180', name: 'Бавовна 180',  weightGsm: 180, composition: '100% бавовна · ніжна та легка', leadTimeDays: 5 },
  { key: 'bavovna-220', name: 'Бавовна 220',  weightGsm: 220, composition: '100% бавовна · щільна, добре тримає форму', leadTimeDays: 5 },
  { key: 'dvonytka-300',name: 'Двонитка 300', weightGsm: 300, composition: '85% бавовна, 15% перероблений поліестер · щільна, добре тримає форму', leadTimeDays: 7 },
  { key: 'flis-350',    name: 'Фліс 350',     weightGsm: 350, composition: '85% бавовна, 15% перероблений поліестер, утеплений флісом · ніжний і приємний до тіла', leadTimeDays: 7 },
];

export interface SizeSpec {
  readonly label: string;
  /** Сантиметри, рядком — у паспортах трапляються дробові й діапазони. */
  readonly length: string;
  readonly width: string;
  readonly sleeve: string;
}

export interface GarmentSpec {
  readonly slug: string;
  readonly name: string;
  readonly type: 'TSHIRT' | 'SWEATSHIRT' | 'HOODIE';
  readonly fit: 'CLASSIC' | 'OVERSIZE' | 'OVERSIZE_WOMEN' | 'HYBRID';
  readonly description: string;
  readonly fabric: string;
  /** Заглушка. Редагується в /admin/tsiny; сідер її не перетирає. */
  readonly basePriceMinor: number;
  readonly colours: readonly string[];
  readonly sizes: readonly SizeSpec[];
}

export const GARMENTS: readonly GarmentSpec[] = [
  {
    slug: 'futbolka-klasychna',
    name: 'Футболка класична унісекс',
    type: 'TSHIRT', fit: 'CLASSIC',
    description: 'Модель унісекс, прямий крій.',
    fabric: 'bavovna-180',
    basePriceMinor: 55_000,
    colours: [
      'bilyi', 'slonova-kistka', 'ananasovyi', 'derevianyi', 'mandarynovyi',
      'antychna-troianda', 'chervonyi', 'smarahdovyi', 'zelenyi-nefryt', 'zelenyi-mokh',
      'akvamaryn', 'blakytnyi-safir', 'temno-synii', 'stalevyi-siryi', 'chornyi',
    ],
    sizes: [
      { label: 'XXS', length: '66', width: '43', sleeve: '19.5' },
      { label: 'XS',  length: '68', width: '46', sleeve: '20.2' },
      { label: 'S',   length: '70', width: '49', sleeve: '21' },
      { label: 'M',   length: '72', width: '52', sleeve: '21.8' },
      { label: 'L',   length: '74', width: '55', sleeve: '22.5' },
      { label: 'XL',  length: '76', width: '58', sleeve: '23.8' },
      { label: '2XL', length: '78', width: '61', sleeve: '24' },
    ],
  },
  {
    slug: 'futbolka-oversayz-zhinocha',
    name: 'Футболка оверсайз жіноча',
    type: 'TSHIRT', fit: 'OVERSIZE_WOMEN',
    description: 'Крій оверсайз, опущені плечі; широкий, але вкорочений крій, що пасує жінкам.',
    fabric: 'bavovna-180',
    basePriceMinor: 60_000,
    colours: ['bilyi', 'chornyi', 'akvamaryn', 'rozhevyi'],
    sizes: [
      { label: 'XXS/XS', length: '58', width: '52', sleeve: '17' },
      { label: 'S/M',    length: '62', width: '58', sleeve: '18' },
      { label: 'L/XL',   length: '64', width: '61', sleeve: '19' },
    ],
  },
  {
    slug: 'futbolka-oversayz-cholovicha',
    // «Унісекс», не «чоловіча»: опис і так каже, що пасує жінкам; слаг лишаємо
    // старий свідомо — посилання й фото вже живуть на ньому (рішення Олексія).
    name: 'Футболка оверсайз унісекс',
    type: 'TSHIRT', fit: 'OVERSIZE',
    description: 'Крій оверсайз, опущені плечі, подовжена і ширша порівняно з класичною. Також підходить жінкам середнього і високого зросту.',
    fabric: 'bavovna-220',
    basePriceMinor: 69_000,
    colours: ['bilyi', 'chornyi', 'temno-synii', 'stalevyi-siryi', 'derevianyi'],
    sizes: [
      { label: 'XS',  length: '69', width: '52', sleeve: '21.5' },
      { label: 'S',   length: '71', width: '55', sleeve: '22' },
      { label: 'M',   length: '73', width: '58', sleeve: '22.5' },
      { label: 'L',   length: '75', width: '61', sleeve: '23' },
      { label: 'XL',  length: '77', width: '64', sleeve: '23.5' },
      { label: '2XL', length: '79', width: '67', sleeve: '24' },
    ],
  },
  {
    slug: 'hibryd-svitshot',
    name: 'Гібрид світшот-футболка',
    type: 'SWEATSHIRT', fit: 'HYBRID',
    description: 'Крій оверсайз, опущені плечі, подовжений і ширший порівняно з класичним. Унісекс: ідеально чоловікам, жінкам — середнього і високого зросту.',
    fabric: 'dvonytka-300',
    basePriceMinor: 109_000,
    // Паспорт у заголовку каже «4 кольори», а перелічує три. Три — правильно.
    colours: ['slonova-kistka', 'chornyi', 'temno-synii'],
    sizes: [
      { label: 'XS',  length: '69', width: '52', sleeve: '21.5' },
      { label: 'S',   length: '71', width: '55', sleeve: '22' },
      { label: 'M',   length: '73', width: '58', sleeve: '22.5' },
      { label: 'L',   length: '75', width: '61', sleeve: '23' },
      { label: 'XL',  length: '77', width: '64', sleeve: '23.5' },
      { label: '2XL', length: '79', width: '67', sleeve: '24' },
    ],
  },
  {
    slug: 'hibryd-hudi',
    name: 'Гібрид худі-футболка',
    type: 'HOODIE', fit: 'HYBRID',
    description: 'Крій оверсайз, опущені плечі. Двошаровий капюшон, плоскі шнурки, мінімалістичні кишені. Унісекс.',
    fabric: 'dvonytka-300',
    basePriceMinor: 125_000,
    colours: ['slonova-kistka', 'chornyi'],
    sizes: [
      { label: 'XS',  length: '67', width: '51', sleeve: '21' },
      { label: 'S',   length: '69', width: '54', sleeve: '22' },
      { label: 'M',   length: '71', width: '57', sleeve: '23' },
      { label: 'L',   length: '73', width: '60', sleeve: '23.5' },
      { label: 'XL',  length: '75', width: '63', sleeve: '24' },
      { label: '2XL', length: '77', width: '66', sleeve: '25' },
    ],
  },
  {
    slug: 'svitshot-klasychnyi',
    name: 'Світшот класичний унісекс',
    type: 'SWEATSHIRT', fit: 'CLASSIC',
    description: 'Модель унісекс, прямий крій, рібана на рукавах і внизу виробу.',
    fabric: 'flis-350',
    basePriceMinor: 115_000,
    colours: [
      'slonova-kistka', 'mokryi-pisok', 'molochnyi-shokolad', 'chornyi', 'khaki', 'stalevyi-siryi',
      'antychna-troianda', 'chervonyi', 'temna-vyshnia', 'svitlyi-buzok', 'ananasovyi', 'svitlo-biriuzovyi',
      'temno-synii', 'blakytnyi-safir', 'akvamaryn', 'zelenyi-marmur', 'smarahdovyi', 'zelenyi-nefryt',
    ],
    sizes: [
      { label: 'XS',  length: '68', width: '48', sleeve: '63' },
      { label: 'S',   length: '70', width: '51', sleeve: '64' },
      { label: 'M',   length: '72', width: '54', sleeve: '65' },
      { label: 'L',   length: '74', width: '57', sleeve: '66' },
      { label: 'XL',  length: '76', width: '60', sleeve: '67' },
      { label: '2XL', length: '78', width: '63', sleeve: '68' },
    ],
  },
  {
    slug: 'hudi-klasychnyi',
    name: 'Худі класичний унісекс',
    type: 'HOODIE', fit: 'CLASSIC',
    description: 'Модель унісекс, прямий крій, двошаровий капюшон, шнурки в тон виробу, кишеня попереду.',
    fabric: 'flis-350',
    basePriceMinor: 135_000,
    colours: [
      'slonova-kistka', 'mokryi-pisok', 'molochnyi-shokolad', 'chornyi', 'khaki', 'stalevyi-siryi',
      'antychna-troianda', 'chervonyi', 'temna-vyshnia', 'svitlyi-buzok', 'ananasovyi', 'svitlo-biriuzovyi',
      'temno-synii', 'blakytnyi-safir', 'akvamaryn', 'zelenyi-marmur', 'smarahdovyi', 'zelenyi-nefryt',
    ],
    sizes: [
      { label: 'XS',  length: '68', width: '49', sleeve: '63' },
      { label: 'S',   length: '70', width: '52', sleeve: '64' },
      { label: 'M',   length: '72', width: '55', sleeve: '65' },
      { label: 'L',   length: '74', width: '58', sleeve: '66' },
      { label: 'XL',  length: '76', width: '61', sleeve: '67' },
      { label: '2XL', length: '78', width: '64', sleeve: '68' },
    ],
  },
];

/** Ціни друку за розміром макета. Теж заглушки, теж редаговані в адмінці. */
export const PRINT_PRICES: ReadonlyArray<{ tier: 'MINI' | 'MEDIUM' | 'MAXI'; priceMinor: number }> = [
  { tier: 'MINI',   priceMinor: 15_000 },
  { tier: 'MEDIUM', priceMinor: 20_000 },
  { tier: 'MAXI',   priceMinor: 25_000 },
];

/** Шлях до фото виробу в кольорі. Файли лежать у `apps/web/public/garments`. */
export function garmentPhotoPath(garmentSlug: string, colourCode: string): string {
  return `/garments/${garmentSlug}/${colourCode}.webp`;
}
