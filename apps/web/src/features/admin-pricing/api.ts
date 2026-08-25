import { AdminPricingDto, type AdminGarmentUpdateDto, type AdminPrintPriceUpdateDto } from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';

export function getPricing(): Promise<AdminPricingDto> {
  return apiFetch('/admin/pricing', AdminPricingDto);
}

export function updateGarment(id: string, dto: AdminGarmentUpdateDto): Promise<AdminPricingDto> {
  return apiFetch(`/admin/pricing/garments/${id}`, AdminPricingDto, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export function updatePrintPrices(dto: AdminPrintPriceUpdateDto): Promise<AdminPricingDto> {
  return apiFetch('/admin/pricing/print-prices', AdminPricingDto, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}
