'use client';

import { useQuery } from '@tanstack/react-query';
import { GarmentOfferDto } from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';

/**
 * Той самий прийом, що в usePrintOffer: `initialData` приходить із серверного
 * компонента, тож HTML для пошуковика повний одразу, а react-query лишається
 * для оновлення й інтерактиву.
 */
export function useGarmentOffer(slug: string, initialData?: GarmentOfferDto) {
  return useQuery({
    queryKey: ['garment-offer', slug],
    queryFn: () => apiFetch(`/catalog/garments/${slug}`, GarmentOfferDto),
    staleTime: 60_000,
    ...(initialData ? { initialData } : {}),
  });
}
