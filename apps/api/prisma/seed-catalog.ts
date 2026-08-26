/**
 * Довідники каталогу: топові породи й колекції.
 *
 * Це НЕ демо-дані. Породи й колекції — реальні сутності, від яких залежать
 * породні сторінки (головний вхід із пошуку) і правила друку. Скрипт
 * ідемпотентний: можна ганяти скільки завгодно, наявні записи не псуються.
 *
 * Запуск: pnpm --filter @dt/api run db:seed:catalog
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Синоніми — не прикраса. Поле `Breed.synonyms` виводиться на породній
 * сторінці й бере участь у пошуку, а українці шукають одну породу
 * пʼятьма способами: кирилицею, латиницею, скорочено й з помилкою.
 * Кожен синонім тут — це запит, за яким людина має вас знайти.
 */
const BREEDS: Array<{ slug: string; name: string; synonyms: string[] }> = [
  // ── названі замовником ───────────────────────────────────────────────
  { slug: 'shpits', name: 'Шпіц', synonyms: ['померанський шпіц', 'померанець', 'pomeranian', 'spitz'] },
  { slug: 'maltipu', name: 'Мальтіпу', synonyms: ['maltipoo', 'мальтипу'] },
  { slug: 'frantsuzkyi-buldog', name: 'Французький бульдог', synonyms: ['французик', 'french bulldog', 'фрєнчі', 'бульдог'] },
  { slug: 'labrador', name: 'Лабрадор', synonyms: ['лабрадор-ретривер', 'labrador', 'лабік'] },
  { slug: 'retriver', name: 'Золотистий ретривер', synonyms: ['голден ретривер', 'golden retriever', 'ретрівер'] },
  { slug: 'doberman', name: 'Доберман', synonyms: ['doberman', 'добік'] },
  { slug: 'korgi', name: 'Коргі', synonyms: ['вельш-коргі', 'welsh corgi', 'коргі пемброк', 'corgi'] },
  { slug: 'vestik', name: 'Вест-хайленд-тер’єр', synonyms: ['вестик', 'вест хайленд', 'westie', 'west highland terrier'] },

  // ── топ-10 від мене ──────────────────────────────────────────────────
  // Порядок не випадковий: це найпоширеніші домашні собаки в українських
  // містах. Перевіряти на реальному попиті — після перших замовлень.
  { slug: 'yorkshyrskyi-terier', name: 'Йоркширський тер’єр', synonyms: ['йорк', 'йоркшир', 'yorkshire terrier', 'yorkie'] },
  { slug: 'chihuahua', name: 'Чихуахуа', synonyms: ['чіхуахуа', 'чіх', 'chihuahua'] },
  { slug: 'taksa', name: 'Такса', synonyms: ['дакель', 'dachshund', 'сосиска'] },
  { slug: 'nimetska-vivcharka', name: 'Німецька вівчарка', synonyms: ['вівчарка', 'german shepherd', 'нємєцкая овчарка'] },
  { slug: 'khaski', name: 'Хаскі', synonyms: ['сибірський хаскі', 'husky', 'сибірська хаскі'] },
  { slug: 'dzhek-rassel', name: 'Джек-рассел тер’єр', synonyms: ['джек рассел', 'jack russell', 'рассел'] },
  { slug: 'bigl', name: 'Бігль', synonyms: ['beagle', 'бигль'] },
  { slug: 'mops', name: 'Мопс', synonyms: ['pug', 'мопсік'] },
  { slug: 'shi-tsu', name: 'Ши-тцу', synonyms: ['шицу', 'shih tzu', 'ші тцу'] },

  // ── додані під готові принти ─────────────────────────────────────────
  // Ці три взялися не з дослідження попиту, а з фотографій: на макетах
  // «Бос дзвонить» і «Call of Woof» саме вони, і без запису в довіднику
  // принт нема до чого прив'язати.
  //
  // Синоніми тут особливо важать. Офіційна назва «американський
  // стафордширський тер'єр» у пошуку майже не вживається — люди пишуть
  // «стаф» або «амстафф»; кане-корсо половина шукає латиницею.
  { slug: 'staford', name: 'Стафордширський тер’єр', synonyms: ['стафорд', 'стаф', 'амстафф', 'staffordshire terrier', 'amstaff'] },
  { slug: 'pudel', name: 'Пудель', synonyms: ['poodle', 'королівський пудель', 'той-пудель', 'пуделек'] },
  { slug: 'kane-korso', name: 'Кане-корсо', synonyms: ['cane corso', 'кане корсо', 'корсо', 'італійський мастиф'] },
  /**
   * Метис — найважливіший запис у цьому списку.
   *
   * Частина українських власників має собаку з притулку, і «породи» в неї
   * немає. Для них усі інші сторінки — про чужих собак. Ця сторінка каже
   * прямо: намалюємо саме вашого, порода не потрібна. Тут майже немає
   * конкуренції в пошуку, і найвища емоційна віддача.
   */
  { slug: 'metys', name: 'Метис', synonyms: ['дворняга', 'безпородний', 'песик з притулку', 'двортер’єр', 'дворняжка'] },
];

/**
 * Колекції — друга вісь каталогу. Не порода, а жанр.
 *
 * `position` задає порядок на сайті. Опубліковані одразу: порожня колекція
 * усе одно має сторінку, яка працює й пропонує намалювати з нуля.
 *
 * Перші три — справжні лінійки, які вже зняті й продаються. Решта лишилася
 * з розвідки, коли товару ще не існувало: вони не видалені (на них можуть
 * посилатися принти й статті), але зняті з публікації міграцією
 * `20260826190000_collections_hvistoria`. Тому `isPublished` тут більше не
 * ставиться наосліп — інакше кожен прогін сіду знову вішав би сім порожніх
 * жанрів на вітрину.
 */
const COLLECTIONS: Array<{ slug: string; title: string; description: string; published: boolean }> = [
  { slug: 'mystetstvo', title: 'Мистецтво бути шедевром', published: true, description: 'Шість полотен, які знає кожен. І шість морд, які знаєте тільки ви.' },
  { slug: 'bos-dzvonyt', title: 'Бос дзвонить', published: true, description: 'Екран вхідного дзвінка, а в колі — ваш пес. Той самий макет можна зробити з вашого фото.' },
  { slug: 'call-of-woof', title: 'Call of Woof', published: true, description: 'Welcome to blackout, soldier. Колекція, яку зрозуміють без пояснень усі, хто пережив зиму без світла.' },
  { slug: 'modni-zhurnaly', title: 'Модні журнали', published: false, description: 'Ваш пес на обкладинці Vogue, Elle чи GQ. Найпопулярніший жанр — і найкращий подарунок.' },
  { slug: 'sobaky-v-bari', title: 'Собаки в барі', published: false, description: 'Компанія псів за барною стійкою. Той випадок, коли принт помічають раніше, ніж вас.' },
  { slug: 'portrety', title: 'Портрети', published: false, description: 'Класичний портрет у стилі старих майстрів. Ренесанс, бароко, олія — з вашого фото.' },
  { slug: 'kino', title: 'Кіно', published: false, description: 'Улюблені кадри й постери, у яких головну роль грає ваша собака.' },
  { slug: 'znamenytosti', title: 'Знаменитості', published: false, description: 'Пес у образі того, кого впізнають без пояснень.' },
  { slug: 'den-narodzhennia', title: 'День народження', published: false, description: 'Принт із датою, кличкою і віком. Найчастіше замовляють у подарунок — і саме тому строк тут важливіший за ціну.' },
  { slug: 'muzyka', title: 'Музика', published: false, description: 'Обкладинки альбомів і сценічні образи. Від вінілу до стадіону.' },
];

async function main(): Promise<void> {
  let breedsCreated = 0;
  for (const breed of BREEDS) {
    const before = await prisma.breed.findUnique({ where: { slug: breed.slug }, select: { id: true } });
    await prisma.breed.upsert({
      where: { slug: breed.slug },
      // Синоніми оновлюємо завжди: список запитів росте, і це єдине поле,
      // яке має сенс перезаписувати без питань.
      update: { name: breed.name, synonyms: breed.synonyms },
      create: breed,
    });
    if (!before) breedsCreated += 1;
  }

  let collectionsCreated = 0;
  const collectionIds: string[] = [];
  for (const [index, collection] of COLLECTIONS.entries()) {
    const before = await prisma.collection.findUnique({ where: { slug: collection.slug }, select: { id: true } });
    const row = await prisma.collection.upsert({
      where: { slug: collection.slug },
      update: { title: collection.title, description: collection.description, position: index },
      create: {
        slug: collection.slug, title: collection.title,
        description: collection.description, position: index,
        isPublished: collection.published,
      },
      select: { id: true },
    });
    collectionIds.push(row.id);
    if (!before) collectionsCreated += 1;
  }

  /**
   * Правила друку: без них принт колекції не має ціни й не купується —
   * `PrintGarmentRule` це єдиний спосіб сказати «цей жанр можна друкувати
   * на цьому виробі».
   *
   * Зараз звʼязуємо кожну колекцію з усіма опублікованими виробами.
   * УВАГА: у матриці товарів є правило «Портрети — тільки оверсайз». Виконати
   * його зараз неможливо, бо оверсайз-виробів у базі ще немає. Коли зʼявляться
   * — правила для `portrety` треба звузити, і саме тут.
   */
  const garments = await prisma.garment.findMany({ where: { isPublished: true }, select: { id: true } });
  let rules = 0;
  for (const collectionId of collectionIds) {
    for (const garment of garments) {
      const existing = await prisma.printGarmentRule.findFirst({
        where: { collectionId, garmentId: garment.id },
        select: { id: true },
      });
      if (!existing) {
        await prisma.printGarmentRule.create({ data: { collectionId, garmentId: garment.id } });
        rules += 1;
      }
    }
  }

  console.info(
    `породи: ${BREEDS.length} (нових ${breedsCreated}) · ` +
    `колекції: ${COLLECTIONS.length} (нових ${collectionsCreated}) · ` +
    `правил друку створено: ${rules}`,
  );
  if (garments.length === 0) {
    console.warn(
      'Опублікованих виробів немає — правила друку не створені, і принти цих ' +
      'колекцій будуть без ціни. Опублікуйте вироби й прожeніть скрипт ще раз.',
    );
  }
}

main()
  .catch((error: unknown) => { console.error(error); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
