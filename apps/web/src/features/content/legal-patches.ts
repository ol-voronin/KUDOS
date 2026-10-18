import type { PageDto } from '@dt/contracts';

type Block = PageDto['blocks'][number];
type LegalItems = Extract<Block, { type: 'legal' }>['items'];

/**
 * Правки юридичних сторінок, які мають діяти, навіть поки в адмінці лежить
 * стара редакція.
 *
 * Політика конфіденційності в базі писалася, коли на сайті не було ні
 * аналітики, ні реклами, і прямо обіцяє: «не використовує рекламні чи
 * аналітичні cookie». Після Google Analytics, тегу Google Ads, плашки про аналітику
 * й розширених конверсій це вже неправда, а неправдива політика гірша за
 * відсутню. Тому розділи 5 і 8 та дату редакції підміняємо тут.
 *
 * Підміна прив'язана до старого тексту: щойно розділ у базі оновлять
 * (адмінкою або сідом із `apps/api/prisma/pages/legal.json`, де вже лежить
 * та сама редакція), патч перестане спрацьовувати сам.
 */
const OUTDATED_MARKER = 'не використовує рекламні чи аналітичні cookie';
/** Редакція 13.10 описувала банер згоди «Погоджуюсь / Не треба», якого з 15.10 немає. */
const CONSENT_BANNER_MARKER = 'Поки ви не натиснули «Погоджуюсь»';

const PRIVACY_REVISION = 'Редакція від 15 жовтня 2026 року';

const PRIVACY_P5_EXTRA: LegalItems = [
  {
    n: '5.5.',
    text:
      '**Google Ireland Limited** (Google Analytics, Google Ads) — дані про відвідування сайту, '
      + 'а під час заявки чи замовлення ще й номер телефону у вигляді незворотного хешу SHA-256: '
      + 'так ми розуміємо, яка реклама привела покупця. Відкритого номера Google не отримує. '
      + 'Детально — у розділі 8.',
  },
  {
    n: '5.6.',
    text: 'Ми не продаємо ваші дані й не передаємо їх іншим рекламним мережам.',
  },
];

const PRIVACY_P8: LegalItems = [
  {
    n: '8.1.',
    text:
      'Сайт використовує **Google Analytics 4** і тег **Google Ads**, щоб рахувати відвідування й розуміти, яка реклама працює. Під час першого візиту ми повідомляємо про це в плашці внизу екрана.',
  },
  {
    n: '8.2.',
    text:
      'Ці сервіси ставлять аналітичні й рекламні cookie. Хеш телефону передається лише під час заявки чи замовлення (див. п. 5.5).',
  },
  {
    n: '8.3.',
    text:
      'Щоб аналітика вас не враховувала, заблокуйте cookie сайту babaka.shop у налаштуваннях браузера. Якщо раніше ви натиснули «Не треба» в банері згоди, цей вибір і далі діє: cookie Google не ставляться, а Google отримує лише знеособлені сигнали (режим Google Consent Mode).',
  },
  {
    n: '8.4.',
    text:
      'Окремо ми ставимо технічний cookie сесії адміністратора магазину. Покупцеві він не встановлюється.',
  },
];

function patchPrivacy(blocks: Block[]): Block[] {
  const p8 = blocks.find((b) => b.type === 'legal' && b.id === 'p8');
  const outdated = p8?.type === 'legal'
    && p8.items.some((i) => i.text.includes(OUTDATED_MARKER) || i.text.includes(CONSENT_BANNER_MARKER));
  if (!outdated) return blocks;

  return blocks.map((b) => {
    if (b.type === 'hero' && b.footnote.startsWith('Редакція від')) {
      return { ...b, footnote: PRIVACY_REVISION };
    }
    if (b.type === 'legal' && b.id === 'p5') {
      const kept = b.items.filter((i) => i.n !== '5.5.' && i.n !== '5.6.');
      return { ...b, items: [...kept, ...PRIVACY_P5_EXTRA] };
    }
    if (b.type === 'legal' && b.id === 'p8') {
      return { ...b, items: PRIVACY_P8 };
    }
    return b;
  });
}

/**
 * Оферта, п. 4.3: з 18.10 оплата не лише карткою через Monobank, а й за
 * реквізитами — рахунок надсилає менеджер після розмови (рішення Олексія).
 */
const OFERTA_PAYMENT_OLD = 'Оплата — карткою через платіжний сервіс Monobank';
const OFERTA_PAYMENT_NEW =
  'Оплата — після підтвердження замовлення менеджером: на рахунок ФОП за реквізитами або карткою '
  + 'через платіжний сервіс Monobank (АТ «Універсал Банк») за посиланням, яке ми надсилаємо. '
  + 'Дані картки вводяться на стороні банку; ми їх не бачимо й не зберігаємо.';

function patchOferta(blocks: Block[]): Block[] {
  const outdated = blocks.some((b) => b.type === 'legal' && b.items.some((i) => i.text.startsWith(OFERTA_PAYMENT_OLD)));
  if (!outdated) return blocks;
  return blocks.map((b) => (b.type === 'legal'
    ? { ...b, items: b.items.map((i) => (i.text.startsWith(OFERTA_PAYMENT_OLD) ? { ...i, text: OFERTA_PAYMENT_NEW } : i)) }
    : b));
}

export function applyLegalPatches(page: PageDto): PageDto {
  const patch = page.slug === 'pryvatnist' ? patchPrivacy : page.slug === 'oferta' ? patchOferta : null;
  if (patch === null) return page;
  const blocks = patch(page.blocks);
  return blocks === page.blocks ? page : { ...page, blocks };
}
