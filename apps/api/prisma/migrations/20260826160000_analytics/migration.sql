-- Статистика, атрибуція й конверсії.
--
-- Три речі, і кожна відповідає на своє питання:
--
--   AnalyticsEvent   що відбувається на сайті
--   атрибуція        яка реклама привела цю заявку й це замовлення
--   ConversionAction що саме віддавати в Google Ads
--
-- Персональних даних у подіях немає навмисно: ні IP, ні User-Agent, ні
-- посилання з пошуковим запитом. `sessionId` — випадкове число на один
-- візит. Через це власна статистика не потребує банера згоди; банер
-- потрібен рівно для GA4, який ставить свої cookie.

ALTER TABLE "SiteSettings" ADD COLUMN "ga4MeasurementId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteSettings" ADD COLUMN "googleAdsId" TEXT NOT NULL DEFAULT '';

-- Формат ідентифікаторів перевіряємо тут, а не тільки у формі: помилка в
-- одному символі означає тег, який мовчки нічого не надсилає, і виявляється
-- це через тиждень порожніх звітів.
ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_ga4_shape" CHECK (
  "ga4MeasurementId" = '' OR "ga4MeasurementId" ~ '^G-[A-Z0-9]{4,}$'
);
ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_ads_shape" CHECK (
  "googleAdsId" = '' OR "googleAdsId" ~ '^AW-[0-9]{6,}$'
);

CREATE TABLE "AnalyticsEvent" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "referrerHost" TEXT NOT NULL DEFAULT '',
    "utmSource" TEXT NOT NULL DEFAULT '',
    "utmMedium" TEXT NOT NULL DEFAULT '',
    "utmCampaign" TEXT NOT NULL DEFAULT '',
    "utmTerm" TEXT NOT NULL DEFAULT '',
    "utmContent" TEXT NOT NULL DEFAULT '',
    "gclid" TEXT NOT NULL DEFAULT '',
    "valueMinor" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AnalyticsEvent_siteId_name_createdAt_idx" ON "AnalyticsEvent"("siteId", "name", "createdAt");
CREATE INDEX "AnalyticsEvent_siteId_createdAt_idx" ON "AnalyticsEvent"("siteId", "createdAt");
CREATE INDEX "AnalyticsEvent_siteId_utmCampaign_idx" ON "AnalyticsEvent"("siteId", "utmCampaign");

ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Сума або є, або її немає; відʼємної суми замовлення не буває.
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_value_positive" CHECK (
  "valueMinor" IS NULL OR "valueMinor" >= 0
);

CREATE TABLE "ConversionAction" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sendValue" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversionAction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConversionAction_siteId_event_key" ON "ConversionAction"("siteId", "event");

ALTER TABLE "ConversionAction" ADD CONSTRAINT "ConversionAction_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Атрибуція заявки й замовлення. Колонками, а не JSON: головне питання до
-- цих даних — «скільки заявок дала кампанія X», а це group by.
ALTER TABLE "Lead" ADD COLUMN "utmSource" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Lead" ADD COLUMN "utmMedium" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Lead" ADD COLUMN "utmCampaign" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Lead" ADD COLUMN "utmTerm" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Lead" ADD COLUMN "utmContent" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Lead" ADD COLUMN "gclid" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Lead" ADD COLUMN "landingPath" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Lead" ADD COLUMN "referrerHost" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Lead" ADD COLUMN "sessionId" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Order" ADD COLUMN "utmSource" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "utmMedium" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "utmCampaign" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "utmTerm" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "utmContent" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "gclid" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "landingPath" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "referrerHost" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "sessionId" TEXT NOT NULL DEFAULT '';

CREATE INDEX "Lead_utmCampaign_idx" ON "Lead"("utmCampaign");
CREATE INDEX "Order_utmCampaign_idx" ON "Order"("utmCampaign");
