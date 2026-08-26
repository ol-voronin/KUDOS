import {
  Injectable, Logger, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { ErrorCode } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { LOGIN_LOCKOUT_MS, LOGIN_MAX_ATTEMPTS } from './auth.constants';

export interface AdminJwtPayload {
  sub: string;
  email: string;
}

function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({
    code: ErrorCode.INVALID_CREDENTIALS,
    message: 'Невірний email або пароль',
  });
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Одна помилка на всі причини відмови (нема юзера, неактивний, заблокований,
   * невірний пароль) — інакше форма входу видає, які email існують в базі.
   */
  async login(email: string, password: string): Promise<{ token: string; email: string }> {
    const normalisedEmail = email.trim().toLowerCase();
    const admin = await this.prisma.db.adminUser.findUnique({ where: { email: normalisedEmail } });

    if (!admin || !admin.isActive) {
      // Хешуємо навіть коли юзера нема — щоб відповідь не приходила швидше
      // просто через відсутність рядка в базі (тайминг-атака на enumeration).
      await argon2.hash(password).catch(() => undefined);
      throw invalidCredentials();
    }

    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      this.logger.warn(`Login blocked (locked): ${normalisedEmail}`);
      throw invalidCredentials();
    }

    const passwordOk = await argon2.verify(admin.passwordHash, password).catch(() => false);

    if (!passwordOk) {
      const attempts = admin.failedLoginAttempts + 1;
      const locked = attempts >= LOGIN_MAX_ATTEMPTS;
      await this.prisma.db.adminUser.update({
        where: { id: admin.id },
        data: {
          failedLoginAttempts: attempts,
          ...(locked ? { lockedUntil: new Date(Date.now() + LOGIN_LOCKOUT_MS) } : {}),
        },
      });
      if (locked) {
        this.logger.warn(`Account locked after ${attempts} failed attempts: ${normalisedEmail}`);
      }
      throw invalidCredentials();
    }

    await this.prisma.db.adminUser.update({
      where: { id: admin.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const token = await this.jwt.signAsync({ sub: admin.id, email: admin.email } satisfies AdminJwtPayload);
    return { token, email: admin.email };
  }

  async verify(token: string): Promise<AdminJwtPayload> {
    try {
      return await this.jwt.verifyAsync<AdminJwtPayload>(token);
    } catch {
      throw new UnauthorizedException({ code: ErrorCode.UNAUTHORIZED, message: 'Сесія недійсна' });
    }
  }
}
