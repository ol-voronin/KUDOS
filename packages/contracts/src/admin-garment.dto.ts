import { z } from 'zod';
import { GarmentFit, GarmentType, PrintSizeTier, ProductLine } from './enums';

const MinorAmount = z.number().int().nonnegative();

/**
 * Ціни в адмінці.
 *
 * Причина, чому цей файл узагалі існує: базові ціни виробів засіяні
 * скриптом як заглушки. Заглушка в базі — нормально рівно доти, доки її
 * можна виправити без деплою. Без цього екрана «тимчасова ціна» живе до
 * першого замовлення за неправильною сумою.
 */
export const AdminGarmentDto = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  line: ProductLine,
  type: GarmentType,
  fit: GarmentFit,
  basePriceMinor: MinorAmount,
  isPublished: z.boolean(),
  /** Скільки кольорів і розмірів за ним стоїть — щоб було видно, що виріб живий. */
  colourCount: z.number().int().nonnegative(),
  sizeCount: z.number().int().nonnegative(),
  variantCount: z.number().int().nonnegative(),
});
export type AdminGarmentDto = z.infer<typeof AdminGarmentDto>;

export const AdminGarmentUpdateDto = z.object({
  basePriceMinor: MinorAmount.optional(),
  isPublished: z.boolean().optional(),
});
export type AdminGarmentUpdateDto = z.infer<typeof AdminGarmentUpdateDto>;

export const AdminPrintPriceDto = z.object({
  tier: PrintSizeTier,
  priceMinor: MinorAmount,
});
export type AdminPrintPriceDto = z.infer<typeof AdminPrintPriceDto>;

export const AdminPrintPriceUpdateDto = z.object({
  prices: z.array(AdminPrintPriceDto).min(1).max(3),
});
export type AdminPrintPriceUpdateDto = z.infer<typeof AdminPrintPriceUpdateDto>;

export const AdminPricingDto = z.object({
  garments: z.array(AdminGarmentDto),
  printPrices: z.array(AdminPrintPriceDto),
});
export type AdminPricingDto = z.infer<typeof AdminPricingDto>;
