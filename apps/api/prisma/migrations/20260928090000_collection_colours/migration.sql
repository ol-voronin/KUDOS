-- Кольори виробів на рівні колекції.
--
-- 1. CollectionColourExclusion — заборона кольору для всієї колекції.
-- 2. PrintColourAllowance — виняток для одного принта з заборони колекції.
-- 3. «Бабаки в пабі» отримують заборони, які досі стояли лише у «Шпіца»
--    (pab-shpits): власник підтвердив, що саме його набір правильний для
--    всієї колекції. Власні заборони принтів колекції, що тепер дублюють
--    колекційні, прибираються — інакше зняття заборони з колекції не
--    дійшло б до цих принтів.
--
-- Кожна секція ідемпотентна: обірваний деплой докочується повторним запуском.

-- 1 ── заборони колекції ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CollectionColourExclusion" (
  "collectionId" UUID NOT NULL,
  "colourId"     UUID NOT NULL,
  "reason"       TEXT NOT NULL DEFAULT '',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CollectionColourExclusion_pkey" PRIMARY KEY ("collectionId", "colourId")
);

CREATE INDEX IF NOT EXISTS "CollectionColourExclusion_colourId_idx" ON "CollectionColourExclusion"("colourId");

DO $$ BEGIN
  ALTER TABLE "CollectionColourExclusion"
    ADD CONSTRAINT "CollectionColourExclusion_collectionId_fkey"
    FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CollectionColourExclusion"
    ADD CONSTRAINT "CollectionColourExclusion_colourId_fkey"
    FOREIGN KEY ("colourId") REFERENCES "Colour"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2 ── дозволи принта всупереч колекції ────────────────────────────────
CREATE TABLE IF NOT EXISTS "PrintColourAllowance" (
  "printId"   UUID NOT NULL,
  "colourId"  UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrintColourAllowance_pkey" PRIMARY KEY ("printId", "colourId")
);

CREATE INDEX IF NOT EXISTS "PrintColourAllowance_colourId_idx" ON "PrintColourAllowance"("colourId");

DO $$ BEGIN
  ALTER TABLE "PrintColourAllowance"
    ADD CONSTRAINT "PrintColourAllowance_printId_fkey"
    FOREIGN KEY ("printId") REFERENCES "Print"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PrintColourAllowance"
    ADD CONSTRAINT "PrintColourAllowance_colourId_fkey"
    FOREIGN KEY ("colourId") REFERENCES "Colour"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3 ── «Бабаки в пабі»: набір «Шпіца» стає набором колекції ───────────
INSERT INTO "CollectionColourExclusion" ("collectionId", "colourId", "reason")
SELECT c."id", e."colourId", 'Перенесено з принта «Шпіц»'
FROM "Collection" c
JOIN "Print" p ON p."slug" = 'pab-shpits'
JOIN "PrintColourExclusion" e ON e."printId" = p."id"
WHERE c."slug" = 'babaky-v-pabi'
ON CONFLICT DO NOTHING;

DELETE FROM "PrintColourExclusion" e
USING "PrintCollection" pc, "Collection" c, "CollectionColourExclusion" ce
WHERE pc."printId" = e."printId"
  AND c."id" = pc."collectionId" AND c."slug" = 'babaky-v-pabi'
  AND ce."collectionId" = c."id" AND ce."colourId" = e."colourId";
