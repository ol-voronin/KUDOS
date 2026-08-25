import {
  AdminPrintDto, AdminPrintListDto, CatalogOptionDto,
  type AdminPrintCreateInput, type AdminPrintUpdateInput, type AdminBreedCreateDto,
} from '@dt/contracts';
import { z } from 'zod';
import { ApiErrorDto } from '@dt/contracts';
import { apiFetch, ApiError } from '@/lib/api-client';
import { BROWSER_API_URL } from '@/lib/api-origin';

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
 * Завантаження фото: тіло запиту — самі байти, назва файлу в параметрі.
 *
 * Не через `apiFetch`, бо той примусово ставить `content-type: application/json`
 * — а тут саме content-type файлу вирішує, як сервер його прийме.
 */
export async function addPrintImage(
  printId: string,
  file: Blob,
  filename: string,
): Promise<AdminPrintDto> {
  const query = new URLSearchParams({ filename });
  const res = await fetch(`${BROWSER_API_URL}/admin/prints/${printId}/images?${query.toString()}`, {
    method: 'POST',
    headers: { 'content-type': file.type },
    body: file,
    credentials: 'include',
  });

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ApiErrorDto.safeParse(body);
    throw parsed.success
      ? new ApiError(parsed.data.statusCode, parsed.data.code, parsed.data.message)
      : new ApiError(res.status, 'INTERNAL', 'Не вдалося завантажити фото');
  }
  return AdminPrintDto.parse(body);
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
