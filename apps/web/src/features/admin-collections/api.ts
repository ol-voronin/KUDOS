import {
  AdminCollectionDto, AdminCollectionListDto,
  type AdminCollectionCreateInput, type AdminCollectionUpdateInput,
} from '@dt/contracts';
import { z } from 'zod';
import { apiFetch } from '@/lib/api-client';

export function listCollections(): Promise<AdminCollectionListDto> {
  return apiFetch('/admin/collections', AdminCollectionListDto);
}

export function createCollection(dto: AdminCollectionCreateInput): Promise<AdminCollectionDto> {
  return apiFetch('/admin/collections', AdminCollectionDto, { method: 'POST', body: JSON.stringify(dto) });
}

export function updateCollection(id: string, dto: AdminCollectionUpdateInput): Promise<AdminCollectionDto> {
  return apiFetch(`/admin/collections/${id}`, AdminCollectionDto, { method: 'PATCH', body: JSON.stringify(dto) });
}

export function deleteCollection(id: string): Promise<{ ok: true }> {
  return apiFetch(`/admin/collections/${id}`, z.object({ ok: z.literal(true) }), { method: 'DELETE' });
}

export function reorderCollections(ids: string[]): Promise<AdminCollectionListDto> {
  return apiFetch('/admin/collections/reorder', AdminCollectionListDto, {
    method: 'PATCH',
    body: JSON.stringify({ ids }),
  });
}

export function addPrintsToCollection(id: string, printIds: string[]): Promise<AdminCollectionDto> {
  return apiFetch(`/admin/collections/${id}/prints`, AdminCollectionDto, {
    method: 'POST',
    body: JSON.stringify({ printIds }),
  });
}

export function removePrintFromCollection(id: string, printId: string): Promise<AdminCollectionDto> {
  return apiFetch(`/admin/collections/${id}/prints/${printId}`, AdminCollectionDto, { method: 'DELETE' });
}
