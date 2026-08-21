import { AdminLeadDto, AdminLeadListDto, LeadStatus } from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';

export function listLeads(status?: LeadStatus, page = 1): Promise<AdminLeadListDto> {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set('status', status);
  return apiFetch(`/admin/leads?${params.toString()}`, AdminLeadListDto);
}

export function updateLeadStatus(id: string, status: LeadStatus): Promise<AdminLeadDto> {
  return apiFetch(`/admin/leads/${id}/status`, AdminLeadDto, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
