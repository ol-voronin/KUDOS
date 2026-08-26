import {
  AdminPriceRulesDto, PriceBreakdownDto,
  type DiscountCreateDto, type DiscountUpdateDto,
  type PriceModifierCreateDto, type PriceModifierUpdateDto, type PriceQuoteRequestDto,
} from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';

export function getPriceRules(): Promise<AdminPriceRulesDto> {
  return apiFetch('/admin/price-rules', AdminPriceRulesDto);
}

export function createModifier(dto: PriceModifierCreateDto): Promise<AdminPriceRulesDto> {
  return apiFetch('/admin/price-rules/modifiers', AdminPriceRulesDto, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function updateModifier(id: string, dto: PriceModifierUpdateDto): Promise<AdminPriceRulesDto> {
  return apiFetch(`/admin/price-rules/modifiers/${id}`, AdminPriceRulesDto, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export function deleteModifier(id: string): Promise<AdminPriceRulesDto> {
  return apiFetch(`/admin/price-rules/modifiers/${id}`, AdminPriceRulesDto, { method: 'DELETE' });
}

export function createDiscount(dto: DiscountCreateDto): Promise<AdminPriceRulesDto> {
  return apiFetch('/admin/price-rules/discounts', AdminPriceRulesDto, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function updateDiscount(id: string, dto: DiscountUpdateDto): Promise<AdminPriceRulesDto> {
  return apiFetch(`/admin/price-rules/discounts/${id}`, AdminPriceRulesDto, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export function deleteDiscount(id: string): Promise<AdminPriceRulesDto> {
  return apiFetch(`/admin/price-rules/discounts/${id}`, AdminPriceRulesDto, { method: 'DELETE' });
}

export function quotePrice(dto: PriceQuoteRequestDto): Promise<PriceBreakdownDto> {
  return apiFetch('/admin/price-rules/quote', PriceBreakdownDto, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}
