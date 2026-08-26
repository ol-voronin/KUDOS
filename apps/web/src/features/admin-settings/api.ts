import {
  SiteChromeDto,
  type MenuItemCreateDto, type MenuItemUpdateDto, type SiteSettingsUpdateDto,
} from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';

const BASE = '/admin/settings';

export function getSettings(): Promise<SiteChromeDto> {
  return apiFetch(BASE, SiteChromeDto);
}

export function updateSettings(dto: SiteSettingsUpdateDto): Promise<SiteChromeDto> {
  return apiFetch(BASE, SiteChromeDto, { method: 'PATCH', body: JSON.stringify(dto) });
}

export function createMenuItem(dto: MenuItemCreateDto): Promise<SiteChromeDto> {
  return apiFetch(`${BASE}/menu`, SiteChromeDto, { method: 'POST', body: JSON.stringify(dto) });
}

export function updateMenuItem(id: string, dto: MenuItemUpdateDto): Promise<SiteChromeDto> {
  return apiFetch(`${BASE}/menu/${id}`, SiteChromeDto, { method: 'PATCH', body: JSON.stringify(dto) });
}

export function deleteMenuItem(id: string): Promise<SiteChromeDto> {
  return apiFetch(`${BASE}/menu/${id}`, SiteChromeDto, { method: 'DELETE' });
}
