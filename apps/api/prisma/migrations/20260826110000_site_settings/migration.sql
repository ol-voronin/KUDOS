-- Налаштування сайту й меню в базі.
--
-- Досі це був файл `config/site.ts` у вебі й масив NAV у компоненті шапки.
-- Для одного сайту так і треба було. Для установки, у якій сайтів багато,
-- константа в коді означає, що другий клієнт неможливий без деплою.
--
-- Міграція одразу вписує наявні значення для сайту `primary` — щоб після
-- накатки сайт виглядав рівно так само, як виглядав до неї. Порожня таблиця
-- налаштувань тут була б не «чистим станом», а зниклими контактами у футері
-- й порожнім меню.

CREATE TYPE "MenuArea" AS ENUM ('HEADER', 'FOOTER');

CREATE TABLE "SiteSettings" (
    "siteId" UUID NOT NULL,
    "brand" TEXT NOT NULL,
    "legalEntityName" TEXT NOT NULL DEFAULT '',
    "legalEntityShort" TEXT NOT NULL DEFAULT '',
    "taxNumber" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "phoneDisplay" TEXT NOT NULL DEFAULT '',
    "telegram" TEXT NOT NULL DEFAULT '',
    "telegramUrl" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "cityIn" TEXT NOT NULL DEFAULT '',
    "workingHours" TEXT NOT NULL DEFAULT '',
    "freeShippingFromMinor" INTEGER NOT NULL DEFAULT 0,
    "returnDays" INTEGER NOT NULL DEFAULT 14,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("siteId")
);

ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_returnDays_sane" CHECK ("returnDays" >= 0 AND "returnDays" <= 365);
ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_shipping_positive" CHECK ("freeShippingFromMinor" >= 0);

CREATE TABLE "MenuItem" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "area" "MenuArea" NOT NULL,
    "group" TEXT NOT NULL DEFAULT '',
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MenuItem_siteId_area_position_idx" ON "MenuItem"("siteId", "area", "position");

ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Адреса пункту меню або внутрішня, або повна зовнішня. Пункт із адресою
-- «prints» без слеша веде в нікуди, і помітно це стає вже на живому сайті.
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_href_shape" CHECK (
  "href" ~ '^(/|#|https?://|mailto:|tel:)'
);

-- Наявні значення. Беруться з config/site.ts станом на цю міграцію.
INSERT INTO "SiteSettings" (
  "siteId", "brand", "legalEntityName", "legalEntityShort", "taxNumber",
  "phone", "phoneDisplay", "telegram", "telegramUrl", "email",
  "city", "cityIn", "workingHours", "freeShippingFromMinor", "returnDays", "updatedAt"
)
SELECT
  "id", 'Kudos print',
  'Фізична особа-підприємець Воронін Олексій Петрович',
  'ФОП Воронін О. П.',
  '3442812170',
  '+380508646355', '+380 50 864 63 55',
  'kudos_print', 'https://t.me/kudos_print',
  'kudos.print.ua@gmail.com',
  'Харків', 'у Харкові', '',
  200000, 14, now()
FROM "Site"
ON CONFLICT ("siteId") DO NOTHING;

-- Меню шапки — те, що зараз зашите в компоненті.
INSERT INTO "MenuItem" ("id", "siteId", "area", "group", "label", "href", "position", "updatedAt")
SELECT gen_random_uuid(), s."id", 'HEADER', '', v.label, v.href, v.position, now()
FROM "Site" s
CROSS JOIN (VALUES
  ('Каталог',     '/prints',       10),
  ('Вироби',      '/vyroby',       20),
  ('Колекції',    '/collections',  30),
  ('Свій принт',  '/svoya-ideya',  40),
  ('Статті',      '/statti',       50),
  ('Співпраця',   '/spivpratsia',  60)
) AS v(label, href, position);

INSERT INTO "MenuItem" ("id", "siteId", "area", "group", "label", "href", "position", "updatedAt")
SELECT gen_random_uuid(), s."id", 'FOOTER', v."group", v.label, v.href, v.position, now()
FROM "Site" s
CROSS JOIN (VALUES
  ('Каталог',  'Усі принти',              '/prints',        10),
  ('Каталог',  'Колекції',                '/collections',   20),
  ('Каталог',  'Вироби, тканини, розміри','/vyroby',        30),
  ('Каталог',  'Свій принт із фото',      '/svoya-ideya',   40),
  ('Компанія', 'Статті',                  '/statti',        10),
  ('Компанія', 'Співпраця та опт',        '/spivpratsia',   20),
  ('Компанія', 'Залишити заявку',         '/zayavka',       30),
  ('Компанія', 'Публічна оферта',         '/oferta',        40),
  ('Компанія', 'Конфіденційність',        '/pryvatnist',    50)
) AS v("group", label, href, position);
