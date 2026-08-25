import { z } from 'zod';

/**
 * The two supply lines. This is deliberately NOT a navigation axis on the
 * storefront — nobody shops for "a Native Spirit t-shirt". It is a property of
 * the garment that drives sizes, colours, lead time and copy.
 */
export const ProductLine = z.enum(['OWN_PRODUCTION', 'NATIVE_SPIRIT']);
export type ProductLine = z.infer<typeof ProductLine>;

/** Cut/model families. Drives the size schema and the size labels. */
export const GarmentFit = z.enum([
  'CLASSIC',        // прямий крій
  'OVERSIZE',       // real оверсайз
  'OVERSIZE_WOMEN', // вкорочений жіночий оверсайз
  'COMFORT',        // модель Комфорт (власне виробництво, верх)
  'HYBRID',         // гібрид світшот-футболка / худі-футболка
  'KIDS',
]);
export type GarmentFit = z.infer<typeof GarmentFit>;

export const GarmentType = z.enum([
  'TSHIRT', 'SWEATSHIRT', 'HOODIE', 'ZIP_HOODIE', 'JOGGERS', 'TOTE_BAG',
]);
export type GarmentType = z.infer<typeof GarmentType>;

/**
 * Availability is the single most important field in the catalogue.
 *
 * Own production guarantees exactly one colour in stock (black); everything
 * else is "we will sew it, but delivery from another city takes longer".
 * Encoding that as data is what stops the shop selling something it cannot
 * ship. See `isPurchasable` in the pricing domain service.
 */
export const VariantAvailability = z.enum([
  'IN_STOCK',       // physically on the shelf, ships within the standard window
  'MADE_TO_ORDER',  // will be produced/ordered; REQUIRES leadTimeDays
  'UNAVAILABLE',    // visible for reference, cannot be bought
]);
export type VariantAvailability = z.infer<typeof VariantAvailability>;

/** Print price depends on the print size tier, not on the print method. */
export const PrintSizeTier = z.enum(['MINI', 'MEDIUM', 'MAXI']);
export type PrintSizeTier = z.infer<typeof PrintSizeTier>;

/** Both methods work on both lines — this affects production, not the price. */
export const PrintMethod = z.enum(['DTF', 'DTG']);
export type PrintMethod = z.infer<typeof PrintMethod>;

/** The three revenue streams. They are NOT the same funnel. */
export const OrderStream = z.enum([
  'READY_PRINT',   // catalogue -> cart -> paid in two minutes
  'CUSTOMISATION', // ready print, swapped dog or text -> cart, then agreement
  'FROM_ZERO',     // brief -> quote -> deposit -> ~16h of design -> approval
]);
export type OrderStream = z.infer<typeof OrderStream>;

export const OrderStatus = z.enum([
  'PENDING_PAYMENT', 'PAID', 'IN_PRODUCTION', 'SHIPPED', 'COMPLETED', 'CANCELLED',
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

/** Mirrors Monobank's invoice status field — see apps/api payments module. */
export const PaymentStatus = z.enum([
  'CREATED', 'PROCESSING', 'HOLD', 'SUCCESS', 'FAILURE', 'REVERSED', 'EXPIRED',
]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

/** DEBIT captures immediately; HOLD blocks funds until an explicit finalize. */
export const PaymentType = z.enum(['DEBIT', 'HOLD']);
export type PaymentType = z.infer<typeof PaymentType>;

export const CustomRequestStatus = z.enum([
  'SUBMITTED', 'QUOTED', 'DEPOSIT_PAID', 'IN_DESIGN',
  'AWAITING_APPROVAL', 'APPROVED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED',
]);
export type CustomRequestStatus = z.infer<typeof CustomRequestStatus>;

/** Measurement rows differ per garment: 2 rows, 3 rows, or waist/hip/length. */
export const MeasurementKey = z.enum([
  'WIDTH', 'LENGTH', 'SLEEVE', 'WAIST', 'HIP',
]);
export type MeasurementKey = z.infer<typeof MeasurementKey>;

/** Where a lead sits in the admin's follow-up workflow. */
export const LeadStatus = z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'LOST']);
export type LeadStatus = z.infer<typeof LeadStatus>;
