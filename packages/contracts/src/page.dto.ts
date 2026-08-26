import { z } from 'zod';
import { BlockList } from './blocks.dto';
import { Locale, PageKind } from './enums';

const Slug = z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'kebab-case slug');

/**
 * Порода або колекція, до якої привʼязано матеріал.
 *
 * Назва їде разом зі slug навмисно: інакше стрічка матеріалів мусила б
 * додатково тягнути довідник порід, щоб намалювати підпис.
 */
export const LinkedTerm = z.object({
  slug: Slug,
  name: z.string().min(1),
});
export type LinkedTerm = z.infer<typeof LinkedTerm>;

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
  /** Коли сторінку востаннє перевидали. Для `dateModified` у розмітці статті. */
  updatedAt: z.string().datetime(),
  /**
   * Скільки хвилин читати. Рахує сервер із самих блоків.
   *
   * Не поле в базі: редактор його не заповнить чесно, а якщо заповнить — воно
   * розійдеться з текстом на першій же правці. Похідне від вмісту має
   * рахуватися з вмісту.
   */
  readingMinutes: z.number().int().min(1),
  /** Породи й колекції, до яких привʼязано матеріал. Порожньо для звичайної сторінки. */
  breeds: z.array(LinkedTerm),
  collections: z.array(LinkedTerm),
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
  readingMinutes: z.number().int().min(1),
  breeds: z.array(LinkedTerm),
  collections: z.array(LinkedTerm),
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
