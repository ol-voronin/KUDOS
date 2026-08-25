-- Асортимент: опис виробу + точкові заборони друку.
--
-- `PrintGarmentRule` лишається на місці й зі своєю таблицею — змінилося лише
-- прочитання: тепер це звуження, а не дозвіл. Міграція даних не потрібна,
-- бо жодного рядка правил у продакшені так і не зʼявилося (саме через це
-- сторінка принта й була порожньою).

ALTER TABLE "Garment" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';

CREATE TABLE "PrintGarmentExclusion" (
    "printId" UUID NOT NULL,
    "garmentId" UUID NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintGarmentExclusion_pkey" PRIMARY KEY ("printId","garmentId")
);

CREATE INDEX "PrintGarmentExclusion_garmentId_idx" ON "PrintGarmentExclusion"("garmentId");

ALTER TABLE "PrintGarmentExclusion" ADD CONSTRAINT "PrintGarmentExclusion_printId_fkey"
    FOREIGN KEY ("printId") REFERENCES "Print"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrintGarmentExclusion" ADD CONSTRAINT "PrintGarmentExclusion_garmentId_fkey"
    FOREIGN KEY ("garmentId") REFERENCES "Garment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
