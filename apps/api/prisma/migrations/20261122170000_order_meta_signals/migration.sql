-- Сигнали для Conversions API в замовленні.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "metaSignals" JSONB;
