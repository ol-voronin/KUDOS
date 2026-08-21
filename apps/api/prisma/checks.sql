-- Констрейнти, які Prisma не вміє описати в schema.prisma.
-- Застосовувати ПІСЛЯ `prisma migrate dev` / `prisma migrate deploy`:
--
--   pnpm --filter @dt/api db:checks
--
-- Файл ідемпотентний — можна ганяти скільки завгодно разів.

-- Варіант «під замовлення» зобовʼязаний мати строк.
-- Валідації в zod і в формі адмінки недостатньо: цілісність має тримати БД,
-- інакше перший же скрипт імпорту або ручний UPDATE створить товар, який
-- показується покупцеві як недоступний без жодного пояснення.
ALTER TABLE "Variant" DROP CONSTRAINT IF EXISTS variant_lead_time_required;
ALTER TABLE "Variant" ADD CONSTRAINT variant_lead_time_required
  CHECK (availability <> 'MADE_TO_ORDER' OR "leadTimeDays" IS NOT NULL);
