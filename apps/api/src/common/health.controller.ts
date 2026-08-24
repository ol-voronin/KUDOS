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
 * Без ліміту запитів: health опитується щохвилини, і глушити його —
 * це вимикати моніторинг.
 */
@ApiTags('health')
@Controller({ path: 'health', version: '1' })
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: 'ok' | 'degraded'; database: boolean }> {
    const database = await this.prisma.$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);
    return { status: database ? 'ok' : 'degraded', database };
  }
}
