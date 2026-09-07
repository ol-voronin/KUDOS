import { z } from 'zod';
import { PrintSizeTier } from './enums';
import { SLUG_PATTERN } from './slug';

/**
 * Адмінка «Принти».
 *
 * Це єдиний екран каталогу, який справді потрібен щотижня: нові принти
 * зʼявляються постійно, а вироби й варіанти — двічі на рік, і живуть у сіді.
 * Тому тут навмисно немає нічого про тканини, кольори й розміри: принт
 * привʼязується до породи й колекції, а на яких виробах його можна друкувати,
 * вирішує `PrintGarmentRule` через колекцію.
 */

/** Коротка форма для селектів і чипів. */
export const CatalogOptionDto = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
});
export type CatalogOptionDto = z.infer<typeof CatalogOptionDto>;

/**
 * Колір для чипів заборон у формі принта.
 *
 * `name` вже зведений: назва або код постачальника — форма не мусить знати,
 * що власні кольори живуть без назв. `hex` для квадратика; null — малюємо
 * без заливки, кольору ще не оцифрували.
 */
export const ColourOptionDto = z.object({
  id: z.string().uuid(),
  name: z.string(),
  hex: z.string().nullable(),
});
export type ColourOptionDto = z.infer<typeof ColourOptionDto>;

/**
 * Скільки фото можна повісити на один принт.
 *
 * Пʼять — це не технічна межа, а межа уваги: далі покупець не гортає, а
 * адмінка перетворюється на файлообмінник. Число живе тут, бо його однаково
 * перевіряють і форма, і сервер.
 */
export const MAX_PRINT_IMAGES = 5;

/** Дозволені формати. HEIC свідомо немає: браузери його не показують. */
export const PRINT_IMAGE_CONTENT_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/avif',
] as const;

/** Максимальний розмір одного файлу — 8 МБ. Фото товару більшим бути не має. */
export const MAX_PRINT_IMAGE_BYTES = 8 * 1024 * 1024;

export const PrintImageDto = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  /** Ключ у сховищі. Публічному сайту не потрібен, адмінці — так. */
  pathname: z.string(),
  alt: z.string(),
  position: z.number().int().nonnegative(),
});
export type PrintImageDto = z.infer<typeof PrintImageDto>;

/**
 * Розмір файлу ПІСЛЯ стиснення в браузері.
 *
 * Ліміт тіла запиту у Vercel — 4.5 МБ, і саме через нього перша версія
 * вантажила файл напряму з браузера у сховище, повз наш сервер. Виявилось,
 * що браузер туди й не пускають: preflight не проходить, PUT отримує 400.
 *
 * Тому файл іде через наш API, а щоб він гарантовано вліз — браузер спершу
 * стискає його до 2000 px і WebP. Фото виробу після цього важить 200–800 КБ,
 * тож 2.5 МБ тут — стеля з великим запасом, а не робочий розмір.
 */
export const MAX_UPLOAD_BYTES = 2.5 * 1024 * 1024;

/**
 * Реєстрація вже залитого файлу.
 *
 * Заливає вебзастосунок, а не API — тільки в нього є `BLOB_READ_WRITE_TOKEN`.
 * Сюди приходить результат: адреса й ключ. API лишається власником даних і
 * взагалі не знає про сховище.
 */
export const AdminPrintImageCreateDto = z.object({
  url: z.string().trim().url(),
  pathname: z.string().trim().min(1).max(500),
  alt: z.string().trim().max(200).default(''),
});
export type AdminPrintImageCreateDto = z.infer<typeof AdminPrintImageCreateDto>;

/** Новий порядок фото: повний список id у потрібній послідовності. */
export const AdminPrintImageReorderDto = z.object({
  ids: z.array(z.string().uuid()).min(1).max(MAX_PRINT_IMAGES),
});
export type AdminPrintImageReorderDto = z.infer<typeof AdminPrintImageReorderDto>;

export const AdminPrintDto = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  sizeTier: PrintSizeTier,
  previewUrl: z.string(),
  artworkKey: z.string(),
  isPublished: z.boolean(),
  images: z.array(PrintImageDto),
  breeds: z.array(CatalogOptionDto),
  collections: z.array(CatalogOptionDto),
  /** Кольори, на яких цей принт НЕ друкується. Порожньо — друкується на всіх. */
  excludedColourIds: z.array(z.string().uuid()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type AdminPrintDto = z.infer<typeof AdminPrintDto>;

export const AdminPrintListQueryDto = z.object({
  /** Пошук за назвою або slug. */
  q: z.string().trim().min(1).optional(),
  published: z.enum(['true', 'false']).optional(),
  breedId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminPrintListQueryDto = z.infer<typeof AdminPrintListQueryDto>;

export const AdminPrintListDto = z.object({
  items: z.array(AdminPrintDto),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
});
export type AdminPrintListDto = z.infer<typeof AdminPrintListDto>;

const slugField = z
  .string()
  .trim()
  .min(2, 'Замало для адреси')
  .max(80)
  .regex(SLUG_PATTERN, 'Тільки маленькі латинські літери, цифри й дефіси');

export const AdminPrintCreateDto = z.object({
  title: z.string().trim().min(2, 'Назва принта').max(160),
  slug: slugField,
  sizeTier: PrintSizeTier,
  /**
   * Обкладинку більше не вводять руками — її ставить перше завантажене фото.
   * Поле лишається в контракті, бо цим самим DTO користується імпорт, але
   * форма його не надсилає, і принт створюється без жодного зображення.
   */
  previewUrl: z.string().trim().url().or(z.literal('')).default(''),
  /**
   * Де лежить продакшн-макет: шлях у вашому хмарному диску, назва файлу —
   * будь-що, що допоможе його знайти. У публічний API не виходить ніколи.
   */
  artworkKey: z.string().trim().max(500).default(''),
  isPublished: z.boolean().default(false),
  breedIds: z.array(z.string().uuid()).max(20).default([]),
  collectionIds: z.array(z.string().uuid()).max(20).default([]),
  /**
   * Заборонені кольори. Список ПОВНИЙ, а не дельта: форма надсилає те, що
   * бачить, сервер приводить таблицю заборон до цього списку.
   */
  excludedColourIds: z.array(z.string().uuid()).max(60).default([]),
});
export type AdminPrintCreateDto = z.infer<typeof AdminPrintCreateDto>;
/**
 * Те, що надсилає форма — до застосування дефолтів.
 *
 * `z.infer` описує форму ПІСЛЯ парсингу, де поля з `.default()` уже
 * обовʼязкові. Клієнт їх не надсилає, тому йому потрібен саме вхідний тип.
 */
export type AdminPrintCreateInput = z.input<typeof AdminPrintCreateDto>;

/** Часткове оновлення: форма надсилає лише те, що змінилось. */
export const AdminPrintUpdateDto = AdminPrintCreateDto.partial();
export type AdminPrintUpdateDto = z.infer<typeof AdminPrintUpdateDto>;
export type AdminPrintUpdateInput = z.input<typeof AdminPrintUpdateDto>;

/**
 * Створення породи прямо з форми принта.
 *
 * Без цього перший принт нової породи впирається в порожній селект — і людина
 * йде шукати, де ж заводяться породи. Порода тут — це не довідник, а звичайна
 * сутність із двох полів.
 */
export const AdminBreedCreateDto = z.object({
  name: z.string().trim().min(2, 'Назва породи').max(120),
  slug: slugField,
});
export type AdminBreedCreateDto = z.infer<typeof AdminBreedCreateDto>;
