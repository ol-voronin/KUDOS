import { ApiErrorDto } from '@dt/contracts';
import type { ZodSchema } from 'zod';

export const BASE_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, string[]>,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Every response is parsed through the same zod schema the API validates
 * against. An unexpected shape fails here, loudly, instead of surfacing three
 * components later as `undefined is not an object`.
 */
export async function apiFetch<T>(
  path: string,
  schema: ZodSchema<T>,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
  });

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const parsed = ApiErrorDto.safeParse(body);
    if (parsed.success) {
      throw new ApiError(
        parsed.data.statusCode,
        parsed.data.code,
        parsed.data.message,
        parsed.data.details,
        parsed.data.correlationId,
      );
    }
    throw new ApiError(res.status, 'INTERNAL', 'Не вдалося зв’язатися з сервером');
  }

  return schema.parse(body);
}
