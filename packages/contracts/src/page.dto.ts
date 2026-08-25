import { z } from 'zod';
import { BlockList } from './blocks.dto';
import { Locale, PageKind } from './enums';

const Slug = z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'kebab-case slug');

/**
 * Сторінка так, як її бачить відвідувач: завжди опублікована версія,
 * завжди цілком. Чернетки й історія — сутність адмінки, і в публічний
 * контракт вони не потрапляють навіть полем-ознакою.
 */
export const PageDto = z.object({
  slug: Slug,
  kind: PageKind,
  locale: Locale,
  title: z.string().min(1),
  excerpt: z.string(),
  coverUrl: z.string(),
  seo: z.object({
    /** Порожній рядок означає «взяти title сторінки» — вирішує фронт. */
    title: z.string(),
    description: z.string(),
    noindex: z.boolean(),
  }),
  publishedAt: z.string().datetime().nullable(),
  blocks: BlockList,
});
export type PageDto = z.infer<typeof PageDto>;

/** Для карток у списках матеріалів і для sitemap. */
export const PageCardDto = z.object({
  slug: Slug,
  kind: PageKind,
  title: z.string().min(1),
  excerpt: z.string(),
  coverUrl: z.string(),
  publishedAt: z.string().datetime().nullable(),
  /** Для sitemap: коли сторінку востаннє перевидали. */
  updatedAt: z.string().datetime(),
});
export type PageCardDto = z.infer<typeof PageCardDto>;

export const PageListDto = z.object({
  items: z.array(PageCardDto),
});
export type PageListDto = z.infer<typeof PageListDto>;

/** Куди вести зі старої адреси. Порожньо — редіректу немає. */
export const RedirectDto = z.object({
  toSlug: Slug,
});
export type RedirectDto = z.infer<typeof RedirectDto>;
