import { z } from 'zod';

/** One error shape for the whole API. Clients parse this and nothing else. */
export const ApiErrorDto = z.object({
  statusCode: z.number().int(),
  code: z.string(),
  message: z.string(),
  /** Field-level messages, keyed by dotted path. */
  details: z.record(z.string(), z.array(z.string())).optional(),
  correlationId: z.string(),
});
export type ApiErrorDto = z.infer<typeof ApiErrorDto>;

export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  VARIANT_NOT_PURCHASABLE: 'VARIANT_NOT_PURCHASABLE',
  PRINT_NOT_OFFERED_ON_GARMENT: 'PRINT_NOT_OFFERED_ON_GARMENT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
