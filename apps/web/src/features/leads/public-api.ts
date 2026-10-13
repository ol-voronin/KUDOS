import { z } from 'zod';
import { apiFetch } from '@/lib/api-client';
import { attribution, hashPhone, setAdsUserData, track } from '@/features/analytics/client';
import { ga4GenerateLead } from '@/features/analytics/ga4';

const LeadCreatedDto = z.object({ ok: z.literal(true), number: z.number().int().positive() });

export interface LeadInput {
  name: string;
  phone: string;
  message?: string;
  source?: string;
  marketingConsent?: boolean;
}

/**
 * Заявка разом з атрибуцією.
 *
 * Атрибуція додається тут, а не у формі: форм чотири (головна, породна,
 * бриф, окрема сторінка), і жодна з них не має пам'ятати про рекламу.
 */
export async function createLead(input: LeadInput) {
  const created = await apiFetch('/leads', LeadCreatedDto, {
    method: 'POST',
    body: JSON.stringify({ ...input, attribution: attribution() }),
  });
  // Після успіху, а не до: подія «заявка» має означати заявку, а не спробу.
  // Телефон (хешем) — перед конверсією, для розширених конверсій Google Ads.
  setAdsUserData(await hashPhone(input.phone));
  track('lead_submitted');
  ga4GenerateLead('Форма на сторінці');
  return created;
}
