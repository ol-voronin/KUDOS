import { z } from 'zod';
import { GarmentType, ProductLine } from './enums';

/**
 * The brief for the "print from zero" stream.
 *
 * Every required field here exists to answer one problem the owner named
 * explicitly: clients arriving with "I don't know what I want". A catalogue
 * answers that for most people; this form answers it for the rest. Optional
 * fields are optional on purpose — do not add more required ones without
 * checking they actually change the design work.
 */
export const CustomRequestCreateDto = z.object({
  contact: z.object({
    name: z.string().min(2).max(120),
    phone: z.string().regex(/^\+380\d{9}$/, 'Формат: +380XXXXXXXXX'),
    email: z.string().email().optional(),
  }),
  dog: z.object({
    name: z.string().min(1).max(80),
    breed: z.string().min(1).max(120),
    /** Uploaded separately; these are storage keys, never raw data URLs. */
    photoKeys: z.array(z.string().min(1)).min(1, 'Потрібне хоча б одне фото').max(10),
  }),
  brief: z.object({
    mood: z.string().min(1).max(400),
    referenceUrls: z.array(z.string().url()).max(10).default([]),
    notes: z.string().max(2000).optional(),
  }),
  product: z.object({
    garmentType: GarmentType,
    preferredLine: ProductLine.optional(),
    sizeLabel: z.string().max(20).optional(),
    colourNote: z.string().max(200).optional(),
  }),
  /** Client already has artwork -> 150 UAH off. Kept explicit, not inferred. */
  customerSuppliedArtwork: z.boolean().default(false),
  deadline: z.coerce.date().optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'Потрібна згода на обробку даних' }) }),
});
export type CustomRequestCreateDto = z.infer<typeof CustomRequestCreateDto>;

export const CustomRequestQuoteDto = z.object({
  requestId: z.string().uuid(),
  garmentPriceMinor: z.number().int().nonnegative(),
  designPriceMinor: z.number().int().nonnegative(),
  printPriceMinor: z.number().int().nonnegative(),
  totalMinor: z.number().int().nonnegative(),
  includedRevisions: z.number().int().nonnegative(),
  extraRevisionPriceMinor: z.number().int().nonnegative(),
  estimatedDays: z.number().int().positive(),
  validUntil: z.coerce.date(),
});
export type CustomRequestQuoteDto = z.infer<typeof CustomRequestQuoteDto>;
