import { z } from 'zod';
import { LeadStatus } from './enums';

/** What the admin's "Заявки" screen renders. Same rows the Telegram bot got. */
export const AdminLeadDto = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  status: LeadStatus,
  name: z.string().min(1),
  phone: z.string().min(1),
  message: z.string().nullable(),
  source: z.string().nullable(),
  /** Null means "did not reach Telegram" — surfaced here, not only in logs. */
  telegramSentAt: z.coerce.date().nullable(),
  telegramError: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type AdminLeadDto = z.infer<typeof AdminLeadDto>;

export const AdminLeadListQueryDto = z.object({
  status: LeadStatus.optional(),
  /** Substring match against the phone digits/plus as stored — no formatting applied. */
  phone: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminLeadListQueryDto = z.infer<typeof AdminLeadListQueryDto>;

export const AdminLeadExportQueryDto = z.object({
  status: LeadStatus.optional(),
  phone: z.string().trim().min(1).optional(),
});
export type AdminLeadExportQueryDto = z.infer<typeof AdminLeadExportQueryDto>;

export const AdminLeadListDto = z.object({
  items: z.array(AdminLeadDto),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
});
export type AdminLeadListDto = z.infer<typeof AdminLeadListDto>;

export const AdminLeadStatusUpdateDto = z.object({
  status: LeadStatus,
});
export type AdminLeadStatusUpdateDto = z.infer<typeof AdminLeadStatusUpdateDto>;

/**
 * The lead detail screen. `customer` is null only for leads captured before
 * the `Customer` upsert existed — every lead created since always has one.
 * `previousLeads` is how repeat clients surface: same phone, other leads.
 */
export const AdminLeadDetailDto = AdminLeadDto.extend({
  customer: z.object({
    id: z.string().uuid(),
    name: z.string(),
    phone: z.string(),
    marketingConsent: z.boolean(),
    totalLeads: z.number().int().nonnegative(),
  }).nullable(),
  previousLeads: z.array(AdminLeadDto),
});
export type AdminLeadDetailDto = z.infer<typeof AdminLeadDetailDto>;
