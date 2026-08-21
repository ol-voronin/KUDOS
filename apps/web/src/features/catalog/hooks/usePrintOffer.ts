'use client';

import { useQuery } from '@tanstack/react-query';
import { PrintOfferDto } from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';

export function usePrintOffer(slug: string) {
  return useQuery({
    queryKey: ['print-offer', slug],
    queryFn: () => apiFetch(`/catalog/prints/${slug}`, PrintOfferDto),
    staleTime: 60_000,
  });
}
