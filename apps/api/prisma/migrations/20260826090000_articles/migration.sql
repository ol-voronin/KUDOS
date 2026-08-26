-- Матеріали: звʼязки статті з породами й колекціями.
--
-- Нових полів у самій сторінці не додаємо навмисно: `kind = ARTICLE`,
-- `publishedAt` і обкладинка у версії вже є з першого етапу CMS. Стаття — це
-- та сама сторінка з блоків, а не окрема сутність із власним редактором;
-- інакше довелося б підтримувати два редактори, два попередні перегляди й
-- дві історії версій заради різниці в адресі.
--
-- Те, чого справді бракувало, — звʼязок. Без нього стаття «Як доглядати
-- вовну коргі» лежить у стрічці за датою й через місяць недосяжна, хоча її
-- місце — на сторінці коргі, куди люди приходять із пошуку.

CREATE TABLE "PageBreed" (
    "siteId" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "breedId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageBreed_pkey" PRIMARY KEY ("pageId","breedId")
);
CREATE INDEX "PageBreed_siteId_breedId_idx" ON "PageBreed"("siteId", "breedId");

ALTER TABLE "PageBreed" ADD CONSTRAINT "PageBreed_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageBreed" ADD CONSTRAINT "PageBreed_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageBreed" ADD CONSTRAINT "PageBreed_breedId_fkey"
  FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PageCollection" (
    "siteId" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageCollection_pkey" PRIMARY KEY ("pageId","collectionId")
);
CREATE INDEX "PageCollection_siteId_collectionId_idx" ON "PageCollection"("siteId", "collectionId");

ALTER TABLE "PageCollection" ADD CONSTRAINT "PageCollection_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageCollection" ADD CONSTRAINT "PageCollection_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageCollection" ADD CONSTRAINT "PageCollection_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
