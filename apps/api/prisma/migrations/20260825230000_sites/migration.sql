-- Належність сайту: межа орендаря в даних.
--
-- Порядок кроків тут важливіший за їхній зміст. Колонка `siteId` обовʼязкова
-- й без значення за замовчуванням — саме це змушує компілятор ловити вкладене
-- створення без сайту. Але додати NOT NULL колонку до таблиці з даними не
-- можна, тому робимо в три такти: створити сайт, додати колонку з тимчасовим
-- значенням, зняти значення за замовчуванням.

CREATE TYPE "SiteRole" AS ENUM ('OWNER', 'EDITOR');

CREATE TABLE "Site" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hosts" TEXT[],
    "modules" TEXT[] DEFAULT ARRAY['content']::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Site_key_key" ON "Site"("key");

CREATE TABLE "SiteMember" (
    "siteId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "SiteRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteMember_pkey" PRIMARY KEY ("siteId","userId")
);
CREATE INDEX "SiteMember_userId_idx" ON "SiteMember"("userId");

-- Сайт, який уже працює. Ключ фіксований: на нього спираються сідери й
-- скрипти, коли треба сказати «працюй ось із цим».
INSERT INTO "Site" ("id", "key", "name", "hosts", "modules", "updatedAt")
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'primary',
  'Хвісторія',
  ARRAY[]::TEXT[],
  ARRAY['content', 'shop']::TEXT[],
  CURRENT_TIMESTAMP
);

-- Усі, хто вже мав доступ до адмінки, стають власниками цього сайту.
INSERT INTO "SiteMember" ("siteId", "userId", "role")
SELECT '00000000-0000-4000-8000-000000000001', "id", 'OWNER' FROM "AdminUser";

-- ── siteId у таблицях вмісту ───────────────────────────────────────────────

ALTER TABLE "Page" ADD COLUMN "siteId" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE "Page" ALTER COLUMN "siteId" DROP DEFAULT;

ALTER TABLE "PageVersion" ADD COLUMN "siteId" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE "PageVersion" ALTER COLUMN "siteId" DROP DEFAULT;

ALTER TABLE "MediaAsset" ADD COLUMN "siteId" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE "MediaAsset" ALTER COLUMN "siteId" DROP DEFAULT;

ALTER TABLE "Redirect" ADD COLUMN "siteId" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE "Redirect" ALTER COLUMN "siteId" DROP DEFAULT;

-- ── унікальність тепер у межах сайту ───────────────────────────────────────
--
-- Це друга половина ізоляції, і без неї перша марна: якби адреса лишалася
-- унікальною глобально, другий клієнт не зміг би створити свою «Доставку».

DROP INDEX "Page_locale_slug_key";
CREATE UNIQUE INDEX "Page_siteId_locale_slug_key" ON "Page"("siteId", "locale", "slug");
DROP INDEX "Page_kind_publishedAt_idx";
CREATE INDEX "Page_siteId_kind_publishedAt_idx" ON "Page"("siteId", "kind", "publishedAt");

CREATE INDEX "PageVersion_siteId_idx" ON "PageVersion"("siteId");

DROP INDEX "MediaAsset_pathname_key";
CREATE UNIQUE INDEX "MediaAsset_siteId_pathname_key" ON "MediaAsset"("siteId", "pathname");
DROP INDEX "MediaAsset_createdAt_idx";
CREATE INDEX "MediaAsset_siteId_createdAt_idx" ON "MediaAsset"("siteId", "createdAt");

DROP INDEX "Redirect_locale_fromSlug_key";
CREATE UNIQUE INDEX "Redirect_siteId_locale_fromSlug_key" ON "Redirect"("siteId", "locale", "fromSlug");
DROP INDEX "Redirect_toSlug_idx";
CREATE INDEX "Redirect_siteId_toSlug_idx" ON "Redirect"("siteId", "toSlug");

-- ── звʼязки ────────────────────────────────────────────────────────────────

ALTER TABLE "SiteMember" ADD CONSTRAINT "SiteMember_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteMember" ADD CONSTRAINT "SiteMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Page" ADD CONSTRAINT "Page_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageVersion" ADD CONSTRAINT "PageVersion_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Redirect" ADD CONSTRAINT "Redirect_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
