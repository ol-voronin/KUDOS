import { z } from 'zod';

/** Формати, які приймає медіатека. Той самий перелік, що й для фото принтів. */
export const MEDIA_CONTENT_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const;
export type MediaContentType = (typeof MEDIA_CONTENT_TYPES)[number];

export const MediaAssetDto = z.object({
  id: z.string().uuid(),
  url: z.string().min(1),
  pathname: z.string().min(1),
  filename: z.string(),
  mimeType: z.string(),
  bytes: z.number().int().nonnegative(),
  alt: z.string(),
  createdAt: z.string().datetime(),
});
export type MediaAssetDto = z.infer<typeof MediaAssetDto>;

export const MediaListDto = z.object({
  items: z.array(MediaAssetDto),
  total: z.number().int().nonnegative(),
});
export type MediaListDto = z.infer<typeof MediaListDto>;

/** Реєстрація файлу, який уже лежить у сховищі. */
export const MediaCreateDto = z.object({
  url: z.string().min(1).max(1000),
  pathname: z.string().min(1).max(500),
  filename: z.string().max(200).default(''),
  mimeType: z.enum(MEDIA_CONTENT_TYPES),
  bytes: z.number().int().positive(),
  alt: z.string().max(300).default(''),
});
export type MediaCreateDto = z.infer<typeof MediaCreateDto>;

export const MediaUpdateDto = z.object({
  alt: z.string().max(300),
});
export type MediaUpdateDto = z.infer<typeof MediaUpdateDto>;
