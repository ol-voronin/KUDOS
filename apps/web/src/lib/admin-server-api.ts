import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE } from '@dt/contracts';
import { SERVER_API_URL } from './api-origin';

interface Parser<T> { parse(data: unknown): T }

/**
 * Серверне читання адмінських даних.
 *
 * Окремо від `serverFetch` через одну річ: сюди треба перекласти cookie
 * сесії. У серверному компоненті браузерні cookie не їдуть автоматично —
 * запит робить сервер, а не браузер, і без явного заголовка API поверне 401.
 *
 * Кеш вимкнено назавжди (`no-store`). Кешована чернетка — це показ старого
 * тексту в перегляді, тобто рівно те, заради чого перегляд існує.
 */
export async function adminServerFetch<T>(path: string, schema: Parser<T>): Promise<T | null> {
  const token = cookies().get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const res = await fetch(`${SERVER_API_URL}${path}`, {
    headers: {
      'content-type': 'application/json',
      cookie: `${ADMIN_SESSION_COOKIE}=${token}`,
    },
    cache: 'no-store',
  });
  if (!res.ok) return null;

  try {
    return schema.parse(await res.json());
  } catch {
    return null;
  }
}
