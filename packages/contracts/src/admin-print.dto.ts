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

export const AdminPrintDto = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  sizeTier: PrintSizeTier,
  previewUrl: z.string(),
  artworkKey: z.string(),
  isPublished: z.boolean(),
  breeds: z.array(CatalogOptionDto),
  collections: z.array(CatalogOptionDto),
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
   * Поки завантаження немає — це посилання на зображення. Коли зʼявиться
   * upload, поле лишається тим самим, просто поруч буде кнопка.
   */
  previewUrl: z.string().trim().url('Потрібне повне посилання, з https://'),
  /**
   * Де лежить продакшн-макет: шлях у вашому хмарному диску, назва файлу —
   * будь-що, що допоможе його знайти. У публічний API не виходить ніколи.
   */
  artworkKey: z.string().trim().max(500).default(''),
  isPublished: z.boolean().default(false),
  breedIds: z.array(z.string().uuid()).max(20).default([]),
  collectionIds: z.array(z.string().uuid()).max(20).default([]),
});
export type AdminPrintCreateDto = z.infer<typeof AdminPrintCreateDto>;

/** Часткове оновлення: форма надсилає лише те, що змінилось. */
export const AdminPrintUpdateDto = AdminPrintCreateDto.partial();
export type AdminPrintUpdateDto = z.infer<typeof AdminPrintUpdateDto>;

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
