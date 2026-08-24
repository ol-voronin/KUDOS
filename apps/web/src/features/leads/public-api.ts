import { z } from 'zod';
import { apiFetch } from '@/lib/api-client';

const LeadCreatedDto = z.object({ ok: z.literal(true), number: z.number().int().positive() });

export interface LeadInput {
  name: string;
  phone: string;
  message?: string;
  source?: string;
  marketingConsent?: boolean;
}

export function createLead(input: LeadInput) {
  return apiFetch('/leads', LeadCreatedDto, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
