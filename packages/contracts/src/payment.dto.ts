import { z } from 'zod';
import { PaymentStatus, PaymentType } from './enums';

/**
 * Admin actions on a HOLD payment: `finalize` (capture — the order shipped)
 * and `cancel` (refund — only valid once Monobank has already captured the
 * funds, i.e. `status === 'SUCCESS'`). Both accept an optional partial
 * amount; omitted means "the full held/captured amount".
 */
export const PaymentFinalizeRequestDto = z.object({
  amountMinor: z.number().int().positive().optional(),
});
export type PaymentFinalizeRequestDto = z.infer<typeof PaymentFinalizeRequestDto>;

export const PaymentCancelRequestDto = z.object({
  amountMinor: z.number().int().positive().optional(),
});
export type PaymentCancelRequestDto = z.infer<typeof PaymentCancelRequestDto>;

export const PaymentAdminDto = z.object({
  invoiceId: z.string(),
  status: PaymentStatus,
  paymentType: PaymentType,
  amountMinor: z.number().int().nonnegative(),
  holdExpiresAt: z.string().datetime().nullable(),
  finalizedAt: z.string().datetime().nullable(),
});
export type PaymentAdminDto = z.infer<typeof PaymentAdminDto>;
