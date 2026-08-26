-- Ціноутворення правилами: надбавки й знижки.
--
-- Два окремі механізми, і межа між ними — момент застосування:
--
--   надбавка формує ціну виробу       (база + розмір + тканина + колір)
--   знижка застосовується до рядка    (ціна × кількість − знижка)
--
-- Через це вони не змішуються в одну таблицю з прапорцем. Змішування виглядає
-- економією одного CREATE TABLE, а коштує тим, що на питання «чи складається
-- надбавка за розмір із акцією» ніхто не може відповісти, дивлячись у дані.

CREATE TYPE "PriceModifierTarget" AS ENUM ('SIZE_LABEL', 'FABRIC', 'COLOUR');
CREATE TYPE "PriceAdjustKind" AS ENUM ('DELTA', 'PERCENT');
CREATE TYPE "DiscountScope" AS ENUM ('ALL', 'GARMENT', 'COLLECTION');

CREATE TABLE "PriceModifier" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "target" "PriceModifierTarget" NOT NULL,
    "sizeLabel" TEXT,
    "fabricId" UUID,
    "colourId" UUID,
    "garmentId" UUID,
    "kind" "PriceAdjustKind" NOT NULL DEFAULT 'DELTA',
    "amount" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceModifier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PriceModifier_isActive_idx" ON "PriceModifier"("isActive");
CREATE INDEX "PriceModifier_garmentId_idx" ON "PriceModifier"("garmentId");
CREATE INDEX "PriceModifier_fabricId_idx" ON "PriceModifier"("fabricId");
CREATE INDEX "PriceModifier_colourId_idx" ON "PriceModifier"("colourId");

ALTER TABLE "PriceModifier" ADD CONSTRAINT "PriceModifier_fabricId_fkey"
  FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceModifier" ADD CONSTRAINT "PriceModifier_colourId_fkey"
  FOREIGN KEY ("colourId") REFERENCES "Colour"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceModifier" ADD CONSTRAINT "PriceModifier_garmentId_fkey"
  FOREIGN KEY ("garmentId") REFERENCES "Garment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Рівно одне поле цілі заповнене, і саме те, яке відповідає `target`.
-- Без цього в таблиці зʼявляється рядок target=FABRIC із порожнім fabricId,
-- який мовчки не діє ні на що, і людина шукає, «чому надбавка не працює».
ALTER TABLE "PriceModifier" ADD CONSTRAINT "PriceModifier_target_field" CHECK (
     ("target" = 'SIZE_LABEL' AND "sizeLabel" IS NOT NULL AND "fabricId" IS NULL AND "colourId" IS NULL)
  OR ("target" = 'FABRIC'     AND "fabricId"  IS NOT NULL AND "sizeLabel" IS NULL AND "colourId" IS NULL)
  OR ("target" = 'COLOUR'     AND "colourId"  IS NOT NULL AND "sizeLabel" IS NULL AND "fabricId"  IS NULL)
);

-- Відсоток — у сотих відсотка, і межі тут не косметичні: −100 % робить виріб
-- безкоштовним, а сотні відсотків найчастіше означають, що людина ввела
-- «50» замість «5000» або навпаки.
ALTER TABLE "PriceModifier" ADD CONSTRAINT "PriceModifier_percent_range" CHECK (
  "kind" <> 'PERCENT' OR ("amount" > -10000 AND "amount" <= 100000)
);

-- Два однакові правила — це не помилка бази, а помилка людини, яку база
-- зобовʼязана помітити: надбавки складаються, тож дубль тихо подвоює ціну.
-- Складений унікальний індекс тут не годиться — у Postgres NULL не дорівнює
-- NULL, і «розмір 2XL для всіх виробів» можна створити скільки завгодно
-- разів. Тому індекс по виразу з COALESCE.
CREATE UNIQUE INDEX "PriceModifier_scope_key" ON "PriceModifier" (
  "target",
  COALESCE("garmentId", '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE("sizeLabel", ''),
  COALESCE("fabricId", '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE("colourId", '00000000-0000-0000-0000-000000000000'::uuid)
);

CREATE TABLE "Discount" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "DiscountScope" NOT NULL DEFAULT 'ALL',
    "garmentId" UUID,
    "collectionId" UUID,
    "kind" "PriceAdjustKind" NOT NULL DEFAULT 'PERCENT',
    "amount" INTEGER NOT NULL,
    "minQty" INTEGER NOT NULL DEFAULT 1,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Discount_isActive_startsAt_endsAt_idx" ON "Discount"("isActive", "startsAt", "endsAt");
CREATE INDEX "Discount_garmentId_idx" ON "Discount"("garmentId");
CREATE INDEX "Discount_collectionId_idx" ON "Discount"("collectionId");

ALTER TABLE "Discount" ADD CONSTRAINT "Discount_garmentId_fkey"
  FOREIGN KEY ("garmentId") REFERENCES "Garment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Discount" ADD CONSTRAINT "Discount_scope_field" CHECK (
     ("scope" = 'ALL'        AND "garmentId" IS NULL     AND "collectionId" IS NULL)
  OR ("scope" = 'GARMENT'    AND "garmentId" IS NOT NULL AND "collectionId" IS NULL)
  OR ("scope" = 'COLLECTION' AND "collectionId" IS NOT NULL AND "garmentId" IS NULL)
);

-- Знижка завжди додатна, відсоткова — не більша за 100 %. Відʼємна знижка
-- означала б націнку в таблиці, яку ніхто не читає як націнку.
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_percent_range" CHECK (
  "kind" <> 'PERCENT' OR "amount" <= 10000
);

ALTER TABLE "Discount" ADD CONSTRAINT "Discount_minQty_positive" CHECK ("minQty" >= 1);

-- Вікно дії має бути вікном.
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_window_ordered" CHECK (
  "startsAt" IS NULL OR "endsAt" IS NULL OR "startsAt" < "endsAt"
);

-- Знімок назви знижки в замовленні. Суми ми вже фіксуємо на момент покупки;
-- назва — з тієї самої причини: правило перейменують або вимкнуть, а
-- пояснити стару суму треба буде через півроку.
ALTER TABLE "Order" ADD COLUMN "discountName" TEXT;
