import { z } from 'zod';
import { OrderStatus, PrintMethod } from './enums';

/**
 * The READY_PRINT checkout: one variant, paid immediately through Monobank.
 *
 * Deliberately single-line, no cart. The storefront sells one print on one
 * garment at a time; a multi-item cart is a different, bigger feature that
 * nobody has asked for yet. CUSTOMISATION and FROM_ZERO never reach this
 * endpoint — they stay on the lead/custom-request path and get a human.
 */
export const ReadyPrintCheckoutRequestDto = z.object({
  printSlug: z.string().min(1),
  variantId: z.string().uuid(),
  printMethod: PrintMethod,
  quantity: z.number().int().min(1).max(5).default(1),
  customer: z.object({
    name: z.string().min(2).max(120),
    phone: z.string().regex(/^\+380\d{9}$/, 'Формат: +380XXXXXXXXX'),
    marketingConsent: z.boolean().default(false),
  }),
  /** Optional note, e.g. a size adjustment request. Never priced from this. */
  note: z.string().max(500).optional(),
});
export type ReadyPrintCheckoutRequestDto = z.infer<typeof ReadyPrintCheckoutRequestDto>;

export const ReadyPrintCheckoutResponseDto = z.object({
  orderId: z.string().uuid(),
  orderNumber: z.number().int().positive(),
  /** Redirect the browser here \u2014 Monobank's hosted payment page. */
  pageUrl: z.string().url(),
});
export type ReadyPrintCheckoutResponseDto = z.infer<typeof ReadyPrintCheckoutResponseDto>;

/**
 * What the "thank you" page is allowed to know: no contact details, no line
 * items, just enough to tell the customer what happened to their money.
 */
export const OrderStatusPublicDto = z.object({
  orderNumber: z.number().int().positive(),
  status: OrderStatus,
  totalMinor: z.number().int().nonnegative(),
});
export type OrderStatusPublicDto = z.infer<typeof OrderStatusPublicDto>;
