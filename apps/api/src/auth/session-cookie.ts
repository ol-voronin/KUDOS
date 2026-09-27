import type { CookieOptions } from 'express';
import { ADMIN_SESSION_TTL_S } from './auth.constants';

/** Одна правда про куку сесії — і для входу, і для продовження в guard-і. */
export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_TTL_S * 1000,
  };
}
