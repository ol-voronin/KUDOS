-- Ребрендинг: «Хвісторія» → «БАБАКА» (остаточна назва, рішення 17.09.2026).
--
-- Історична примітка: у проді brand зберігався КАПСОМ («ХВІСТОРІЯ»), тому
-- перша версія цього файла з WHERE brand = 'Хвісторія' не збіглася, і бренд
-- зрештою перейменували через адмінське API. Файл лишається для чистих
-- інсталяцій і тепер ловить обидва написання; на проді він — no-op.
UPDATE "SiteSettings" SET "brand" = 'БАБАКА' WHERE "brand" IN ('Хвісторія', 'ХВІСТОРІЯ');

UPDATE "PageVersion"
SET "title"          = replace(replace("title", 'Хвісторія', 'Бабака'), 'ХВІСТОРІЯ', 'БАБАКА'),
    "excerpt"        = replace(replace("excerpt", 'Хвісторія', 'Бабака'), 'ХВІСТОРІЯ', 'БАБАКА'),
    "seoTitle"       = replace(replace("seoTitle", 'Хвісторія', 'Бабака'), 'ХВІСТОРІЯ', 'БАБАКА'),
    "seoDescription" = replace(replace("seoDescription", 'Хвісторія', 'Бабака'), 'ХВІСТОРІЯ', 'БАБАКА'),
    "blocks"         = replace(replace("blocks"::text, 'Хвісторія', 'Бабака'), 'ХВІСТОРІЯ', 'БАБАКА')::jsonb
WHERE "title" LIKE '%Хвісторія%' OR "title" LIKE '%ХВІСТОРІЯ%'
   OR "excerpt" LIKE '%Хвісторія%' OR "excerpt" LIKE '%ХВІСТОРІЯ%'
   OR "seoTitle" LIKE '%Хвісторія%' OR "seoTitle" LIKE '%ХВІСТОРІЯ%'
   OR "seoDescription" LIKE '%Хвісторія%' OR "seoDescription" LIKE '%ХВІСТОРІЯ%'
   OR "blocks"::text LIKE '%Хвісторія%' OR "blocks"::text LIKE '%ХВІСТОРІЯ%';
