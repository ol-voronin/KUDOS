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
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminLeadListQueryDto = z.infer<typeof AdminLeadListQueryDto>;

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
