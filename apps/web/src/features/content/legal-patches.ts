import type { PageDto } from '@dt/contracts';

type Block = PageDto['blocks'][number];
type LegalItems = Extract<Block, { type: 'legal' }>['items'];

/**
 * Правки юридичних сторінок, які мають діяти, навіть поки в адмінці лежить
 * стара редакція.
 *
 * Політика конфіденційності в базі писалася, коли на сайті не було ні
 * аналітики, ні реклами, і прямо обіцяє: «не використовує рекламні чи
 * аналітичні cookie». Після Google Analytics, тегу Google Ads, банера згоди
 * й розширених конверсій це вже неправда, а неправдива політика гірша за
 * відсутню. Тому розділи 5 і 8 та дату редакції підміняємо тут.
 *
 * Підміна прив'язана до старого тексту: щойно розділ у базі оновлять
 * (адмінкою або сідом із `apps/api/prisma/pages/legal.json`, де вже лежить
 * та сама редакція), патч перестане спрацьовувати сам.
 */
const OUTDATED_MARKER = 'не використовує рекламні чи аналітичні cookie';

const PRIVACY_REVISION = 'Редакція від 13 жовтня 2026 року';

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
      'Сайт використовує **Google Analytics 4** і тег **Google Ads**, щоб рахувати відвідування '
      + 'й розуміти, яка реклама працює. Під час першого візиту ми питаємо вашої згоди в банері внизу екрана.',
  },
  {
    n: '8.2.',
    text:
      'Поки ви не натиснули «Погоджуюсь», аналітичні й рекламні cookie не ставляться: Google отримує '
      + 'лише знеособлені сигнали без cookie (режим Google Consent Mode), а хеш телефону не використовує. '
      + 'Якщо натиснути «Не треба», теги Google на сайті не завантажуються взагалі.',
  },
  {
    n: '8.3.',
    text:
      'Ваш вибір зберігається у вашому браузері. Щоб змінити його, очистіть дані сайту babaka.shop '
      + 'у браузері — банер зʼявиться знову.',
  },
  {
    n: '8.4.',
    text:
      'Окремо ми ставимо технічний cookie сесії адміністратора магазину. Покупцеві він не встановлюється.',
  },
];

function patchPrivacy(blocks: Block[]): Block[] {
  const p8 = blocks.find((b) => b.type === 'legal' && b.id === 'p8');
  const outdated = p8?.type === 'legal' && p8.items.some((i) => i.text.includes(OUTDATED_MARKER));
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

export function applyLegalPatches(page: PageDto): PageDto {
  if (page.slug !== 'pryvatnist') return page;
  const blocks = patchPrivacy(page.blocks);
  return blocks === page.blocks ? page : { ...page, blocks };
}
