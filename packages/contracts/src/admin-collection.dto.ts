import { z } from 'zod';
import { SLUG_PATTERN } from './slug';

/**
 * Адмінка «Колекції».
 *
 * Колекція — це вітринна полиця: назва, опис, порядок і перелік принтів.
 * Принти привʼязуються ПРЯМО ТУТ, а не лише у формі принта: Даша збирає
 * колекцію як ціле («ці шість — на полицю Vintage»), і ганяти її по шести
 * формах принтів заради цього — знущання. Звʼязок той самий
 * (`PrintCollection`), просто дверей до нього двоє.
 *
 * Перейменування опублікованої колекції міняє slug тільки якщо його змінили
 * явно: назва — це вітрина, адреса — це посилання, і зміна першої не мусить
 * тихо ламати друге.
 */

const slugField = z
  .string()
  .trim()
  .min(2, 'Замало для адреси')
  .max(80)
  .regex(SLUG_PATTERN, 'Тільки маленькі латинські літери, цифри й дефіси');

/** Принт у списку колекції: рівно стільки, щоб упізнати й прибрати. */
export const AdminCollectionPrintDto = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  previewUrl: z.string(),
  isPublished: z.boolean(),
});
export type AdminCollectionPrintDto = z.infer<typeof AdminCollectionPrintDto>;

export const AdminCollectionDto = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  position: z.number().int(),
  isPublished: z.boolean(),
  prints: z.array(AdminCollectionPrintDto),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type AdminCollectionDto = z.infer<typeof AdminCollectionDto>;

export const AdminCollectionListDto = z.object({
  items: z.array(AdminCollectionDto),
});
export type AdminCollectionListDto = z.infer<typeof AdminCollectionListDto>;

export const AdminCollectionCreateDto = z.object({
  title: z.string().trim().min(2, 'Назва колекції').max(120),
  slug: slugField,
  description: z.string().trim().max(500).default(''),
  isPublished: z.boolean().default(false),
});
export type AdminCollectionCreateDto = z.infer<typeof AdminCollectionCreateDto>;
export type AdminCollectionCreateInput = z.input<typeof AdminCollectionCreateDto>;

/** Часткове оновлення: форма надсилає лише те, що змінилось. */
export const AdminCollectionUpdateDto = AdminCollectionCreateDto.partial();
export type AdminCollectionUpdateDto = z.infer<typeof AdminCollectionUpdateDto>;
export type AdminCollectionUpdateInput = z.input<typeof AdminCollectionUpdateDto>;

/** Новий порядок: повний список id. Позиції розставляє сервер кроком 10. */
export const AdminCollectionReorderDto = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});
export type AdminCollectionReorderDto = z.infer<typeof AdminCollectionReorderDto>;

export const AdminCollectionAddPrintDto = z.object({
  printId: z.string().uuid(),
});
export type AdminCollectionAddPrintDto = z.infer<typeof AdminCollectionAddPrintDto>;
