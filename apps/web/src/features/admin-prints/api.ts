import {
  AdminPrintDto, AdminPrintListDto, CatalogOptionDto,
  type AdminPrintCreateInput, type AdminPrintImageCreateDto, type AdminPrintUpdateInput,
  type AdminBreedCreateDto,
} from '@dt/contracts';
import { z } from 'zod';
import { apiFetch, ApiError } from '@/lib/api-client';

export interface PrintFilters {
  q?: string;
  published?: 'true' | 'false';
  page?: number;
}

export function listPrints(filters: PrintFilters = {}): Promise<AdminPrintListDto> {
  const params = new URLSearchParams({ page: String(filters.page ?? 1) });
  if (filters.q) params.set('q', filters.q);
  if (filters.published) params.set('published', filters.published);
  return apiFetch(`/admin/prints?${params.toString()}`, AdminPrintListDto);
}

export function getPrint(id: string): Promise<AdminPrintDto> {
  return apiFetch(`/admin/prints/${id}`, AdminPrintDto);
}

export function createPrint(dto: AdminPrintCreateInput): Promise<AdminPrintDto> {
  return apiFetch('/admin/prints', AdminPrintDto, { method: 'POST', body: JSON.stringify(dto) });
}

export function updatePrint(id: string, dto: AdminPrintUpdateInput): Promise<AdminPrintDto> {
  return apiFetch(`/admin/prints/${id}`, AdminPrintDto, { method: 'PATCH', body: JSON.stringify(dto) });
}

export function deletePrint(id: string): Promise<{ ok: true }> {
  return apiFetch(`/admin/prints/${id}`, z.object({ ok: z.literal(true) }), { method: 'DELETE' });
}

const OptionsDto = z.object({
  breeds: z.array(CatalogOptionDto),
  collections: z.array(CatalogOptionDto),
});

export function getPrintOptions() {
  return apiFetch('/admin/prints/options', OptionsDto);
}

export function createBreed(dto: AdminBreedCreateDto): Promise<CatalogOptionDto> {
  return apiFetch('/admin/prints/breeds', CatalogOptionDto, { method: 'POST', body: JSON.stringify(dto) });
}

// ── Фото ──────────────────────────────────────────────────────────────────
//
// Усі три ендпоїнти повертають принт цілком, а не саме фото: після зміни
// набору змінюється ще й обкладинка (`previewUrl`) і, можливо, публікація.
// Повертати частину означало б лишити форму з несвіжими даними.

/**
 * Завантаження фото — два кроки, і обидва потрібні.
 *
 *  1. Байти йдуть у маршрут вебзастосунку: тільки в нього Vercel видав
 *     `BLOB_READ_WRITE_TOKEN`. Він заливає файл у сховище серверним викликом
 *     (у Blob API немає CORS для браузера) і повертає адресу.
 *  2. Адреса реєструється в API, який лишається власником даних.
 */
export async function uploadPrintPhoto(
  slug: string,
  file: Blob,
  filename: string,
): Promise<AdminPrintImageCreateDto> {
  const query = new URLSearchParams({ slug, filename });
  const res = await fetch(`/admin/api/print-photo?${query.toString()}`, {
    method: 'POST',
    headers: { 'content-type': file.type },
    body: file,
  });

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = typeof body === 'object' && body !== null && 'message' in body
      ? String((body as { message: unknown }).message)
      : 'Не вдалося завантажити фото';
    throw new ApiError(res.status, 'INTERNAL', message);
  }
  const parsed = body as { url: string; pathname: string };
  return { url: parsed.url, pathname: parsed.pathname, alt: '' };
}

export function addPrintImage(printId: string, dto: AdminPrintImageCreateDto): Promise<AdminPrintDto> {
  return apiFetch(`/admin/prints/${printId}/images`, AdminPrintDto, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

/** Прибирає файл зі сховища. Викликається після того, як API видалив рядок. */
export async function deletePrintPhotoBlob(pathname: string): Promise<void> {
  await fetch(`/admin/api/print-photo?pathname=${encodeURIComponent(pathname)}`, { method: 'DELETE' })
    .catch(() => undefined);
}

export function removePrintImage(printId: string, imageId: string): Promise<AdminPrintDto> {
  return apiFetch(`/admin/prints/${printId}/images/${imageId}`, AdminPrintDto, { method: 'DELETE' });
}

export function reorderPrintImages(printId: string, ids: string[]): Promise<AdminPrintDto> {
  return apiFetch(`/admin/prints/${printId}/images/order`, AdminPrintDto, {
    method: 'PATCH',
    body: JSON.stringify({ ids }),
  });
}
