import { z } from 'zod';
import { BlockList } from './blocks.dto';
import { PageKind, PageVersionStatus } from './enums';

const Slug = z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'kebab-case slug');

/**
 * Адреси, які вже зайняті статичними маршрутами сайту.
 *
 * Перевіряти це на боці API, а не сподіватися на Next: у Next статичний
 * маршрут виграє в динамічного мовчки, тож сторінка зі slug `prints`
 * створилася б, опублікувалася б і просто ніколи не відкрилася. Автор
 * шукав би помилку в блоках, а її там немає.
 */
export const RESERVED_SLUGS = [
  'admin', 'api', 'prints', 'collections', 'breeds', 'vyroby', 'search',
  'order', 'zayavka', 'sitemap.xml', 'robots.txt', '_next',
] as const;

export const AdminVersionSummaryDto = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  status: PageVersionStatus,
  note: z.string(),
  authorEmail: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type AdminVersionSummaryDto = z.infer<typeof AdminVersionSummaryDto>;

export const AdminVersionDto = AdminVersionSummaryDto.extend({
  title: z.string(),
  excerpt: z.string(),
  coverUrl: z.string(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  noindex: z.boolean(),
  blocks: BlockList,
});
export type AdminVersionDto = z.infer<typeof AdminVersionDto>;

export const AdminPageSummaryDto = z.object({
  id: z.string().uuid(),
  slug: Slug,
  kind: PageKind,
  isSystem: z.boolean(),
  title: z.string(),
  /** Є незбережена в публікацію робота. */
  hasDraft: z.boolean(),
  isPublished: z.boolean(),
  publishedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
  /** Стан кешу сайту: коли востаннє перечитав і що зламалося. */
  revalidatedAt: z.string().datetime().nullable(),
  revalidateError: z.string(),
});
export type AdminPageSummaryDto = z.infer<typeof AdminPageSummaryDto>;

export const AdminPageDto = AdminPageSummaryDto.extend({
  draft: AdminVersionDto.nullable(),
  published: AdminVersionDto.nullable(),
  history: z.array(AdminVersionSummaryDto),
});
export type AdminPageDto = z.infer<typeof AdminPageDto>;

export const AdminPageListDto = z.object({ items: z.array(AdminPageSummaryDto) });
export type AdminPageListDto = z.infer<typeof AdminPageListDto>;

export const AdminPageCreateDto = z.object({
  slug: Slug.refine(
    (v) => !(RESERVED_SLUGS as readonly string[]).includes(v),
    { message: 'ця адреса зайнята розділом сайту' },
  ),
  kind: PageKind.default('PAGE'),
  title: z.string().trim().min(1).max(200),
});
export type AdminPageCreateDto = z.infer<typeof AdminPageCreateDto>;

/** Властивості самої сторінки, а не її вмісту. Змінюються рідко. */
export const AdminPageUpdateDto = z.object({
  slug: Slug.refine(
    (v) => !(RESERVED_SLUGS as readonly string[]).includes(v),
    { message: 'ця адреса зайнята розділом сайту' },
  ).optional(),
  position: z.number().int().min(0).max(999).optional(),
});
export type AdminPageUpdateDto = z.infer<typeof AdminPageUpdateDto>;

/** Збереження чернетки. Приходить цілком — часткове збереження блоків не має сенсу. */
export const AdminDraftSaveDto = z.object({
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().max(400).default(''),
  coverUrl: z.string().max(1000).default(''),
  seoTitle: z.string().max(200).default(''),
  seoDescription: z.string().max(400).default(''),
  noindex: z.boolean().default(false),
  blocks: BlockList,
  note: z.string().max(200).default(''),
});
export type AdminDraftSaveDto = z.infer<typeof AdminDraftSaveDto>;
