import {
  Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards, UsePipes,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Response } from 'express';
import { ADMIN_SESSION_COOKIE, AdminSessionDto, AuthOkDto, LoginRequestDto } from '@dt/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { CurrentAdmin } from './current-admin.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AdminJwtPayload } from './auth.service';

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Number(process.env['JWT_ACCESS_TTL'] ?? 900) * 1000,
  };
}

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 900_000, limit: 10 } })
  @UsePipes(new ZodValidationPipe(LoginRequestDto))
  async login(
    @Body() dto: LoginRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthOkDto> {
    const { token } = await this.auth.login(dto.email, dto.password);
    res.cookie(ADMIN_SESSION_COOKIE, token, cookieOptions());
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): AuthOkDto {
    res.clearCookie(ADMIN_SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentAdmin() admin: AdminJwtPayload): AdminSessionDto {
    return { email: admin.email };
  }
}
