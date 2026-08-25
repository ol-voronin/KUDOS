-- Фото принтів: до пʼяти на принт.
--
-- `previewUrl` отримує DEFAULT '': принт тепер створюється без жодного фото
-- (спочатку рядок, потім завантаження на екрані редагування), а публікувати
-- його без обкладинки не дає перевірка в сервісі.

ALTER TABLE "Print" ALTER COLUMN "previewUrl" SET DEFAULT '';

CREATE TABLE "PrintImage" (
    "id" UUID NOT NULL,
    "printId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrintImage_printId_position_idx" ON "PrintImage"("printId", "position");

ALTER TABLE "PrintImage" ADD CONSTRAINT "PrintImage_printId_fkey"
  FOREIGN KEY ("printId") REFERENCES "Print"("id") ON DELETE CASCADE ON UPDATE CASCADE;
