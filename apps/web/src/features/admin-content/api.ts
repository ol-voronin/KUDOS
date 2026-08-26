import {
  AdminPageDto, AdminPageListDto,
  type AdminDraftSaveDto, type AdminPageCreateDto, type AdminPageUpdateDto,
  type AdminPageTermsDto,
} from '@dt/contracts';
import { z } from 'zod';
import { apiFetch } from '@/lib/api-client';

const BASE = '/admin/content/pages';

export function listPages(): Promise<AdminPageListDto> {
  return apiFetch(BASE, AdminPageListDto);
}

export function getPage(id: string): Promise<AdminPageDto> {
  return apiFetch(`${BASE}/${id}`, AdminPageDto);
}

export function createPage(dto: AdminPageCreateDto): Promise<AdminPageDto> {
  return apiFetch(BASE, AdminPageDto, { method: 'POST', body: JSON.stringify(dto) });
}

export function updatePage(id: string, dto: AdminPageUpdateDto): Promise<AdminPageDto> {
  return apiFetch(`${BASE}/${id}`, AdminPageDto, { method: 'PATCH', body: JSON.stringify(dto) });
}

export function saveDraft(id: string, dto: AdminDraftSaveDto): Promise<AdminPageDto> {
  return apiFetch(`${BASE}/${id}/draft`, AdminPageDto, { method: 'PATCH', body: JSON.stringify(dto) });
}

export function publishPage(id: string): Promise<AdminPageDto> {
  return apiFetch(`${BASE}/${id}/publish`, AdminPageDto, { method: 'POST' });
}

export function unpublishPage(id: string): Promise<AdminPageDto> {
  return apiFetch(`${BASE}/${id}/unpublish`, AdminPageDto, { method: 'POST' });
}

export function restoreVersion(id: string, versionId: string): Promise<AdminPageDto> {
  return apiFetch(`${BASE}/${id}/restore/${versionId}`, AdminPageDto, { method: 'POST' });
}

export function deletePage(id: string): Promise<{ ok: true }> {
  return apiFetch(`${BASE}/${id}`, z.object({ ok: z.literal(true) }), { method: 'DELETE' });
}

export function setPageTerms(id: string, dto: AdminPageTermsDto): Promise<AdminPageDto> {
  return apiFetch(`${BASE}/${id}/terms`, AdminPageDto, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}
