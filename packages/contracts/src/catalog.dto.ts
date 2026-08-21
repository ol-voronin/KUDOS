import { z } from 'zod';
import {
  GarmentFit, GarmentType, MeasurementKey, PrintSizeTier, ProductLine,
  VariantAvailability,
} from './enums';

const Slug = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'kebab-case slug');
const MinorAmount = z.number().int().nonnegative();

export const ColourDto = z.object({
  id: z.string().uuid(),
  /** Human name. Native Spirit has these; own production has only numbers. */
  name: z.string().min(1),
  /** Supplier's own code — "38", "NS-Aquamarine". Kept for the workshop. */
  supplierCode: z.string().nullable(),
  /** #RRGGBB for the swatch. Null means "we have not digitised it yet". */
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  imageUrl: z.string().url().nullable(),
});
export type ColourDto = z.infer<typeof ColourDto>;

export const SizeMeasurementDto = z.object({
  key: MeasurementKey,
  /** Centimetres. Stored as a string range for values like "66-76". */
  value: z.string().min(1),
});

export const SizeDto = z.object({
  id: z.string().uuid(),
  /** As printed on the size chart: "XS", "XS/S", "116", "98-104". */
  label: z.string().min(1),
  position: z.number().int().nonnegative(),
  measurements: z.array(SizeMeasurementDto),
});
export type SizeDto = z.infer<typeof SizeDto>;

export const FabricDto = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  /** g/m². One number, not a range — pick it and put it here. */
  weightGsm: z.number().int().positive(),
  composition: z.string().min(1),
  origin: z.string().nullable(),
});
export type FabricDto = z.infer<typeof FabricDto>;

export const GarmentDto = z.object({
  id: z.string().uuid(),
  slug: Slug,
  line: ProductLine,
  type: GarmentType,
  fit: GarmentFit,
  name: z.string().min(1),
  /** Own production can shorten the garment. No blank can. Real selling point. */
  lengthAdjustable: z.boolean(),
  basePriceMinor: MinorAmount,
  fabrics: z.array(FabricDto).min(1),
  sizes: z.array(SizeDto).min(1),
});
export type GarmentDto = z.infer<typeof GarmentDto>;

export const VariantDto = z.object({
  id: z.string().uuid(),
  sku: z.string().min(1),
  garmentId: z.string().uuid(),
  fabricId: z.string().uuid(),
  colourId: z.string().uuid(),
  sizeId: z.string().uuid(),
  availability: VariantAvailability,
  /** Required when availability is MADE_TO_ORDER; enforced by refinement. */
  leadTimeDays: z.number().int().positive().nullable(),
  /** Overrides garment.basePriceMinor when the variant costs more. */
  priceOverrideMinor: MinorAmount.nullable(),
}).refine(
  (v) => v.availability !== 'MADE_TO_ORDER' || v.leadTimeDays !== null,
  { message: 'MADE_TO_ORDER variants must declare leadTimeDays', path: ['leadTimeDays'] },
);
export type VariantDto = z.infer<typeof VariantDto>;

export const PrintDto = z.object({
  id: z.string().uuid(),
  slug: Slug,
  title: z.string().min(1),
  /** Drives the print price. */
  sizeTier: PrintSizeTier,
  collectionSlugs: z.array(Slug),
  breedSlugs: z.array(Slug),
  previewUrl: z.string().url(),
  isPublished: z.boolean(),
});
export type PrintDto = z.infer<typeof PrintDto>;

/** What the product page actually renders: one print, its offerable variants. */
export const PrintOfferDto = z.object({
  print: PrintDto,
  garments: z.array(GarmentDto),
  variants: z.array(VariantDto),
  colours: z.array(ColourDto),
  printPriceMinor: MinorAmount,
});
export type PrintOfferDto = z.infer<typeof PrintOfferDto>;

/** A resolved, purchasable line: garment + print + computed total. */
export const PricedOfferDto = z.object({
  variantId: z.string().uuid(),
  printId: z.string().uuid(),
  garmentPriceMinor: MinorAmount,
  printPriceMinor: MinorAmount,
  totalMinor: MinorAmount,
  purchasable: z.boolean(),
  /** Why not, in a form the UI can show verbatim. */
  blockedReason: z.string().nullable(),
  leadTimeDays: z.number().int().positive().nullable(),
});
export type PricedOfferDto = z.infer<typeof PricedOfferDto>;

export const CatalogQueryDto = z.object({
  collection: Slug.optional(),
  breed: Slug.optional(),
  garmentType: GarmentType.optional(),
  line: ProductLine.optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(60).default(24),
});
export type CatalogQueryDto = z.infer<typeof CatalogQueryDto>;
