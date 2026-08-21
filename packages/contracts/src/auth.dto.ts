import { z } from 'zod';

/** Name of the httpOnly cookie carrying the admin session JWT. Shared so the
 * web app's server components can look for it without hardcoding the string. */
export const ADMIN_SESSION_COOKIE = 'dt_admin_session';

/** Admin sign-in. No self-registration — accounts are created by a CLI script. */
export const LoginRequestDto = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});
export type LoginRequestDto = z.infer<typeof LoginRequestDto>;

/** What `/auth/me` returns. The session token itself lives only in the httpOnly cookie. */
export const AdminSessionDto = z.object({
  email: z.string().email(),
});
export type AdminSessionDto = z.infer<typeof AdminSessionDto>;

/** Shape of `/auth/login` and `/auth/logout` responses — the token travels as a cookie, not in the body. */
export const AuthOkDto = z.object({ ok: z.literal(true) });
export type AuthOkDto = z.infer<typeof AuthOkDto>;
