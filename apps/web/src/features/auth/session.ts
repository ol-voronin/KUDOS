import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE, AdminSessionDto } from '@dt/contracts';
import { SERVER_API_URL } from '@/lib/api-origin';

/**
 * Server Component only: `next/headers` is unavailable in client code.
 * The cookie is httpOnly, so it must be forwarded to the API manually —
 * `fetch` on the server does not carry the browser's cookie jar.
 */
export async function getServerSession(): Promise<AdminSessionDto | null> {
  const token = cookies().get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const res = await fetch(`${SERVER_API_URL}/auth/me`, {
    headers: { cookie: `${ADMIN_SESSION_COOKIE}=${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;

  const parsed = AdminSessionDto.safeParse(await res.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}
