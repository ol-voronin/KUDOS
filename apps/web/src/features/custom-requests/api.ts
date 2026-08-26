import { z } from 'zod';
import type { CustomRequestCreateDto } from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';
import { track } from '@/features/analytics/client';

const CustomRequestCreatedDto = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
});

export async function createCustomRequest(input: CustomRequestCreateDto) {
  const created = await apiFetch('/custom-requests', CustomRequestCreatedDto, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  // Бриф — така сама заявка з погляду реклами: людина залишила контакт.
  // Рахувати його окремою подією означало б мати дві цифри там, де відповідь
  // одна: скільки звернень принесла кампанія.
  track('lead_submitted');
  return created;
}
