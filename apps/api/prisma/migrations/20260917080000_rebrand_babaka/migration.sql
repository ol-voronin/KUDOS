-- Ребрендинг: «Хвісторія» → «Бабака» (остаточна назва, рішення 17.09.2026).
--
-- Уся типографіка сайту живе на {{brand}}-плейсхолдерах, тож головна робота —
-- один рядок у SiteSettings. Решта — страховка від текстів, які могли вписати
-- руками в адмінці: міняємо лише точні форми з однозначною заміною
-- (називний відмінок обома регістрами), відмінки — очима в адмінці.
UPDATE "SiteSettings" SET "brand" = 'Бабака' WHERE "brand" = 'Хвісторія';

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
