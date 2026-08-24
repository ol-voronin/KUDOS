-- Правило «варіант під замовлення зобовʼязаний мати строк» тримає база, а не
-- лише zod і форма адмінки: перший же скрипт імпорту або ручний UPDATE інакше
-- створить товар, який показується покупцеві недоступним без пояснення.
--
-- Раніше цей констрейнт жив тільки в prisma/checks.sql і накочувався окремим
-- скриптом. Це означало, що `prisma migrate deploy` — тобто продакшн — його не
-- отримував, а `migrate reset` тихо зносив. Тепер він у міграціях і їде всюди
-- разом зі схемою.
--
-- DROP IF EXISTS робить міграцію безпечною на базах, де констрейнт уже
-- накотили руками через db:checks.
ALTER TABLE "Variant" DROP CONSTRAINT IF EXISTS variant_lead_time_required;
ALTER TABLE "Variant" ADD CONSTRAINT variant_lead_time_required
  CHECK (availability <> 'MADE_TO_ORDER' OR "leadTimeDays" IS NOT NULL);
