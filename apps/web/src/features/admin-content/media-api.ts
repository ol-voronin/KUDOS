import {
  MediaAssetDto, MediaListDto,
  type MediaCreateDto, type MediaUpdateDto,
} from '@dt/contracts';
import { z } from 'zod';
import { apiFetch, ApiError } from '@/lib/api-client';
import { compressImage } from '@/features/admin-prints/compress-image';

export function listMedia(): Promise<MediaListDto> {
  return apiFetch('/admin/media', MediaListDto);
}

export function updateMedia(id: string, dto: MediaUpdateDto): Promise<MediaAssetDto> {
  return apiFetch(`/admin/media/${id}`, MediaAssetDto, { method: 'PATCH', body: JSON.stringify(dto) });
}

const UploadedDto = z.object({
  url: z.string(), pathname: z.string(), filename: z.string(),
  mimeType: z.enum(['image/webp', 'image/jpeg', 'image/png']), bytes: z.number(),
});

/**
 * Завантаження в два кроки, і обидва потрібні.
 *
 * Байти йдуть у маршрут вебзастосунку — тільки в нього Vercel видав токен
 * сховища, і тільки туди їх пускає браузер: у Blob API немає CORS. Потім
 * адреса реєструється в API, який є власником даних.
 *
 * Стиснення в браузері — не оптимізація, а умова: ліміт тіла запиту у
 * Vercel 4.5 МБ, а фото з телефона важить удвічі більше.
 */
export async function uploadMedia(file: File): Promise<MediaAssetDto> {
  const { blob, filename } = await compressImage(file);

  const res = await fetch(`/admin/api/media?filename=${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { 'content-type': blob.type },
    body: blob,
  });
  const payload: unknown = await res.json();
  if (!res.ok) {
    const message = typeof payload === 'object' && payload !== null && 'message' in payload
      ? String(payload.message) : 'Сховище не прийняло файл';
    throw new ApiError(res.status, 'UPLOAD_FAILED', message);
  }

  const uploaded = UploadedDto.parse(payload);
  return apiFetch('/admin/media', MediaAssetDto, {
    method: 'POST',
    body: JSON.stringify({ ...uploaded, alt: '' } satisfies MediaCreateDto),
  });
}

/** Спершу рядок, потім файл — див. коментар у `MediaService.remove`. */
export async function deleteMedia(id: string): Promise<void> {
  const { pathname } = await apiFetch(
    `/admin/media/${id}`, z.object({ pathname: z.string() }), { method: 'DELETE' },
  );
  await fetch(`/admin/api/media?pathname=${encodeURIComponent(pathname)}`, { method: 'DELETE' });
}
