import { z } from 'zod';
import { GarmentType } from './enums';
import { PrintCardDto } from './catalog.dto';

/**
 * Головна й довідники каталогу.
 *
 * Головна тягне все одним запитом. Причина не в економії трафіку, а в тому,
 * що склад головної — продуктове рішення, і воно має жити на сервері. Коли
 * фронт збирає її з пʼяти ендпоінтів, «що показувати першим» непомітно
 * переїжджає в React-компонент, і змінити порядок стає задачею на релиз.
 */

const Slug = z.string().min(1).max(120);
const MinorAmount = z.number().int().nonnegative();

export const BreedCardDto = z.object({
  id: z.string().uuid(),
  slug: Slug,
  name: z.string().min(1),
  printCount: z.number().int().nonnegative(),
  /**
   * Обкладинка плитки породи: фотографія самої собаки, якщо вона заведена,
   * інакше — прев'ю одного з принтів цієї породи.
   *
   * Який саме це випадок, фронт не питає: сервер уже обрав краще з наявного.
   * Порожній рядок — ні фото, ні принтів. Плитка тоді малюється без
   * картинки; це не помилка, а «намалюємо на замовлення».
   */
  previewUrl: z.string().default(''),
});
export type BreedCardDto = z.infer<typeof BreedCardDto>;

export const CollectionCardDto = z.object({
  id: z.string().uuid(),
  slug: Slug,
  title: z.string().min(1),
  description: z.string().nullable(),
  printCount: z.number().int().nonnegative(),
  /** Перші кілька прев'ю — щоб плитка колекції не була порожнім прямокутником. */
  previewUrls: z.array(z.string()),
});
export type CollectionCardDto = z.infer<typeof CollectionCardDto>;

export const HomeDto = z.object({
  /** Породи з принтами, найпопулярніші першими. Питання №1 на сайті. */
  breeds: z.array(BreedCardDto),
  collections: z.array(CollectionCardDto),
  newPrints: z.array(PrintCardDto),
  /** Замість «розпродажу»: те, що не треба чекати. Дефіцит справжній. */
  readyToShip: z.array(PrintCardDto),
  /** Скільки всього опублікованих принтів — для «дивитись усі (N)». */
  totalPrints: z.number().int().nonnegative(),
});
export type HomeDto = z.infer<typeof HomeDto>;

export const BreedListDto = z.object({ items: z.array(BreedCardDto) });
export type BreedListDto = z.infer<typeof BreedListDto>;

export const CollectionListDto = z.object({ items: z.array(CollectionCardDto) });
export type CollectionListDto = z.infer<typeof CollectionListDto>;

/** Породна сторінка: головний вхід із пошуку. */
export const BreedPageDto = z.object({
  breed: z.object({
    id: z.string().uuid(),
    slug: Slug,
    name: z.string().min(1),
    /** «вельш-коргі», «corgi» — те, за чим реально гуглять. */
    synonyms: z.array(z.string()),
    /** Фото собаки для шапки сторінки. Null — показуємо саму лише типографіку. */
    photoUrl: z.string().nullable().default(null),
  }),
  prints: z.array(PrintCardDto),
  /** Типи виробів, на яких доступні ці принти — для фільтра. */
  garmentTypes: z.array(GarmentType),
  /** Внутрішня перелінковка: без неї довгий хвіст не індексується. */
  relatedBreeds: z.array(BreedCardDto),
});
export type BreedPageDto = z.infer<typeof BreedPageDto>;

export const CollectionPageDto = z.object({
  collection: z.object({
    id: z.string().uuid(),
    slug: Slug,
    title: z.string().min(1),
    description: z.string().nullable(),
  }),
  prints: z.array(PrintCardDto),
});
export type CollectionPageDto = z.infer<typeof CollectionPageDto>;

/** Плоский список для sitemap.xml. */
export const SitemapEntryDto = z.object({
  slug: Slug,
  updatedAt: z.coerce.date(),
});

export const SitemapDto = z.object({
  prints: z.array(SitemapEntryDto),
  breeds: z.array(SitemapEntryDto),
  collections: z.array(SitemapEntryDto),
  /**
   * Сторінки виробів. Довго їх тут не було, і сім сторінок, які єдині
   * відповідають на «футболка оверсайз жіноча» чи «худі 350 розмірна
   * сітка», просто не існували для пошуку: у карті стояв тільки розділ
   * `/vyroby`, а самі вироби — ні.
   */
  garments: z.array(SitemapEntryDto),
});
export type SitemapDto = z.infer<typeof SitemapDto>;

/**
 * Пошук по сайту.
 *
 * Результати згруповані, а не змішані в один список: породи, колекції й
 * принти — це різні наміри. «Коргі» майже завжди означає «покажи всі принти
 * з коргі», тобто породу, а не конкретний принт із цим словом у назві.
 * Плаский список за релевантністю ховав би породу серед десяти принтів.
 */
export const SearchResultDto = z.object({
  query: z.string(),
  breeds: z.array(BreedCardDto),
  collections: z.array(CollectionCardDto),
  prints: z.array(PrintCardDto),
  total: z.number().int().nonnegative(),
});
export type SearchResultDto = z.infer<typeof SearchResultDto>;
