-- Фото самої породи для плитки й шапки сторінки.
-- Nullable: заповнюємо поступово, доки поле порожнє — показуємо прев'ю принта.
ALTER TABLE "Breed" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
