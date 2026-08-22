'use client';

import { useMutation } from '@tanstack/react-query';
import { ReadyPrintCheckoutResponseDto, type ReadyPrintCheckoutRequestDto } from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';

/**
 * Fires the READY_PRINT checkout: creates the order, opens a Monobank
 * invoice, and hands back the page to redirect the browser to. There is no
 * cart step — clicking "Оплатити" is the whole flow.
 */
export function useCheckoutReadyPrint() {
  return useMutation({
    mutationFn: (body: ReadyPrintCheckoutRequestDto) =>
      apiFetch('/checkout/ready-print', ReadyPrintCheckoutResponseDto, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}
