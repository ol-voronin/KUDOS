import { z } from 'zod';
import {
  GarmentFit, GarmentType, MeasurementKey, PrintSizeTier, ProductLine,
  VariantAvailability,
} from './enums';

const Slug = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'kebab-case slug');
const MinorAmount = z.number().int().nonnegative();

/**
 * Посилання на картинку: або абсолютний URL (сховище), або шлях від кореня
 * сайту (`/garments/hudi-klasychnyi/chornyi.webp`).
 *
 * Раніше тут стояло просто `z.string().url()`, і це коштувало нам цілої
 * сторінки: принт без завантаженого фото має `previewUrl = ''`, zod валив
 * усю відповідь, `serverFetch` кидав, сторінка віддавала 404. Порожня
 * обкладинка — це косметична вада картки, а не причина ховати товар.
 */
const ImageRef = z.string().refine(
  (v) => v === '' || v.startsWith('/') || /^https?:\/\//.test(v),
  { message: 'must be empty, a site-root path, or an http(s) URL' },
);

export const ColourDto = z.object({
  id: z.string().uuid(),
  /** Native Spirit has these; own production is only numbered, so null here. */
  name: z.string().min(1).nullable(),
  /** Supplier's own code — "38", "NS-Aquamarine". Always present. */
  supplierCode: z.string().min(1),
  /** #RRGGBB for the swatch. Null means "we have not digitised it yet". */
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  imageUrl: ImageRef.nullable(),
});
export type ColourDto = z.infer<typeof ColourDto>;

export const SizeMeasurementDto = z.object({
  key: MeasurementKey,
  /** Centimetres. Stored as a string range for values like "66-76". */
  value: z.string().min(1),
});

export const SizeDto = z.object({
  id: z.string().uuid(),
  /** As printed on the size chart: "XS", "XS/S", "116", "98-104". */
  label: z.string().min(1),
  position: z.number().int().nonnegative(),
  measurements: z.array(SizeMeasurementDto),
});
export type SizeDto = z.infer<typeof SizeDto>;

export const FabricDto = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  /** g/m². One number, not a range — pick it and put it here. */
  weightGsm: z.number().int().positive(),
  composition: z.string().min(1),
  origin: z.string().nullable(),
});
export type FabricDto = z.infer<typeof FabricDto>;

export const GarmentDto = z.object({
  id: z.string().uuid(),
  slug: Slug,
  line: ProductLine,
  type: GarmentType,
  fit: GarmentFit,
  name: z.string().min(1),
  /** Own production can shorten the garment. No blank can. Real selling point. */
  lengthAdjustable: z.boolean(),
  basePriceMinor: MinorAmount,
  /** Один-два рядки з паспорта виробу: крій, кому пасує. */
  description: z.string(),
  fabrics: z.array(FabricDto).min(1),
  sizes: z.array(SizeDto).min(1),
});
export type GarmentDto = z.infer<typeof GarmentDto>;

export const VariantDto = z.object({
  id: z.string().uuid(),
  sku: z.string().min(1),
  garmentId: z.string().uuid(),
  fabricId: z.string().uuid(),
  colourId: z.string().uuid(),
  sizeId: z.string().uuid(),
  availability: VariantAvailability,
  /** Required when availability is MADE_TO_ORDER; enforced by refinement. */
  leadTimeDays: z.number().int().positive().nullable(),
  /** Overrides garment.basePriceMinor when the variant costs more. */
  priceOverrideMinor: MinorAmount.nullable(),
  /**
   * Кінцева ціна виробу для цього варіанта: база, надбавки за розмір,
   * тканину й колір, або ручна ціна. Друк не входить.
   *
   * Рахує сервер, і саме тому поле тут є. Клієнт міг би скласти базу з
   * `priceOverrideMinor` сам — і робив це, доки надбавок не було. Щойно
   * зʼявляються правила, «складу сам» означає другу реалізацію
   * ціноутворення в браузері, яка розійдеться з касою.
   */
  priceMinor: MinorAmount,
}).refine(
  (v) => v.availability !== 'MADE_TO_ORDER' || v.leadTimeDays !== null,
  { message: 'MADE_TO_ORDER variants must declare leadTimeDays', path: ['leadTimeDays'] },
);
export type VariantDto = z.infer<typeof VariantDto>;

export const PrintDto = z.object({
  id: z.string().uuid(),
  slug: Slug,
  title: z.string().min(1),
  /** Drives the print price. */
  sizeTier: PrintSizeTier,
  collectionSlugs: z.array(Slug),
  breedSlugs: z.array(Slug),
  previewUrl: ImageRef,
  isPublished: z.boolean(),
});
export type PrintDto = z.infer<typeof PrintDto>;

/** What the product page actually renders: one print, its offerable variants. */
export const PrintOfferDto = z.object({
  print: PrintDto,
  /**
   * Галерея. Перший елемент дублює `print.previewUrl` — це та сама обкладинка;
   * сторінка товару показує всі, сітки каталогу — тільки обкладинку.
   */
  images: z.array(z.object({ url: ImageRef, alt: z.string() })),
  garments: z.array(GarmentDto),
  variants: z.array(VariantDto),
  colours: z.array(ColourDto),
  printPriceMinor: MinorAmount,
});
export type PrintOfferDto = z.infer<typeof PrintOfferDto>;

/**
 * Сторінка базового одягу: той самий виріб із варіантами, але без принта.
 *
 * Той самий `VariantDto` з порахованою `priceMinor`, що й у пропозиції
 * принта, — свідомо: ціна виробу і там, і тут рахується одним ціновим
 * доменом, і розійтися їм нема де.
 */
export const GarmentOfferDto = z.object({
  garment: GarmentDto,
  variants: z.array(VariantDto),
  colours: z.array(ColourDto),
});
export type GarmentOfferDto = z.infer<typeof GarmentOfferDto>;

/** A resolved, purchasable line: garment + print + computed total. */
export const PricedOfferDto = z.object({
  variantId: z.string().uuid(),
  printId: z.string().uuid(),
  garmentPriceMinor: MinorAmount,
  printPriceMinor: MinorAmount,
  totalMinor: MinorAmount,
  purchasable: z.boolean(),
  /** Why not, in a form the UI can show verbatim. */
  blockedReason: z.string().nullable(),
  leadTimeDays: z.number().int().positive().nullable(),
});
export type PricedOfferDto = z.infer<typeof PricedOfferDto>;

/**
 * Порядок у каталозі.
 *
 * `new` перший і за замовчуванням: сітка без явного сортування має показувати
 * те, що додали останнім, інакше нові принти назавжди осідають на третій
 * сторінці. `cheap` існує тому, що це найчастіше питання після «а моя
 * порода є» — «а скільки».
 */
export const CatalogSort = z.enum(['new', 'cheap', 'expensive', 'name']);
export type CatalogSort = z.infer<typeof CatalogSort>;

/**
 * Фільтри каталогу.
 *
 * Свідомо НЕ фільтруємо за розміром одягу (S/M/L). Розмір — це властивість
 * останнього кроку покупки, а не спосіб звузити перелік малюнків: принт
 * друкується на будь-якому розмірі, тож такий фільтр нічого не відсіює й
 * лише вдає роботу. Те, що людина насправді має на увазі під «є мій
 * розмір», — це `inStock`: готовий виріб, який не треба чекати.
 *
 * `sizeTier` — це розмір ПРИНТА (міні / середній / максі), і він міняє
 * ціну, тому фільтр за ним чесний.
 */
export const CatalogQueryDto = z.object({
  collection: Slug.optional(),
  breed: Slug.optional(),
  garmentType: GarmentType.optional(),
  line: ProductLine.optional(),
  sizeTier: PrintSizeTier.optional(),
  /*
   * Тільки те, що фізично є на складі.
   *
   * НЕ `z.coerce.boolean()`: у JS `Boolean('false') === true`, тобто
   * `?inStock=false` вмикав би фільтр замість вимикати. З адреси значення
   * приходить рядком, тому рядок розбирається явно.
   */
  inStock: z.preprocess(
    (v) => (typeof v === 'string' ? v === '1' || v === 'true' : v),
    z.boolean(),
  ).optional(),
  sort: CatalogSort.default('new'),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(60).default(24),
});
export type CatalogQueryDto = z.infer<typeof CatalogQueryDto>;

/**
 * Пошук із фільтрами.
 *
 * Фільтри застосовуються ТІЛЬКИ до принтів. Породи й колекції — це не товар,
 * а входи в каталог, і відсіювати їх за типом виробу означає ховати від
 * людини сторінку, яка існує й відповідає на її запит.
 */
export const SearchQueryDto = CatalogQueryDto.omit({ page: true, perPage: true }).extend({
  q: z.string().default(''),
});
export type SearchQueryDto = z.infer<typeof SearchQueryDto>;

/**
 * Плитка принта в будь-якій сітці — головна, породна, колекція, каталог.
 *
 * Одна на всі: інакше на одному сайті зʼявляються дві різні картки принта —
 * одна з ціною, друга без, — і «а чому тут не видно, скільки коштує» стає
 * постійним питанням.
 */
export const PrintCardDto = z.object({
  id: z.string().uuid(),
  slug: Slug,
  title: z.string().min(1),
  sizeTier: PrintSizeTier,
  previewUrl: z.string(),
  /**
   * «від N ₴» — найдешевший виріб, на якому цей принт узагалі можна
   * надрукувати, плюс друк за його розміром. `null`, якщо принт не привʼязаний
   * до жодної колекції з правилами: тоді купити його ніде, і ціни немає.
   * Саме `null`, а не нуль: нуль на картці читався б як «безкоштовно».
   */
  fromPriceMinor: MinorAmount.nullable(),
  /** Є варіант у наявності — тобто без очікування пошиття. */
  inStock: z.boolean(),
});
export type PrintCardDto = z.infer<typeof PrintCardDto>;

export const PrintListDto = z.object({
  items: z.array(PrintCardDto),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
});
export type PrintListDto = z.infer<typeof PrintListDto>;

// ---------------------------------------------------------------------------
// Асортимент — сторінка «Вироби»
// ---------------------------------------------------------------------------

/**
 * Один виріб у вітрині асортименту.
 *
 * Це не те саме, що `GarmentDto` у пропозиції принта. Там виріб — це варіант
 * вибору всередині товару; тут він сам є товаром, який людина розглядає
 * окремо: «а що ви взагалі шиєте, з чого і в яких кольорах». Тому тут є
 * кольори (у пропозиції вони спільні для всіх виробів) і немає варіантів.
 */
export const RangeColourDto = ColourDto.extend({
  /** Чи є фото цього виробу саме в цьому кольорі. Керує показом свотча. */
  hasPhoto: z.boolean(),
});
export type RangeColourDto = z.infer<typeof RangeColourDto>;

export const RangeGarmentDto = GarmentDto.extend({
  colours: z.array(RangeColourDto),
  /** Найкоротший строк виготовлення серед варіантів виробу, у днях. */
  leadTimeDays: z.number().int().positive().nullable(),
});
export type RangeGarmentDto = z.infer<typeof RangeGarmentDto>;

export const RangeDto = z.object({
  garments: z.array(RangeGarmentDto),
  /** Ціна друку за розміром — щоб сторінка показала «виріб + друк = від». */
  printPrices: z.array(z.object({ tier: PrintSizeTier, priceMinor: MinorAmount })),
});
export type RangeDto = z.infer<typeof RangeDto>;
