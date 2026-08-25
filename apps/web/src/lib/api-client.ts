import { ApiErrorDto } from '@dt/contracts';
/**
 * Схема тут описана структурно, а не як `ZodSchema<T>`, і це не дрібниця.
 *
 * `ZodSchema<T>` вимагає, щоб тип на вході й на виході збігався. Щойно в
 * схемі зʼявляється `.default()`, вони перестають збігатися: на вході поле
 * необовʼязкове, на виході — обовʼязкове. TypeScript тоді підбирає T за
 * входом, і виклик повертає тип, у якому половина полів `| undefined` —
 * тобто рівно те, від чого `.default()` мав захистити.
 *
 * `parse(data: unknown): T` описує лише те, що нам справді потрібно, і T
 * завжди виявляється вихідним типом.
 */
interface Parser<T> {
  parse(data: unknown): T;
}

import { BROWSER_API_URL } from './api-origin';

/** @deprecated Використовуйте BROWSER_API_URL — лишено для сумісності імпортів. */
export const BASE_URL = BROWSER_API_URL;

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
  schema: Parser<T>,
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
