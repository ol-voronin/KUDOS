import { z } from 'zod';
import type { CustomRequestCreateDto } from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';

const CustomRequestCreatedDto = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
});

export function createCustomRequest(input: CustomRequestCreateDto) {
  return apiFetch('/custom-requests', CustomRequestCreatedDto, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
