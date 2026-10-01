'use client';

import { useQuery } from '@tanstack/react-query';
import { OrderStatusPublicDto } from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';

export function useOrderStatus(orderId: string) {
  return useQuery({
    queryKey: ['order-status', orderId],
    queryFn: () => apiFetch(`/orders/${orderId}/status`, OrderStatusPublicDto),
    // Payment confirmation arrives asynchronously via webhook — poll briefly
    // so the page updates itself once Monobank confirms the invoice. A HOLD
    // is a settled state for the buyer (the capture happens days later, by
    // hand), so polling stops there.
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === 'PENDING_PAYMENT' && data.paymentStatus !== 'HOLD' ? 3000 : false;
    },
  });
}
