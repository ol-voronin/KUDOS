-- Три породи, яких бракувало під готові принти.
--
-- Взялися не з дослідження попиту, а з фотографій: на макетах «Бос дзвонить»
-- і «Call of Woof» саме ці собаки, і без запису в довіднику принт нема до
-- чого прив'язати. Породна сторінка — головний вхід із пошуку, тож принт без
-- породи втрачає не «тег», а канал.
--
-- Синоніми не декор: за офіційною назвою «американський стафордширський
-- тер'єр» майже ніхто не шукає — пишуть «стаф» або «амстафф». Кане-корсо
-- половина набирає латиницею.
INSERT INTO "Breed" ("id", "slug", "name", "synonyms", "createdAt", "updatedAt")
VALUES
  (
    gen_random_uuid(), 'staford', 'Стафордширський тер’єр',
    ARRAY['стафорд', 'стаф', 'амстафф', 'staffordshire terrier', 'amstaff']::TEXT[],
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(), 'pudel', 'Пудель',
    ARRAY['poodle', 'королівський пудель', 'той-пудель', 'пуделек']::TEXT[],
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(), 'kane-korso', 'Кане-корсо',
    ARRAY['cane corso', 'кане корсо', 'корсо', 'італійський мастиф']::TEXT[],
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT ("slug") DO NOTHING;
