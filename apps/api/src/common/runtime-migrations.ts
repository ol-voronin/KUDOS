import { Logger } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

/**
 * Адитивні міграції, які API накочує сам при старті.
 *
 * ── Навіщо ────────────────────────────────────────────────────────────
 *
 * Прод-база — Postgres за фаєрволом: функції Vercel (fra1) до неї ходять,
 * а збірка Vercel і контейнери Claude — ні (`prisma migrate deploy` у збірці
 * впав з P1001, 23.11.2026). Тож міграцію, без якої новий код не працює,
 * котить сам застосунок — тим самим зʼєднанням, яким читає дані.
 *
 * ── Правила ───────────────────────────────────────────────────────────
 *
 * Сюди — ЛИШЕ адитивне й ідемпотентне: `ADD COLUMN IF NOT EXISTS`, нова
 * таблиця `IF NOT EXISTS`. Нічого, що видаляє чи переписує дані. SQL має
 * збігатися з `prisma/migrations/<name>/migration.sql` байт у байт, а
 * `checksum` — його sha256: тоді `_prisma_migrations` виглядає так, ніби
 * міграцію накотив Prisma, і `setup-neon.sh` потім нічого не дублює.
 *
 * Паралельні холодні старти серіалізує advisory lock у транзакції.
 */
interface RuntimeMigration {
  name: string;
  checksum: string;
  sql: string;
}

const MIGRATIONS: readonly RuntimeMigration[] = [
  {
    name: '20261122170000_order_meta_signals',
    checksum: '01f2e5bfc282bb7a3152cb6f13fb1ec0e9a82f7ff6f1c716c53b540e2d8c14ec',
    sql: 'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "metaSignals" JSONB',
  },
];

const LOCK_KEY = 732_190_441;
const log = new Logger('RuntimeMigrations');

let done: Promise<void> | null = null;

/** Один раз на інстанс, скільки б PrismaService не створили модулі. */
export function applyRuntimeMigrations(client: PrismaClient): Promise<void> {
  done ??= run(client).catch((error: unknown) => {
    // Не валимо старт: без міграції впаде лише код, що чіпає нову колонку,
    // а каталог і решта сайту мають жити. Наступний холодний старт спробує ще.
    done = null;
    log.error(`runtime migration failed: ${error instanceof Error ? error.message : String(error)}`);
  });
  return done;
}

async function run(client: PrismaClient): Promise<void> {
  const applied = await client.$queryRawUnsafe<{ migration_name: string }[]>(
    'SELECT migration_name FROM "_prisma_migrations" WHERE rolled_back_at IS NULL',
  );
  const have = new Set(applied.map((r) => r.migration_name));
  const pending = MIGRATIONS.filter((m) => !have.has(m.name));
  if (pending.length === 0) return;

  await client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY})`);
    for (const m of pending) {
      const again = await tx.$queryRawUnsafe<{ n: bigint }[]>(
        'SELECT count(*) AS n FROM "_prisma_migrations" WHERE migration_name = $1 AND rolled_back_at IS NULL',
        m.name,
      );
      if (Number(again[0]?.n ?? 0) > 0) continue;
      await tx.$executeRawUnsafe(m.sql);
      await tx.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations"
           (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES (gen_random_uuid()::text, $1, now(), $2, NULL, NULL, now(), 1)`,
        m.checksum, m.name,
      );
      log.log(`runtime migration applied: ${m.name}`);
    }
  });
}

export const RUNTIME_MIGRATIONS_FOR_TEST = MIGRATIONS;
