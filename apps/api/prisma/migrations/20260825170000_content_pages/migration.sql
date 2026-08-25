-- Вміст: сторінки та їхні версії.
--
-- Два часткові унікальні індекси в кінці — головне в цій міграції. Вони
-- кажуть базі: на сторінку може бути щонайбільше одна чернетка й щонайбільше
-- одна опублікована версія. Prisma не вміє описати частковий унікальний
-- індекс, а без нього це правило довелося б тримати кодом — тобто рано чи
-- пізно не тримати взагалі.

CREATE TYPE "Locale" AS ENUM ('UK');
CREATE TYPE "PageKind" AS ENUM ('PAGE', 'ARTICLE', 'SYSTEM');
CREATE TYPE "PageVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "Page" (
    "id" UUID NOT NULL,
    "kind" "PageKind" NOT NULL DEFAULT 'PAGE',
    "locale" "Locale" NOT NULL DEFAULT 'UK',
    "slug" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Page_locale_slug_key" ON "Page"("locale", "slug");
CREATE INDEX "Page_kind_publishedAt_idx" ON "Page"("kind", "publishedAt");

CREATE TABLE "PageVersion" (
    "id" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "PageVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "coverUrl" TEXT NOT NULL DEFAULT '',
    "seoTitle" TEXT NOT NULL DEFAULT '',
    "seoDescription" TEXT NOT NULL DEFAULT '',
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "blocks" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "authorId" UUID,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PageVersion_pageId_number_key" ON "PageVersion"("pageId", "number");
CREATE INDEX "PageVersion_pageId_status_idx" ON "PageVersion"("pageId", "status");

ALTER TABLE "PageVersion" ADD CONSTRAINT "PageVersion_pageId_fkey"
    FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageVersion" ADD CONSTRAINT "PageVersion_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Саме заради цих двох рядків «одна чернетка, одна опублікована» перестає
-- бути домовленістю й стає фактом.
CREATE UNIQUE INDEX "PageVersion_one_draft" ON "PageVersion"("pageId") WHERE "status" = 'DRAFT';
CREATE UNIQUE INDEX "PageVersion_one_published" ON "PageVersion"("pageId") WHERE "status" = 'PUBLISHED';
