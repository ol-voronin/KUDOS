-- «Благодійна Бабака»: принт продається з одним конкретним виробом.
-- description  — абзац про принт (благодійний внесок) на місці вибору виробу.
-- productNote  — свій текст «Виріб і друк» (склад тканини, метод друку).
-- fixedPriceMinor — ціна «принт + виріб» у копійках; NULL — звичайна схема.
ALTER TABLE "Print" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Print" ADD COLUMN IF NOT EXISTS "productNote" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Print" ADD COLUMN IF NOT EXISTS "fixedPriceMinor" INTEGER;
ALTER TABLE "Print" ADD CONSTRAINT "Print_fixedPriceMinor_positive"
  CHECK ("fixedPriceMinor" IS NULL OR "fixedPriceMinor" > 0);
