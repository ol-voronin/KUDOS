-- Пункт «Часті запитання» → /faq у футерній колонці «Допомога».
-- Ідемпотентно: додається один раз і лише якщо така колонка існує;
-- немає колонки — нічого не робимо, пункт додадуть в адмінці.
INSERT INTO "MenuItem" (id, "siteId", area, "group", label, href, position, "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), m."siteId", 'FOOTER'::"MenuArea", m."group", 'Часті запитання', '/faq',
       (SELECT COALESCE(MAX(x.position), 0) + 10 FROM "MenuItem" x
         WHERE x."siteId" = m."siteId" AND x.area = 'FOOTER'::"MenuArea" AND x."group" = m."group"),
       true, now(), now()
FROM "MenuItem" m
WHERE m.area = 'FOOTER'::"MenuArea"
  AND lower(m."group") = 'допомога'
  AND NOT EXISTS (SELECT 1 FROM "MenuItem" e WHERE e."siteId" = m."siteId" AND e.href = '/faq')
LIMIT 1;
