import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';

/**
 * Health-check. Потрібен хостингу, щоб знати, чи піднявся застосунок, і чи
 * не час його перезапустити.
 *
 * Перевіряє не лише «процес живий», а й «база відповідає»: застосунок, що
 * підвівся без доступу до БД, для балансувальника виглядав би здоровим, а на
 * кожен реальний запит віддавав би помилку.
 *
 * Плюс показує останню накочену міграцію. Це коштує один запит, а економлює
 * коло листування: «задеплоїли код, забули накотити міграцію» дає 500 у
 * випадкових місцях без жодної підказки, що саме не так. Тепер видно одразу.
 *
 * Без ліміту запитів: health опитується щохвилини, і глушити його —
 * це вимикати моніторинг.
 */
@ApiTags('health')
@Controller({ path: 'health', version: '1' })
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthDto> {
    const database = await this.prisma.$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);

    if (!database) return { status: 'degraded', database: false };

    const migrations = await this.lastMigration();
    return {
      status: migrations.pending > 0 ? 'degraded' : 'ok',
      database: true,
      ...migrations,
    };
  }

  /**
   * Остання успішно накочена міграція й кількість незавершених.
   *
   * `_prisma_migrations` — службова таблиця самої Prisma. Читаємо її напряму,
   * бо в схемі її немає й у клієнті вона не представлена.
   */
  private async lastMigration(): Promise<{ migration: string | null; applied: number; pending: number }> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
        SELECT migration_name, finished_at
        FROM "_prisma_migrations"
        ORDER BY started_at DESC
      `;
      const finished = rows.filter((r) => r.finished_at !== null);
      return {
        migration: finished[0]?.migration_name ?? null,
        applied: finished.length,
        pending: rows.length - finished.length,
      };
    } catch {
      // Таблиці немає — базу жодного разу не мігрували.
      return { migration: null, applied: 0, pending: 0 };
    }
  }
}

interface HealthDto {
  status: 'ok' | 'degraded';
  database: boolean;
  /** Назва останньої накоченої міграції, напр. `20260824120000_print_images`. */
  migration?: string | null;
  applied?: number;
  pending?: number;
}
