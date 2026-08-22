'use client';

import { useQuery } from '@tanstack/react-query';
import { PrintListDto } from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';

export function usePrintList(perPage = 8) {
  return useQuery({
    queryKey: ['print-list', perPage],
    queryFn: () => apiFetch(`/catalog/prints?page=1&perPage=${perPage}`, PrintListDto),
    staleTime: 60_000,
  });
}
