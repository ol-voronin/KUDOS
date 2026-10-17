import type { GarmentDto, GarmentType, PrintOfferDto, VariantDto } from '@dt/contracts';
import { canOptimizeImage } from '@/lib/image-source';
import { printOfferPath } from '@/features/catalog/offer-link';
import { isOfferable } from '@/features/catalog/variant-selection';

/**
 * Товарний фід Google Merchant Center (RSS 2.0 з полями `g:`).
 *
 * Тут лише чиста логіка: дані каталогу на вході, XML на виході. Звідки
 * дані беруться й скільки кешуються — у `app/feeds/google-merchant.xml/route.ts`.
 *
 * Специфікація полів: https://support.google.com/merchants/answer/7052112
 */

// ---------------------------------------------------------------------------
// Що потрапляє у фід
// ---------------------------------------------------------------------------

/**
 * ВІДБІР ТОВАРІВ. Єдине місце, яке треба правити, щоб розширити фід.
 *
 * Повний каталог — 84 принти × 393 варіанти ≈ 33 000 позицій. На старт це
 * забагато: кожну позицію Google перевіряє окремо, і помилка в правилах
 * множиться на тисячі відхилень. Тому стартовий фід — кожен опублікований
 * принт × два головні вироби × один колір × усі розміри (≈ 84 × 13 ≈ 1 100).
 *
 * Чому саме так:
 * - класична футболка — найдешевший виріб, ціна з плитки каталогу («1 190 ₴»);
 * - класичний худі — найдорожчий і найпопулярніший запит в рекламі (група A3.4);
 * - чорний — колір, який власне виробництво гарантує (див. `VariantAvailability`),
 *   і він є на фото-підкладках обох виробів.
 *
 * Якщо жодного з кольорів `colourCodes` у принта немає (принт «на світле»
 * без чорного), береться перший колір, у якому виріб цього принта взагалі є:
 * інакше принт мовчки випадав би з фіду.
 *
 * Розширювати так: додати виріб (`svitshot-klasychnyi`, …) або колір у
 * `colourCodes`. Кожен колір — окремий набір позицій у тій самій групі
 * `item_group_id`, тож Google покаже їх як варіанти одного товару.
 */
export const FEED_SELECTION: ReadonlyArray<{ garmentSlug: string; colourCodes: readonly string[] }> = [
  { garmentSlug: 'futbolka-klasychna', colourCodes: ['chornyi'] },
  { garmentSlug: 'hudi-klasychnyi', colourCodes: ['chornyi'] },
];

/** Бренд у фіді. Латиницею, як домен і як його шукають: «babaka». */
export const FEED_BRAND = 'Babaka';

/**
 * Категорії Google (числові id таксономії). Футболки, світшоти й худі — це
 * все «Apparel & Accessories > Clothing > Shirts & Tops» (212); окремої гілки
 * для худі в таксономії немає. Тип без категорії у фід не потрапляє: краще
 * не показати товар, ніж показати його не в тій полиці.
 */
const GOOGLE_CATEGORY: Partial<Record<GarmentType, string>> = {
  TSHIRT: '212',
  SWEATSHIRT: '212',
  HOODIE: '212',
  ZIP_HOODIE: '212',
  JOGGERS: '204', // Apparel & Accessories > Clothing > Pants
};

/** Перший рівень `product_type` — наш власний поділ, для звітів і груп кампаній. */
const TYPE_LABEL: Record<GarmentType, string> = {
  TSHIRT: 'Футболки',
  SWEATSHIRT: 'Світшоти',
  HOODIE: 'Худі',
  ZIP_HOODIE: 'Худі на блискавці',
  JOGGERS: 'Джогери',
  TOTE_BAG: 'Шопери',
};

// Обмеження Merchant Center.
const MAX_ID = 50;
const MAX_TITLE = 150;
const MAX_DESCRIPTION = 5000;
const MAX_PRODUCT_TYPES = 5;

// ---------------------------------------------------------------------------
// Типи
// ---------------------------------------------------------------------------

export interface FeedContext {
  /** `https://babaka.shop` без слеша в кінці. */
  baseUrl: string;
  /** «у Харкові» — з налаштувань сайту. */
  cityIn: string;
  /** Робочі дні від замовлення до відправки — з налаштувань сайту. */
  productionDaysMin: number;
  productionDaysMax: number;
  /** slug колекції → назва. */
  collections: ReadonlyMap<string, string>;
  /** slug породи → назва. */
  breeds: ReadonlyMap<string, string>;
}

export interface FeedItem {
  id: string;
  itemGroupId: string;
  title: string;
  description: string;
  link: string;
  imageLink: string;
  additionalImageLinks: string[];
  availability: 'in_stock' | 'out_of_stock';
  /** «1190.00 UAH» */
  price: string;
  brand: string;
  googleProductCategory: string;
  productTypes: string[];
  gender: 'unisex' | 'female' | 'male';
  ageGroup: 'adult' | 'kids';
  color: string;
  size: string;
  material: string | null;
  minHandlingTime: number;
  maxHandlingTime: number;
}

// ---------------------------------------------------------------------------
// Дрібні правила
// ---------------------------------------------------------------------------

/**
 * Лайка з назв. Колекція «F*ck winter» у назві товару майже напевно
 * отримає відхилення за політикою щодо ненормативної лексики — Google
 * зірочку не вважає цензурою. Слово прибирається, решта лишається:
 * «F*ck winter» → «Winter». На сайті назва та сама, змінюється лише фід.
 */
const PROFANITY = /\bf(?:\*{1,2}|u|@|#)?c?k(?:ing)?\b[\s,!.:;-]*(?:you\b[\s,!.:;-]*)?/giu;

export function cleanForAds(text: string): string {
  const cleaned = text.replace(PROFANITY, ' ').replace(/\s{2,}/g, ' ').trim();
  return cleaned.charAt(0).toLocaleUpperCase('uk-UA') + cleaned.slice(1);
}

/** FNV-1a, 32 біти. Не для безпеки — лише щоб довгий id став коротким і стабільним. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Ідентифікатор з лімітом Google у 50 символів.
 *
 * Читабельний `<принт>--<sku варіанта>`, поки влазить; довший обрізається й
 * отримує хвіст із хешу повного рядка. Обидва варіанти залежать тільки від
 * слага принта й sku, тож id не змінюється між вивантаженнями — інакше
 * Google щоразу вважав би товар новим і скидав його історію.
 */
export function feedId(raw: string): string {
  if (raw.length <= MAX_ID) return raw;
  return `${raw.slice(0, MAX_ID - 9)}~${fnv1a(raw)}`;
}

/** Ціна у форматі Merchant Center: «1190.00 UAH». */
export function formatPrice(minor: number): string {
  return `${(minor / 100).toFixed(2)} UAH`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:—-]+$/u, '')}…`;
}

/**
 * Картинка через оптимізатор сайту, а не прямо з Blob.
 *
 * Google тягне картинки товарів регулярно й для кожної позиції; пряме
 * посилання на Blob знову гнало б трафік Blob Data Transfer (інцидент
 * 11–12.10). Через `/_next/image` Blob бачить лише перше звернення, далі
 * віддає CDN сайту. 1200 px — із запасом над мінімумом Google (250 px для
 * одягу), і ця ширина є в стандартному наборі `deviceSizes` Next.
 */
export function feedImageUrl(src: string, baseUrl: string): string {
  if (canOptimizeImage(src) || src.startsWith('/')) {
    return `${baseUrl}/_next/image?url=${encodeURIComponent(src)}&w=1200&q=80`;
  }
  return src;
}

function genderOf(garment: GarmentDto): FeedItem['gender'] {
  return garment.fit === 'OVERSIZE_WOMEN' ? 'female' : 'unisex';
}

/** «100% органічна бавовна. З начісом.» → «100% органічна бавовна». */
function materialOf(composition: string): string | null {
  const first = composition.split('.')[0]?.trim() ?? '';
  return first === '' ? null : truncate(first, 200);
}

/** Чи вже згадана порода в назві принта («Шпіц» у «Шпіц»), щоб не писати двічі. */
function mentioned(breedName: string, printTitle: string): boolean {
  const norm = (s: string) => s.toLocaleLowerCase('uk-UA').replace(/[’'ʼ`-]/g, ' ').replace(/\s+/g, ' ').trim();
  const b = norm(breedName);
  const t = norm(printTitle);
  return t.includes(b) || b.includes(t);
}

// ---------------------------------------------------------------------------
// Збирання позицій
// ---------------------------------------------------------------------------

/**
 * Позиції фіду для одного принта.
 *
 * Ціна — та сама, що на сторінці й у касі: `variant.priceMinor` (сервер уже
 * врахував надбавки) + `printPriceMinor`. Варіант, якого немає в даних,
 * не вигадується: якщо в принта немає чорного худі, худі цього принта у фід
 * просто не йде.
 */
export function feedItemsForOffer(offer: PrintOfferDto, ctx: FeedContext): FeedItem[] {
  const { print } = offer;
  if (!print.isPublished) return [];

  const collectionTitle = cleanForAds(
    print.collectionSlugs.map((s) => ctx.collections.get(s)).find((t) => t !== undefined) ?? '',
  );
  const printTitle = cleanForAds(print.title);
  const breedNames = print.breedSlugs
    .map((s) => ctx.breeds.get(s))
    .filter((n): n is string => n !== undefined);
  const extraBreeds = breedNames.filter((n) => !mentioned(n, printTitle));

  const cover = offer.images[0]?.url || print.previewUrl;
  if (!cover) return []; // без фото Google товар не прийме

  const imageLink = feedImageUrl(cover, ctx.baseUrl);
  const additionalImageLinks = offer.images.slice(1, 11)
    .map((i) => i.url)
    .filter((u) => u !== '' && u !== cover)
    .map((u) => feedImageUrl(u, ctx.baseUrl));

  const items: FeedItem[] = [];

  for (const pick of FEED_SELECTION) {
    const garment = offer.garments.find((g) => g.slug === pick.garmentSlug);
    if (!garment) continue;
    const category = GOOGLE_CATEGORY[garment.type];
    if (category === undefined) continue;

    const onGarment = offer.colours.filter((c) =>
      offer.variants.some((v) => v.garmentId === garment.id && v.colourId === c.id));
    const listed = onGarment.filter((c) => pick.colourCodes.includes(c.supplierCode));
    const colours = listed.length > 0 ? listed : onGarment.slice(0, 1);

    for (const colour of colours) {
      const colourName = colour.name ?? colour.supplierCode;

      const variants = offer.variants
        .filter((v) => v.garmentId === garment.id && v.colourId === colour.id)
        .map((v) => ({ v, size: garment.sizes.find((s) => s.id === v.sizeId) }))
        .filter((x): x is { v: VariantDto; size: NonNullable<typeof x.size> } => x.size !== undefined)
        .sort((a, b) => a.size.position - b.size.position);

      const title = truncate(
        `${garment.name} з принтом «${printTitle}»`
          + (collectionTitle !== '' ? ` (${collectionTitle})` : '')
          + (extraBreeds.length > 0 ? ` — ${extraBreeds.join(', ')}` : ''),
        MAX_TITLE,
      );

      for (const { v, size } of variants) {
        const fabric = garment.fabrics.find((f) => f.id === v.fabricId) ?? garment.fabrics[0];
        const description = truncate([
          `Принт «${printTitle}»${collectionTitle !== '' ? ` з колекції «${collectionTitle}»` : ''}`
            + `${breedNames.length > 0 ? ` (${breedNames.join(', ')})` : ''}`
            + ` на виробі «${garment.name}», колір ${colourName}, розмір ${size.label}.`,
          garment.description,
          fabric ? `Тканина: ${fabric.composition.trim().replace(/([^.])$/, '$1.')} Щільність ${fabric.weightGsm} г/м².` : '',
          `Друкуємо ${ctx.cityIn} під замовлення: ${ctx.productionDaysMin}–${ctx.productionDaysMax} робочих днів до відправки, доставка Новою поштою.`,
        ].filter((s) => s.trim() !== '').join(' '), MAX_DESCRIPTION);

        items.push({
          id: feedId(`${print.slug}--${v.sku}`),
          itemGroupId: feedId(`${print.slug}--${garment.slug}`),
          title,
          description,
          link: `${ctx.baseUrl}${printOfferPath(print.slug, {
            garmentSlug: garment.slug, colourCode: colour.supplierCode, sizeLabel: size.label,
          })}`,
          imageLink,
          additionalImageLinks,
          /*
           * Друк під замовлення за кілька днів — це `in_stock`, а не
           * `preorder`: preorder у Google означає «товар ще не вийшов» і
           * вимагає дати появи. Строк виготовлення передається окремо як
           * час обробки (handling time). Чого купити не можна — out_of_stock,
           * за тим самим правилом, що й кнопка «У кошик».
           */
          availability: isOfferable(v) ? 'in_stock' : 'out_of_stock',
          price: formatPrice(v.priceMinor + offer.printPriceMinor),
          brand: FEED_BRAND,
          googleProductCategory: category,
          productTypes: (breedNames.length > 0 ? breedNames : [printTitle])
            .slice(0, MAX_PRODUCT_TYPES)
            .map((b) => `${TYPE_LABEL[garment.type]} > ${b}`),
          gender: genderOf(garment),
          ageGroup: garment.fit === 'KIDS' ? 'kids' : 'adult',
          color: colourName,
          size: size.label,
          material: fabric ? materialOf(fabric.composition) : null,
          minHandlingTime: ctx.productionDaysMin,
          maxHandlingTime: Math.max(ctx.productionDaysMax, ctx.productionDaysMin),
        });
      }
    }
  }

  return items;
}

/**
 * Усі позиції фіду. Дублікати id відкидаються (перший виграє): Google на
 * дубль відповідає помилкою на весь товар, і краще втратити одну позицію,
 * ніж обидві.
 */
export function buildFeedItems(offers: readonly PrintOfferDto[], ctx: FeedContext): FeedItem[] {
  const seen = new Set<string>();
  const out: FeedItem[] = [];
  for (const offer of offers) {
    for (const item of feedItemsForOffer(offer, ctx)) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------

/**
 * Екранування для тексту й атрибутів XML. Плюс викидаються керівні символи,
 * заборонені в XML 1.0: один такий у описі з адмінки — і Google відкидає
 * весь файл, а не одну позицію.
 */
export function escapeXml(text: string): string {
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function tag(name: string, value: string | number): string {
  return `<${name}>${escapeXml(String(value))}</${name}>`;
}

function itemXml(item: FeedItem): string {
  const lines = [
    tag('g:id', item.id),
    tag('g:item_group_id', item.itemGroupId),
    tag('title', item.title),
    tag('description', item.description),
    tag('link', item.link),
    tag('g:image_link', item.imageLink),
    ...item.additionalImageLinks.map((u) => tag('g:additional_image_link', u)),
    tag('g:availability', item.availability),
    tag('g:price', item.price),
    tag('g:brand', item.brand),
    // GTIN немає й не буде: це друк під замовлення, не заводський товар.
    tag('g:identifier_exists', 'no'),
    tag('g:condition', 'new'),
    tag('g:google_product_category', item.googleProductCategory),
    ...item.productTypes.map((t) => tag('g:product_type', t)),
    tag('g:gender', item.gender),
    tag('g:age_group', item.ageGroup),
    tag('g:color', item.color),
    tag('g:size', item.size),
    ...(item.material !== null ? [tag('g:material', item.material)] : []),
    tag('g:min_handling_time', item.minHandlingTime),
    tag('g:max_handling_time', item.maxHandlingTime),
  ];
  return `<item>\n  ${lines.join('\n  ')}\n</item>`;
}

export function renderFeedXml(items: readonly FeedItem[], channel: { title: string; link: string; description: string }): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '<channel>',
    tag('title', channel.title),
    tag('link', channel.link),
    tag('description', channel.description),
    ...items.map(itemXml),
    '</channel>',
    '</rss>',
    '',
  ].join('\n');
}
