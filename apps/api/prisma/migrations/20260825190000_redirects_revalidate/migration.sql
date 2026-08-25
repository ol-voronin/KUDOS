-- Редіректи при перейменуванні сторінки + стан скидання кешу.

ALTER TABLE "Page" ADD COLUMN "revalidatedAt" TIMESTAMP(3);
ALTER TABLE "Page" ADD COLUMN "revalidateError" TEXT NOT NULL DEFAULT '';

CREATE TABLE "Redirect" (
    "id" UUID NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'UK',
    "fromSlug" TEXT NOT NULL,
    "toSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Redirect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Redirect_locale_fromSlug_key" ON "Redirect"("locale", "fromSlug");
CREATE INDEX "Redirect_toSlug_idx" ON "Redirect"("toSlug");
