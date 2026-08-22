import { AdminLeadDetailDto, AdminLeadDto, AdminLeadListDto, LeadStatus } from '@dt/contracts';
import { apiFetch, BASE_URL } from '@/lib/api-client';

export function listLeads(status?: LeadStatus, page = 1, phone?: string): Promise<AdminLeadListDto> {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set('status', status);
  if (phone) params.set('phone', phone);
  return apiFetch(`/admin/leads?${params.toString()}`, AdminLeadListDto);
}

export function updateLeadStatus(id: string, status: LeadStatus): Promise<AdminLeadDto> {
  return apiFetch(`/admin/leads/${id}/status`, AdminLeadDto, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function getLeadDetail(id: string): Promise<AdminLeadDetailDto> {
  return apiFetch(`/admin/leads/${id}`, AdminLeadDetailDto);
}

export function resendTelegram(id: string): Promise<AdminLeadDto> {
  return apiFetch(`/admin/leads/${id}/resend-telegram`, AdminLeadDto, { method: 'POST' });
}

/** Plain download link, not a fetch — the httpOnly cookie rides along on navigation. */
export function leadsExportUrl(status?: LeadStatus, phone?: string): string {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (phone) params.set('phone', phone);
  const query = params.toString();
  return `${BASE_URL}/admin/leads/export/csv${query ? `?${query}` : ''}`;
}

