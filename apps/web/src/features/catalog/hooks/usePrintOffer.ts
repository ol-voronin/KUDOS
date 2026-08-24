'use client';

import { useQuery } from '@tanstack/react-query';
import { PrintOfferDto } from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';

/**
 * `initialData` приходить із серверного компонента сторінки.
 *
 * Без нього картка товару рендериться порожньою й наповнюється вже в
 * браузері — тобто в HTML, який отримує пошуковик, немає ні назви, ні ціни,
 * ні наявності. З ним розмітка повна одразу, а react-query лишається для
 * оновлення й для інтерактиву.
 */
export function usePrintOffer(slug: string, initialData?: PrintOfferDto) {
  return useQuery({
    queryKey: ['print-offer', slug],
    queryFn: () => apiFetch(`/catalog/prints/${slug}`, PrintOfferDto),
    staleTime: 60_000,
    ...(initialData ? { initialData } : {}),
  });
}
