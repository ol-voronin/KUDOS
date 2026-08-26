import { z } from 'zod';

/**
 * Блоки сторінки.
 *
 * Один discriminated union на всі типи — це не стиль, а несуча конструкція.
 * З нього походять три речі, які інакше неминуче розійшлися б: форма в
 * адмінці, перевірка на запису й рендер на сайті. Додати тип блока = додати
 * сюди варіант і написати до нього компонент; забути одне з двох не вийде,
 * бо реєстр компонентів типізований по цьому ж union.
 *
 * Правило для полів: жодного HTML. Текст — це текст, а посилання й
 * виділення описуються мінімальною розміткою (див. `InlineText`). Це не
 * пуризм: поле, у яке можна написати HTML, рано чи пізно приймає `<script>`,
 * і тоді редактор вмісту стає точкою входу в сайт.
 */

/**
 * Підстановки, дозволені в тексті блоків.
 *
 * Перелік живе в контрактах, а не поруч зі значеннями у вебі, з однієї
 * причини: значення підставляє фронт, а перевіряє текст — сідер і адмінка.
 * Якби список був лише на боці рендеру, друкарська помилка в `{{emial}}`
 * дійшла б до сайту й показалася покупцеві як є.
 */
export const CONTENT_TOKENS = [
  'brand', 'email', 'phone', 'telegram', 'telegramUrl',
  'city', 'cityIn', 'legalEntity', 'legalEntityShort', 'taxNumber',
  'returnDays', 'freeShippingFrom',
] as const;
export type ContentToken = (typeof CONTENT_TOKENS)[number];

/** Усі `{{підстановки}}` в тексті, яких немає в переліку вище. */
export function unknownTokens(text: string): string[] {
  const known = new Set<string>(CONTENT_TOKENS);
  return [...text.matchAll(/\{\{(\w+)\}\}/g)]
    .map((m) => m[1] as string)
    .filter((name) => !known.has(name));
}

/** Фон секції. Ті самі тони, що вже є в `components/section.tsx`. */
export const BlockTone = z.enum(['plain', 'cream', 'accent', 'teal', 'sun', 'plum', 'ink']);
export type BlockTone = z.infer<typeof BlockTone>;

/**
 * Рядок із мінімальною розміткою. Дозволено рівно два прийоми:
 *
 *   `[текст](/адреса)` — посилання
 *   `**текст**`        — виділення
 *
 * Плюс підстановки `{{email}}`, `{{phone}}`, `{{cityIn}}` тощо — щоб
 * реквізити в офері не жили другою копією поруч із налаштуваннями сайту.
 * Розбирається в React-елементи, ніколи не вставляється як HTML.
 */
const InlineText = z.string().max(4000);
const ShortText = z.string().max(300);

/**
 * Чи можна ставити цю адресу в `href`.
 *
 * Живе тут, а не в схемі кнопки, бо перевіряти треба у двох місцях. Схема
 * стереже кнопки — поле, яке редактор заповнює явно. Але посилання буває ще
 * й усередині абзацу, у синтаксисі `[текст](адреса)`, і туди схема не
 * заглядає: для неї це просто рядок. Отже, рендер зобовʼязаний перевірити
 * сам, і перевіряти він має за тим самим правилом — інакше два правила
 * розійдуться, і розійдуться саме там, де це коштує дорого.
 *
 * `javascript:` і `data:` тут не просто заборонені як «підозрілі»: перший —
 * це виконання коду з поля вмісту, другий — сторінка, яку можна вкласти
 * в посилання цілком.
 */
export function isSafeHref(href: string): boolean {
  return href.startsWith('/')
    || href.startsWith('#')
    || href.startsWith('mailto:')
    || href.startsWith('tel:')
    || /^https?:\/\//.test(href);
}

/**
 * Адреса, яка ще не адреса, а підстановка: рівно `{{telegramUrl}}`.
 *
 * Дозволяється лише в тому, що зберігається, — і лише цілком, без хвостів.
 * Сенс: посилання на телеграм у блоці має вести туди ж, куди й у футері, а
 * не бути другою копією контакту, яка розійдеться при зміні.
 *
 * Безпеку це не послаблює, бо перевірок три, і кожна на своєму місці:
 * налаштування не приймають telegramUrl, який не починається з http(s);
 * сюди потрапляє лише підстановка цілком; а на рендері адреса перевіряється
 * ще раз — уже підставленим значенням.
 */
export function isTokenHref(href: string): boolean {
  return /^\{\{\w+\}\}$/.test(href);
}

/** Кнопка. `href` — або внутрішній шлях, або http(s); ніяких `javascript:`. */
export const BlockLink = z.object({
  label: ShortText.min(1),
  href: z.string().min(1).max(500).refine(
    (v) => isSafeHref(v) || isTokenHref(v),
    { message: 'посилання має починатися з /, #, http(s)://, mailto: або tel: — або бути підстановкою на кшталт {{telegramUrl}}' },
  ),
  /** Другорядна кнопка малюється контуром, а не заливкою. */
  secondary: z.boolean().default(false),
});
export type BlockLink = z.infer<typeof BlockLink>;

export const BlockImage = z.object({
  url: z.string().min(1).max(1000),
  alt: ShortText.default(''),
  caption: ShortText.default(''),
});
export type BlockImage = z.infer<typeof BlockImage>;

/** Спільне для всіх блоків. `id` потрібен для порядку й для ключів у React. */
const base = { id: z.string().min(1).max(64), tone: BlockTone.default('plain') };

// ── статичні блоки ──────────────────────────────────────────────────────────

/**
 * Герой має два різні режими, і вибирає їх наявність фотографії.
 *
 * Порожній `image` — набірний варіант: заголовок ліворуч на світлому, як на
 * сторінці статті чи документа. Заповнений — фотографія на весь екран, текст
 * білим по центру поверх неї. Другий режим і є те, заради чого люди
 * приходять на вітрину: перше, що вони бачать, — не слова про товар, а сам
 * товар на людині.
 *
 * Окремим типом блока це робити не варто: поля ті самі, різниця тільки в
 * тому, є картинка чи ні. Два типи означали б два місця, де редактор може
 * помилитися, і дві гілки в кожному рендері.
 */
export const HeroBlock = z.object({
  ...base,
  type: z.literal('hero'),
  eyebrow: ShortText.default(''),
  heading: ShortText.min(1),
  lead: InlineText.default(''),
  /** Дрібний рядок під текстом: «Редакція від 25 серпня 2026 року». */
  footnote: ShortText.default(''),
  links: z.array(BlockLink).max(3).default([]),
  /** Фон на весь екран. Порожня адреса — набірний варіант без фото. */
  image: BlockImage.default({ url: '', alt: '', caption: '' }),
});

export const TextBlock = z.object({
  ...base,
  type: z.literal('text'),
  heading: ShortText.default(''),
  paragraphs: z.array(InlineText).max(40).default([]),
  bullets: z.array(InlineText).max(40).default([]),
});

/**
 * Розділ юридичного документа: наскрізний номер, заголовок і нумеровані
 * підпункти. Окремий тип, а не «текст із списком», бо на пункт 7.3 у розмові
 * з покупцем посилаються буквально — отже, номер має бути даними, а не
 * оформленням, і якір `#p7` має лишитися стабільним.
 */
export const LegalBlock = z.object({
  ...base,
  type: z.literal('legal'),
  number: z.number().int().positive().max(99),
  heading: ShortText.min(1),
  items: z.array(z.object({ n: ShortText.default(''), text: InlineText })).max(40).default([]),
});

export const StepsBlock = z.object({
  ...base,
  type: z.literal('steps'),
  heading: ShortText.default(''),
  lead: InlineText.default(''),
  items: z.array(z.object({ title: ShortText.min(1), text: InlineText.default('') })).max(12).default([]),
});

/** Картки без нумерації: «З ким працюємо». Порядок тут нічого не означає. */
export const CardsBlock = z.object({
  ...base,
  type: z.literal('cards'),
  heading: ShortText.default(''),
  lead: InlineText.default(''),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2),
  items: z.array(z.object({ title: ShortText.min(1), text: InlineText.default('') })).max(12).default([]),
});

export const FeaturesBlock = z.object({
  ...base,
  type: z.literal('features'),
  heading: ShortText.default(''),
  items: z.array(z.object({
    icon: z.enum(['scissors', 'printer', 'truck', 'shield', 'heart', 'clock']).default('shield'),
    title: ShortText.min(1),
    text: InlineText.default(''),
  })).max(6).default([]),
});

export const FaqBlock = z.object({
  ...base,
  type: z.literal('faq'),
  heading: ShortText.default(''),
  items: z.array(z.object({ q: ShortText.min(1), a: InlineText })).max(30).default([]),
});

export const CtaBlock = z.object({
  ...base,
  type: z.literal('cta'),
  heading: ShortText.min(1),
  text: InlineText.default(''),
  links: z.array(BlockLink).max(3).default([]),
});

export const LeadFormBlock = z.object({
  ...base,
  type: z.literal('leadForm'),
  heading: ShortText.min(1),
  text: InlineText.default(''),
  /** Потрапляє в заявку — щоб було видно, з якої сторінки прийшли. */
  source: ShortText.default(''),
});

export const ImageTextBlock = z.object({
  ...base,
  type: z.literal('imageText'),
  image: BlockImage,
  side: z.enum(['left', 'right']).default('left'),
  heading: ShortText.default(''),
  text: InlineText.default(''),
  links: z.array(BlockLink).max(2).default([]),
});

export const GalleryBlock = z.object({
  ...base,
  type: z.literal('gallery'),
  heading: ShortText.default(''),
  items: z.array(BlockImage).max(24).default([]),
});

export const QuoteBlock = z.object({
  ...base,
  type: z.literal('quote'),
  text: InlineText,
  author: ShortText.default(''),
  role: ShortText.default(''),
});

// ── динамічні блоки: вміст беруть із каталогу в момент рендеру ──────────────

export const PrintGridBlock = z.object({
  ...base,
  type: z.literal('printGrid'),
  heading: ShortText.default(''),
  source: z.enum(['latest', 'ready', 'collection', 'breed']).default('latest'),
  /** Потрібен для source = collection | breed. */
  sourceSlug: ShortText.default(''),
  limit: z.number().int().min(1).max(24).default(8),
  moreHref: ShortText.default(''),
});

/**
 * Останні матеріали.
 *
 * Блок ядра, а не магазину: стрічка статей потрібна будь-якому сайту, і
 * нічого про принти вона не знає. Саме тому тут немає фільтра за породою —
 * він затягнув би каталог у ядро заради однієї зручності. Матеріали про
 * породу показує сама породна сторінка, де цей звʼязок і живе.
 */
export const ArticleListBlock = z.object({
  ...base,
  type: z.literal('articleList'),
  heading: ShortText.default(''),
  lead: InlineText.default(''),
  limit: z.number().int().min(1).max(12).default(3),
  moreHref: ShortText.default('/statti'),
});

export const BreedStripBlock = z.object({
  ...base,
  type: z.literal('breedStrip'),
  heading: ShortText.default(''),
  limit: z.number().int().min(1).max(40).default(12),
});

export const CollectionStripBlock = z.object({
  ...base,
  type: z.literal('collectionStrip'),
  heading: ShortText.default(''),
  limit: z.number().int().min(1).max(20).default(6),
});

/**
 * Типи блоків для компонентів.
 *
 * Виведені зі схем, а не написані поруч: інакше через місяць схема й тип
 * розійдуться, і компонент читатиме поле, якого в даних уже немає.
 */
export type HeroBlock = z.infer<typeof HeroBlock>;
export type TextBlock = z.infer<typeof TextBlock>;
export type LegalBlock = z.infer<typeof LegalBlock>;
export type StepsBlock = z.infer<typeof StepsBlock>;
export type CardsBlock = z.infer<typeof CardsBlock>;
export type FeaturesBlock = z.infer<typeof FeaturesBlock>;
export type FaqBlock = z.infer<typeof FaqBlock>;
export type CtaBlock = z.infer<typeof CtaBlock>;
export type LeadFormBlock = z.infer<typeof LeadFormBlock>;
export type ImageTextBlock = z.infer<typeof ImageTextBlock>;
export type GalleryBlock = z.infer<typeof GalleryBlock>;
export type QuoteBlock = z.infer<typeof QuoteBlock>;
export type ArticleListBlock = z.infer<typeof ArticleListBlock>;
export type PrintGridBlock = z.infer<typeof PrintGridBlock>;
export type BreedStripBlock = z.infer<typeof BreedStripBlock>;
export type CollectionStripBlock = z.infer<typeof CollectionStripBlock>;

// ── межа «ядро / модуль» ────────────────────────────────────────────────────
//
// Блоки ядра не знають нічого про предметну область: текст, картинки,
// питання, заклики. Вони потрібні будь-якому сайту — і салону, і майстерні.
//
// Блоки модуля «магазин» читають каталог: принти, породи, колекції. Сайту без
// товарів вони не потрібні, і саме тому лежать окремо, а не в спільній купі.
// Межа проведена тут навмисно: доки вона є в типах, каталог можна вимкнути
// перемикачем, а не гілкою в репозиторії.

const CORE_BLOCKS = [
  HeroBlock, TextBlock, LegalBlock, StepsBlock, CardsBlock, FeaturesBlock,
  FaqBlock, CtaBlock, LeadFormBlock, ImageTextBlock, GalleryBlock, QuoteBlock,
  ArticleListBlock,
] as const;

const SHOP_BLOCKS = [PrintGridBlock, BreedStripBlock, CollectionStripBlock] as const;

export const AnyBlock = z.discriminatedUnion('type', [...CORE_BLOCKS, ...SHOP_BLOCKS]);
export type AnyBlock = z.infer<typeof AnyBlock>;

export type BlockType = AnyBlock['type'];

/**
 * Порядок тут — це порядок у списку «додати блок» в адмінці, тому він
 * не алфавітний: спершу те, що ставлять найчастіше.
 */
export const CORE_BLOCK_TYPES = [
  'hero', 'text', 'cards', 'steps', 'features', 'faq', 'cta', 'leadForm',
  'imageText', 'gallery', 'quote', 'articleList', 'legal',
] as const satisfies readonly BlockType[];

export const SHOP_BLOCK_TYPES = [
  'printGrid', 'breedStrip', 'collectionStrip',
] as const satisfies readonly BlockType[];

export const BLOCK_TYPES = [...CORE_BLOCK_TYPES, ...SHOP_BLOCK_TYPES] as const;

/** Який модуль дає цей блок. Адмінка ховає блоки вимкнених модулів. */
export function moduleOfBlock(type: BlockType): 'content' | 'shop' {
  return (SHOP_BLOCK_TYPES as readonly BlockType[]).includes(type) ? 'shop' : 'content';
}

/** Сторінка не може складатися з сотні блоків — це вже не сторінка. */
export const BlockList = z.array(AnyBlock).max(60);
export type BlockList = z.infer<typeof BlockList>;
