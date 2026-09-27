import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ADMIN_SESSION_COOKIE, ErrorCode } from '@dt/contracts';
import { AuthService, type AdminJwtPayload } from './auth.service';
import { sessionCookieOptions } from './session-cookie';

export type AuthenticatedRequest = Request & { admin: AdminJwtPayload };

/** Guards every `/admin/*` route. Reads the session out of the httpOnly cookie. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { cookies?: Record<string, string> }>();
    const token = req.cookies?.[ADMIN_SESSION_COOKIE];

    if (!token) {
      throw new UnauthorizedException({ code: ErrorCode.UNAUTHORIZED, message: 'Потрібен вхід' });
    }

    const admin = await this.auth.verify(token);
    (req as AuthenticatedRequest).admin = admin;

    // Ковзна сесія: людина працює — кука оновлюється. Помилка продовження
    // не має валити сам запит: старий токен ще дійсний.
    const fresh = await this.auth.renew(admin).catch(() => null);
    if (fresh) {
      context.switchToHttp().getResponse<Response>().cookie(ADMIN_SESSION_COOKIE, fresh, sessionCookieOptions());
    }
    return true;
  }
}
