import {
  AdminPrintDto, AdminPrintListDto, CatalogOptionDto,
  type AdminPrintCreateDto, type AdminPrintUpdateDto, type AdminBreedCreateDto,
} from '@dt/contracts';
import { z } from 'zod';
import { apiFetch } from '@/lib/api-client';

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

export function createPrint(dto: AdminPrintCreateDto): Promise<AdminPrintDto> {
  return apiFetch('/admin/prints', AdminPrintDto, { method: 'POST', body: JSON.stringify(dto) });
}

export function updatePrint(id: string, dto: AdminPrintUpdateDto): Promise<AdminPrintDto> {
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
