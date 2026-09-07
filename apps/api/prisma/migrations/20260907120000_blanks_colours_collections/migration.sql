-- Базовий одяг, заборони принт×колір, злиття колекцій, «Свій принт» у два шляхи.
--
-- ── Що тут ────────────────────────────────────────────────────────────
--
-- 1. PrintColourExclusion: «песи в барі не на оранжевому» — заборона пари
--    принт×колір як дані, а не як усна домовленість.
-- 2. OrderItem.printId і printMethod стають nullable: рядок замовлення без
--    принта — це базовий одяг, легальний товар із нульовою ціною друку.
-- 3. «Мистецтво бути шедевром» зливається у Vintage (рішення замовника
--    07.09): принти, правила, знижки та статті переїжджають, стара колекція
--    зникає, Vintage публікується на її місці. Редірект старої адреси
--    робить вебзастосунок.
-- 4. Пункт меню «Вироби» стає «Базовий одяг» — тепер це сторінка покупки.
-- 5. Сторінка «Свій принт» перезбирається у два шляхи (адаптація | власна
--    ідея) з кроками 1–4. Блоки замінюються ЦІЛКОМ: набір блоків інший,
--    а власних фонів з адмінки на цій сторінці немає.
--
-- Кожна секція ідемпотентна: обірваний деплой докочується повторним запуском.

-- 1 ── заборони принт×колір ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PrintColourExclusion" (
  "printId"   UUID NOT NULL,
  "colourId"  UUID NOT NULL,
  "reason"    TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrintColourExclusion_pkey" PRIMARY KEY ("printId", "colourId")
);

CREATE INDEX IF NOT EXISTS "PrintColourExclusion_colourId_idx" ON "PrintColourExclusion"("colourId");

DO $$ BEGIN
  ALTER TABLE "PrintColourExclusion"
    ADD CONSTRAINT "PrintColourExclusion_printId_fkey"
    FOREIGN KEY ("printId") REFERENCES "Print"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PrintColourExclusion"
    ADD CONSTRAINT "PrintColourExclusion_colourId_fkey"
    FOREIGN KEY ("colourId") REFERENCES "Colour"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2 ── рядок замовлення без принта ─────────────────────────────────────
ALTER TABLE "OrderItem" ALTER COLUMN "printId" DROP NOT NULL;
ALTER TABLE "OrderItem" ALTER COLUMN "printMethod" DROP NOT NULL;

-- Або обидва NULL (базовий одяг), або обидва задані (принт). Половинчастий
-- рядок — помилка коду, і хай її ловить база, а не бухгалтерія.
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_print_pair";
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_print_pair"
  CHECK (("printId" IS NULL) = ("printMethod" IS NULL));

-- 3 ── «Мистецтво бути шедевром» → Vintage ─────────────────────────────
-- Порядок важливий: спершу переносимо все, що посилається, потім видаляємо.
-- Повторний запуск: старої колекції вже немає, кожен запит нижче — no-op.

INSERT INTO "PrintCollection" ("printId", "collectionId")
SELECT pc."printId", v."id"
FROM "PrintCollection" pc
JOIN "Collection" o ON o."id" = pc."collectionId" AND o."slug" = 'mystetstvo'
CROSS JOIN "Collection" v
WHERE v."slug" = 'vintage'
ON CONFLICT DO NOTHING;

INSERT INTO "PrintGarmentRule" ("id", "collectionId", "garmentId")
SELECT gen_random_uuid(), v."id", r."garmentId"
FROM "PrintGarmentRule" r
JOIN "Collection" o ON o."id" = r."collectionId" AND o."slug" = 'mystetstvo'
CROSS JOIN "Collection" v
WHERE v."slug" = 'vintage'
ON CONFLICT DO NOTHING;

UPDATE "Discount" d
SET "collectionId" = v."id"
FROM "Collection" o, "Collection" v
WHERE d."collectionId" = o."id" AND o."slug" = 'mystetstvo' AND v."slug" = 'vintage';

INSERT INTO "PageCollection" ("siteId", "pageId", "collectionId", "createdAt")
SELECT pc."siteId", pc."pageId", v."id", now()
FROM "PageCollection" pc
JOIN "Collection" o ON o."id" = pc."collectionId" AND o."slug" = 'mystetstvo'
CROSS JOIN "Collection" v
WHERE v."slug" = 'vintage'
ON CONFLICT DO NOTHING;

-- Vintage займає місце старої колекції у вітрині. Опис лишається власний
-- вінтажний — він уже написаний під цей жанр.
UPDATE "Collection" v
SET "isPublished" = true, "position" = o."position"
FROM "Collection" o
WHERE v."slug" = 'vintage' AND o."slug" = 'mystetstvo';

-- Каскад підчищає рештки звʼязків старої колекції.
DELETE FROM "Collection" WHERE "slug" = 'mystetstvo';

-- 4 ── меню: «Вироби» → «Базовий одяг» ─────────────────────────────────
-- Тільки якщо пункт не перейменовували руками: чужу назву не чіпаємо.
UPDATE "MenuItem" SET "label" = 'Базовий одяг'
WHERE "href" = '/vyroby' AND "label" = 'Вироби';

-- 5 ── «Свій принт» у два шляхи ────────────────────────────────────────
UPDATE "PageVersion" v
SET "blocks" = '[
  {"id": "hero", "type": "hero", "tone": "cream", "eyebrow": "Малюємо з твого фото", "heading": "Твій пес — на **твоїй речі**", "lead": "Є два шляхи: адаптуємо готовий принт із каталогу під твою мордочку — або малюємо з нуля з твоєї ідеї. Обидва починаються з кількох фото твого пса.", "footnote": "", "links": []},
  {"id": "ways", "type": "split", "tone": "plain", "heading": "Обери свій шлях", "lead": "", "panels": [
    {"icon": "pencil", "title": "Адаптація готового принту", "priceLine": "+200 ₴ до ціни виробу", "text": "Знайшов крутий принт, але пес не той? Надішли 2–3 фото свого хвостика — зробимо той самий принт із його мордочкою.", "bullets": ["Виготовлення та відправка: {{productionDays}} робочих днів", "Ескіз показуємо до друку — правки безкоштовні"], "ctaLabel": "Обрати принт у каталозі", "ctaHref": "/prints"},
    {"icon": "palette", "title": "Власна ідея з нуля", "priceLine": "від 400 ₴ залежно від складності", "text": "Портрет у стилі старих майстрів, обкладинка журналу, кіноплакат — або те, що вигадав ти. Намалюємо саме твого пса: з його вухами, плямою й виразом морди.", "bullets": ["Виготовлення та відправка: 7–14 робочих днів", "Ціну називаємо після того, як побачили ідею"], "ctaLabel": "Заповнити бриф", "ctaHref": "/zayavka"}
  ]},
  {"id": "how", "type": "steps", "tone": "cream", "heading": "Як це працює", "lead": "", "items": [
    {"title": "Надсилаєш фото", "text": "Три-чотири кадри при денному світлі: морда крупно й кілька в повний зріст. Телефонні фото підходять."},
    {"title": "Погоджуємо ескіз", "text": "Обираємо жанр або принт для адаптації, малюємо й показуємо ескіз до друку. Правки на цьому етапі безкоштовні."},
    {"title": "Друкуємо і шиємо", "text": "Після твого «так» друкуємо на обраному виробі й відправляємо Новою поштою."},
    {"title": "Отримуєш і хвалишся", "text": "Зустрічаєш посилку — і лови компліменти на прогулянці. Надішли нам фото в речі: з твого дозволу покажемо її в наших соцмережах."}
  ]},
  {"id": "promise", "type": "features", "tone": "plain", "heading": "Що ми обіцяємо", "items": [
    {"icon": "heart", "title": "Схожість", "text": "Якщо на ескізі не впізнаєш свого пса — переробляємо, не питаючи."},
    {"icon": "scissors", "title": "Шиємо самі", "text": "Виріб і друк — одне виробництво {{cityIn}}, без посередників."},
    {"icon": "shield", "title": "Твоє фото — твоє", "text": "Не публікуємо роботу без твого дозволу. Детальніше — у [політиці](/pryvatnist)."}
  ]},
  {"id": "lead", "type": "leadForm", "tone": "cream", "heading": "Розкажи про свого пса", "text": "Кличка, порода й пара слів про характер — цього досить, щоб почати. Фото попросимо в Telegram.", "source": "/svoya-ideya"}
]'::jsonb,
    "excerpt" = 'Адаптуємо готовий принт під твого пса або намалюємо власну ідею з нуля. Друкуємо на футболці, худі або світшоті.',
    "seoTitle" = 'Свій принт: адаптація або власна ідея — {{brand}}',
    "seoDescription" = 'Два шляхи до принта з твоїм псом: адаптація готового малюнка (+200 ₴) або власна ідея з нуля (від 400 ₴). {{city}}, доставка по Україні.'
FROM "Page" p
WHERE p."id" = v."pageId" AND p."slug" = 'svoya-ideya'
  AND v."status" IN ('DRAFT', 'PUBLISHED');
