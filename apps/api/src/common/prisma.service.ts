import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { applyRuntimeMigrations } from './runtime-migrations';
import { withTenancy, type TenantClient } from './tenancy';

/**
 * Доступ до бази.
 *
 * Клас навмисно НЕ успадковує `PrismaClient`. Раніше успадковував — і тоді
 * будь-який сервіс міг написати `this.prisma.page.findMany()` і отримати
 * сторінки всіх сайтів одразу. Тепер сирий клієнт лишається приватним, а
 * назовні відкрито тільки `db` — клієнт із примусовою ізоляцією.
 *
 * Це не стилістика: різниця в тому, що обійти ізоляцію тепер не можна
 * випадково. Спроба звернутися до `this.prisma.page` не збереться взагалі —
 * помилка типів, а не тихо неправильні дані в проді.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly raw = new PrismaClient();

  /** Єдиний шлях до даних. Додає `siteId` сам — див. `tenancy.ts`. */
  readonly db: TenantClient = withTenancy(this.raw);

  async onModuleInit(): Promise<void> {
    await this.raw.$connect();
    // Тести й локальна розробка мігруються Prisma CLI; тут — лише прод/превʼю.
    if (process.env['VERCEL'] === '1') await applyRuntimeMigrations(this.raw);
  }

  async onModuleDestroy(): Promise<void> {
    await this.raw.$disconnect();
  }
}
