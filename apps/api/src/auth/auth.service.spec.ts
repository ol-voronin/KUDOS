import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { LOGIN_MAX_ATTEMPTS } from './auth.constants';

interface FakeAdmin {
  id: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

/**
 * Заглушка бази.
 *
 * Моделі лежать під `db`, як і в справжньому `PrismaService`: сирий клієнт
 * там приватний, і сервіси до нього не дістають. Заглушка повторює цю форму
 * навмисно — інакше тест проходив би на структурі, якої в проді немає.
 */
function fakePrisma(admin: FakeAdmin | null) {
  const state = admin ? { ...admin } : null;
  const adminUser = {
    findUnique: vi.fn(async () => state),
    update: vi.fn(async ({ data }: { data: Partial<FakeAdmin> }) => {
      Object.assign(state as FakeAdmin, data);
      return state;
    }),
  };
  return { db: { adminUser }, adminUser };
}

function fakeJwt() {
  return {
    signAsync: vi.fn(async (payload: unknown) => JSON.stringify(payload)),
    verifyAsync: vi.fn(async (token: string) => JSON.parse(token)),
  };
}

describe('AuthService.login', () => {
  let passwordHash: string;

  beforeEach(async () => {
    passwordHash = await argon2.hash('correct-horse-battery-staple');
  });

  it('видає токен на правильний пароль і скидає лічильник спроб', async () => {
    const prisma = fakePrisma({
      id: 'admin-1', email: 'me@dt.local', passwordHash,
      isActive: true, failedLoginAttempts: 2, lockedUntil: null,
    });
    const service = new AuthService(prisma as never, fakeJwt() as never);

    const result = await service.login('me@dt.local', 'correct-horse-battery-staple');

    expect(result.email).toBe('me@dt.local');
    expect(prisma.adminUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ failedLoginAttempts: 0 }) }),
    );
  });

  it('відхиляє невірний пароль без розкриття причини', async () => {
    const prisma = fakePrisma({
      id: 'admin-1', email: 'me@dt.local', passwordHash,
      isActive: true, failedLoginAttempts: 0, lockedUntil: null,
    });
    const service = new AuthService(prisma as never, fakeJwt() as never);

    await expect(service.login('me@dt.local', 'wrong')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('відхиляє неіснуючий email тією самою помилкою', async () => {
    const prisma = fakePrisma(null);
    const service = new AuthService(prisma as never, fakeJwt() as never);

    await expect(service.login('nobody@dt.local', 'whatever1')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('блокує акаунт після граничної кількості невдалих спроб', async () => {
    const prisma = fakePrisma({
      id: 'admin-1', email: 'me@dt.local', passwordHash,
      isActive: true, failedLoginAttempts: LOGIN_MAX_ATTEMPTS - 1, lockedUntil: null,
    });
    const service = new AuthService(prisma as never, fakeJwt() as never);

    await expect(service.login('me@dt.local', 'wrong')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.adminUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lockedUntil: expect.any(Date) }) }),
    );
  });

  it('відхиляє вхід, поки акаунт заблокований, навіть з правильним паролем', async () => {
    const prisma = fakePrisma({
      id: 'admin-1', email: 'me@dt.local', passwordHash,
      isActive: true, failedLoginAttempts: LOGIN_MAX_ATTEMPTS,
      lockedUntil: new Date(Date.now() + 60_000),
    });
    const service = new AuthService(prisma as never, fakeJwt() as never);

    await expect(service.login('me@dt.local', 'correct-horse-battery-staple'))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('відхиляє деактивований акаунт', async () => {
    const prisma = fakePrisma({
      id: 'admin-1', email: 'me@dt.local', passwordHash,
      isActive: false, failedLoginAttempts: 0, lockedUntil: null,
    });
    const service = new AuthService(prisma as never, fakeJwt() as never);

    await expect(service.login('me@dt.local', 'correct-horse-battery-staple'))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.verify', () => {
  it('розшифровує валідний токен', async () => {
    const service = new AuthService(fakePrisma(null) as never, fakeJwt() as never);
    const payload = { sub: 'admin-1', email: 'me@dt.local' };

    await expect(service.verify(JSON.stringify(payload))).resolves.toEqual(payload);
  });

  it('відхиляє зіпсований токен', async () => {
    const service = new AuthService(fakePrisma(null) as never, fakeJwt() as never);

    await expect(service.verify('not-json')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.renew', () => {
  const service = new AuthService(fakePrisma(null) as never, fakeJwt() as never);
  const now = 2_000_000_000;
  const base = { sub: 'a1', email: 'a@b.c' };

  it('не чіпає свіжий токен — менше 10 хвилин', async () => {
    expect(await service.renew({ ...base, iat: now - 60, authAt: now - 60 }, now)).toBeNull();
  });

  it('перевидає токен після 10 хвилин і зберігає момент входу', async () => {
    const token = await service.renew({ ...base, iat: now - 700, authAt: now - 5000 }, now);
    expect(token).not.toBeNull();
    expect(JSON.parse(token!)).toEqual({ ...base, authAt: now - 5000 });
  });

  it('не продовжує сесію, старшу за 30 днів від входу', async () => {
    expect(await service.renew({ ...base, iat: now - 700, authAt: now - 30 * 24 * 3600 }, now)).toBeNull();
  });

  it('старі токени без authAt рахує від iat', async () => {
    const token = await service.renew({ ...base, iat: now - 700 }, now);
    expect(JSON.parse(token!)).toEqual({ ...base, authAt: now - 700 });
  });
});
