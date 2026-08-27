import type { AnyBlock, BlockType } from '@dt/contracts';
import { BLOCK_TYPES, moduleOfBlock } from '@dt/contracts';
import { RICH_HELP, type Field } from './fields';

/**
 * Реєстр блоків на боці адмінки.
 *
 * Тип `Record<BlockType, BlockSpec>` — це та сама перевірка, що й у
 * рендерері, тільки з іншого боку: зʼявився тип у контракті, а форми до
 * нього немає — збірка падає тут. Отже, блок фізично не може існувати в
 * схемі, малюватися на сайті й бути недоступним для редагування.
 */

export interface BlockSpec {
  readonly label: string;
  /** Одне речення: коли цей блок доречний. Видно в списку «додати блок». */
  readonly hint: string;
  readonly fields: readonly Field[];
  /** Значення за замовчуванням — новий блок одразу проходить схему. */
  create(id: string): AnyBlock;
  /** Рядок у згорнутому вигляді: щоб не розгортати блок заради впізнавання. */
  summary(block: AnyBlock): string;
}

/*
 * Порядок тут — це порада.
 *
 * Кольорові підкладки лишилися (сторінки, збережені з ними, мають працювати),
 * але поїхали вниз списку й підписані тим, чим вони насправді є. Нагорі три
 * тони, з яких складається вітрина: білий за замовчуванням, кремовий — щоб
 * розділити зони, чорний — рівно один раз на сторінку, там, де треба
 * зупинити прокрутку.
 *
 * Причина проста: колір на сторінці має приносити фотографія товару. Коли
 * колір приносить ще й фон секції, вони починають сперечатися, і програє
 * завжди товар.
 */
const TONE_LABELS: Record<string, string> = {
  plain: 'Білий — за замовчуванням',
  cream: 'Кремовий — розділити зони',
  ink: 'Чорний — акцент, один на сторінку',
  accent: 'Персиковий — застаріле',
  teal: 'Бірюзовий — застаріле',
  sun: 'Пісочний — застаріле',
  plum: 'Сливовий — застаріле',
};

export const TONE_OPTIONS = Object.entries(TONE_LABELS).map(([value, label]) => ({ value, label }));

/** Перші кілька слів тексту — рівно щоб упізнати блок у списку. */
function excerptOf(...candidates: readonly string[]): string {
  const text = candidates.find((c) => c.trim() !== '') ?? '';
  return text.length > 70 ? `${text.slice(0, 70)}…` : text;
}

function countOf(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} ${many}`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} ${few}`;
  return `${n} ${many}`;
}

const HEADING: Field = { kind: 'text', name: 'heading', label: 'Заголовок' };
const LEAD: Field = { kind: 'rich', name: 'lead', label: 'Вступний текст', rows: 3, help: RICH_HELP };
const LINKS = (max: number): Field => ({ kind: 'links', name: 'links', label: 'Кнопки', max });

export const BLOCK_REGISTRY: Record<BlockType, BlockSpec> = {
  hero: {
    label: 'Герой',
    hint: 'Верх сторінки: великий заголовок, абзац і кнопки. Один на сторінку.',
    fields: [
      { kind: 'text', name: 'eyebrow', label: 'Надзаголовок', help: 'Дрібний рядок над заголовком. Можна лишити порожнім.' },
      { kind: 'text', name: 'heading', label: 'Заголовок', help: 'Це H1 сторінки — він має бути один.' },
      { kind: 'rich', name: 'lead', label: 'Текст', rows: 4, help: RICH_HELP },
      { kind: 'text', name: 'footnote', label: 'Дрібний рядок під текстом', help: 'Наприклад: «Редакція від 25 серпня 2026 року».' },
      {
        kind: 'image', name: 'image', label: 'Фон на весь екран',
        help: 'Поставте фото — і герой стане на весь екран, із білим текстом поверх. Лишіть порожнім — буде звичайний заголовок на світлому. Для вітрини потрібне саме фото: горизонтальне, людина з собакою, вільне місце по центру під напис.',
      },
      LINKS(3),
    ],
    create: (id) => ({ id, type: 'hero', tone: 'cream', eyebrow: '', heading: 'Заголовок сторінки', lead: '', footnote: '', links: [], image: { url: '', alt: '', caption: '' } }),
    summary: (b) => (b.type === 'hero' ? excerptOf(b.heading) : ''),
  },

  text: {
    label: 'Текст',
    hint: 'Абзаци й список. Основний блок для будь-якого тексту.',
    fields: [
      HEADING,
      { kind: 'strings', name: 'paragraphs', label: 'Абзаци', itemLabel: 'Абзац', max: 40, rich: true },
      { kind: 'strings', name: 'bullets', label: 'Список', itemLabel: 'Пункт', max: 40, rich: true },
    ],
    create: (id) => ({ id, type: 'text', tone: 'plain', heading: '', paragraphs: [''], bullets: [] }),
    summary: (b) => (b.type === 'text' ? excerptOf(b.heading, b.paragraphs[0] ?? '') : ''),
  },

  cards: {
    label: 'Картки',
    hint: 'Кілька рівноправних тез у рамках. Порядок нічого не означає.',
    fields: [
      HEADING, LEAD,
      { kind: 'select', name: 'columns', label: 'Колонок', options: [
        { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' },
      ] },
      { kind: 'list', name: 'items', label: 'Картки', itemLabel: 'Картка', max: 12, fields: [
      { kind: 'select', name: 'icon', label: 'Іконка', options: [
        { value: 'none', label: 'Без іконки' },
        { value: 'box', label: 'Коробка — готове, відправляємо' },
        { value: 'pencil', label: 'Олівець — правки' },
        { value: 'palette', label: 'Палітра — малюємо з нуля' },
        { value: 'paw', label: 'Лапа — про собаку' },
        { value: 'sparkle', label: 'Іскра — новинка' },
        { value: 'chat', label: 'Хмарка — розмова' },
        { value: 'shield', label: 'Щит — гарантія' },
        { value: 'scissors', label: 'Ножиці — пошиття' },
        { value: 'printer', label: 'Принтер — друк' },
        { value: 'truck', label: 'Авто — доставка' },
        { value: 'heart', label: 'Серце — турбота' },
        { value: 'clock', label: 'Годинник — строки' },
      ] },
        { kind: 'text', name: 'title', label: 'Назва' },
        { kind: 'rich', name: 'text', label: 'Текст', rows: 3, help: RICH_HELP },
      ] },
    ],
    create: (id) => ({ id, type: 'cards', tone: 'plain', heading: '', lead: '', columns: 2, items: [] }),
    summary: (b) => (b.type === 'cards' ? excerptOf(b.heading) || countOf(b.items.length, 'картка', 'картки', 'карток') : ''),
  },

  steps: {
    label: 'Кроки',
    hint: 'Пронумерована послідовність: «як це працює». Номери ставляться самі.',
    fields: [
      HEADING, LEAD,
      { kind: 'list', name: 'items', label: 'Кроки', itemLabel: 'Крок', max: 12, fields: [
        { kind: 'text', name: 'title', label: 'Назва кроку' },
        { kind: 'rich', name: 'text', label: 'Пояснення', rows: 3, help: RICH_HELP },
      ] },
    ],
    create: (id) => ({ id, type: 'steps', tone: 'plain', heading: '', lead: '', items: [] }),
    summary: (b) => (b.type === 'steps' ? excerptOf(b.heading) || countOf(b.items.length, 'крок', 'кроки', 'кроків') : ''),
  },

  features: {
    label: 'Переваги',
    hint: 'Ряд коротких тез з іконками. Три-шість штук, не більше.',
    fields: [
      HEADING,
      { kind: 'list', name: 'items', label: 'Пункти', itemLabel: 'Пункт', max: 6, fields: [
        { kind: 'select', name: 'icon', label: 'Іконка', options: [
          { value: 'shield', label: 'Щит — гарантія' },
          { value: 'scissors', label: 'Ножиці — пошиття' },
          { value: 'printer', label: 'Принтер — друк' },
          { value: 'truck', label: 'Авто — доставка' },
          { value: 'heart', label: 'Серце — турбота' },
          { value: 'clock', label: 'Годинник — строки' },
          { value: 'box', label: 'Коробка — готове, відправляємо' },
          { value: 'pencil', label: 'Олівець — правки' },
          { value: 'palette', label: 'Палітра — малюємо з нуля' },
          { value: 'paw', label: 'Лапа — про собаку' },
          { value: 'sparkle', label: 'Іскра — новинка' },
          { value: 'chat', label: 'Хмарка — розмова' },
        ] },
        { kind: 'text', name: 'title', label: 'Назва' },
        { kind: 'rich', name: 'text', label: 'Текст', rows: 2, help: RICH_HELP },
      ] },
    ],
    create: (id) => ({ id, type: 'features', tone: 'cream', heading: '', items: [] }),
    summary: (b) => (b.type === 'features' ? excerptOf(b.heading) || countOf(b.items.length, 'пункт', 'пункти', 'пунктів') : ''),
  },

  faq: {
    label: 'Питання й відповіді',
    hint: 'Google показує такі блоки просто у видачі — розмітка додається сама.',
    fields: [
      HEADING,
      { kind: 'list', name: 'items', label: 'Питання', itemLabel: 'Питання', max: 30, fields: [
        { kind: 'text', name: 'q', label: 'Питання' },
        { kind: 'rich', name: 'a', label: 'Відповідь', rows: 3, help: RICH_HELP },
      ] },
    ],
    create: (id) => ({ id, type: 'faq', tone: 'plain', heading: 'Питання й відповіді', items: [] }),
    summary: (b) => (b.type === 'faq' ? countOf(b.items.length, 'питання', 'питання', 'питань') : ''),
  },

  cta: {
    label: 'Заклик до дії',
    hint: 'Короткий блок із кнопкою. Ставиться там, де людина вже готова діяти.',
    fields: [
      { kind: 'text', name: 'heading', label: 'Заголовок' },
      { kind: 'rich', name: 'text', label: 'Текст', rows: 3, help: RICH_HELP },
      LINKS(3),
    ],
    create: (id) => ({ id, type: 'cta', tone: 'teal', heading: 'Заголовок', text: '', links: [] }),
    summary: (b) => (b.type === 'cta' ? excerptOf(b.heading) : ''),
  },

  leadForm: {
    label: 'Форма заявки',
    hint: 'Імʼя й телефон. Заявка одразу падає в Telegram і в адмінку.',
    fields: [
      { kind: 'text', name: 'heading', label: 'Заголовок' },
      { kind: 'rich', name: 'text', label: 'Текст поруч із формою', rows: 3, help: RICH_HELP },
      { kind: 'text', name: 'source', label: 'Мітка джерела', help: 'Видно в списку заявок: з якої сторінки прийшли.' },
    ],
    create: (id) => ({ id, type: 'leadForm', tone: 'cream', heading: 'Залиште заявку', text: '', source: '' }),
    summary: (b) => (b.type === 'leadForm' ? excerptOf(b.heading) : ''),
  },

  imageText: {
    label: 'Картинка з текстом',
    hint: 'Фото ліворуч або праворуч, текст поруч.',
    fields: [
      { kind: 'image', name: 'image', label: 'Картинка' },
      { kind: 'select', name: 'side', label: 'Картинка', options: [
        { value: 'left', label: 'Ліворуч' }, { value: 'right', label: 'Праворуч' },
      ] },
      HEADING,
      { kind: 'rich', name: 'text', label: 'Текст', rows: 5, help: RICH_HELP },
      LINKS(2),
    ],
    create: (id) => ({
      id, type: 'imageText', tone: 'plain', side: 'left', heading: '', text: '', links: [],
      image: { url: '', alt: '', caption: '' },
    }),
    summary: (b) => (b.type === 'imageText' ? excerptOf(b.heading, b.image.alt) : ''),
  },

  gallery: {
    label: 'Галерея',
    hint: 'Сітка фотографій із підписами.',
    fields: [
      HEADING,
      { kind: 'images', name: 'items', label: 'Фотографії', max: 24 },
    ],
    create: (id) => ({ id, type: 'gallery', tone: 'plain', heading: '', items: [] }),
    summary: (b) => (b.type === 'gallery' ? countOf(b.items.length, 'фото', 'фото', 'фото') : ''),
  },

  quote: {
    label: 'Цитата',
    hint: 'Відгук або одна думка великим кеглем.',
    fields: [
      { kind: 'rich', name: 'text', label: 'Текст', rows: 3, help: RICH_HELP },
      { kind: 'text', name: 'author', label: 'Хто сказав' },
      { kind: 'text', name: 'role', label: 'Хто це', help: 'Наприклад: «власниця коргі». Можна лишити порожнім.' },
    ],
    create: (id) => ({ id, type: 'quote', tone: 'cream', text: '', author: '', role: '' }),
    summary: (b) => (b.type === 'quote' ? excerptOf(b.text) : ''),
  },

  legal: {
    label: 'Розділ документа',
    hint: 'Нумерований розділ із підпунктами. Для оферти й політики.',
    fields: [
      { kind: 'number', name: 'number', label: 'Номер розділу', min: 1, max: 99, help: 'На цей номер посилаються в документі й у переписці. Міняти обережно.' },
      { kind: 'text', name: 'heading', label: 'Назва розділу' },
      { kind: 'list', name: 'items', label: 'Підпункти', itemLabel: 'Підпункт', max: 40, fields: [
        { kind: 'text', name: 'n', label: 'Номер', help: 'Наприклад: 7.2.' },
        { kind: 'rich', name: 'text', label: 'Текст', rows: 4, help: RICH_HELP },
      ] },
    ],
    create: (id) => ({ id, type: 'legal', tone: 'plain', number: 1, heading: 'Назва розділу', items: [] }),
    summary: (b) => (b.type === 'legal' ? `${b.number}. ${excerptOf(b.heading)}` : ''),
  },

  printGrid: {
    label: 'Сітка принтів',
    hint: 'Принти з каталогу. Оновлюються самі — редагувати нічого не треба.',
    fields: [
      HEADING,
      { kind: 'select', name: 'source', label: 'Які принти', options: [
        { value: 'latest', label: 'Найновіші' },
        { value: 'ready', label: 'Готові до відправки' },
        { value: 'collection', label: 'З колекції' },
        { value: 'breed', label: 'За породою' },
      ] },
      { kind: 'text', name: 'sourceSlug', label: 'Адреса колекції або породи', help: 'Потрібна, лише якщо вибрано колекцію чи породу. Наприклад: korgi.' },
      { kind: 'number', name: 'limit', label: 'Скільки показати', min: 1, max: 24 },
      { kind: 'text', name: 'moreHref', label: 'Посилання «дивитись усі»', help: 'Наприклад: /prints. Порожньо — посилання не буде.' },
    ],
    create: (id) => ({ id, type: 'printGrid', tone: 'plain', heading: 'Принти', source: 'latest', sourceSlug: '', limit: 8, moreHref: '/prints' }),
    summary: (b) => (b.type === 'printGrid' ? `${excerptOf(b.heading)} · ${b.source}${b.sourceSlug ? ` ${b.sourceSlug}` : ''}` : ''),
  },

  articleList: {
    label: 'Останні статті',
    hint: 'Три-чотири свіжі матеріали. Сам блок нічого не знає про каталог — його можна ставити на будь-яку сторінку.',
    fields: [
      HEADING,
      { kind: 'textarea', name: 'lead', label: 'Підзаголовок', help: 'Необовʼязково. Один рядок під заголовком.' },
      { kind: 'number', name: 'limit', label: 'Скільки показати', min: 1, max: 12 },
      { kind: 'text', name: 'moreHref', label: 'Посилання «усі статті»', help: 'Зазвичай /statti. Порожньо — посилання не буде.' },
    ],
    create: (id) => ({ id, type: 'articleList', tone: 'plain', heading: 'Статті', lead: '', limit: 3, moreHref: '/statti' }),
    summary: (b) => (b.type === 'articleList' ? excerptOf(b.heading) : ''),
  },

  breedStrip: {
    label: 'Смуга порід',
    hint: 'Плитки порід із каталогу. Головний вхід із пошуку.',
    fields: [HEADING, { kind: 'number', name: 'limit', label: 'Скільки показати', min: 1, max: 40 }],
    create: (id) => ({ id, type: 'breedStrip', tone: 'plain', heading: 'Породи', limit: 12 }),
    summary: (b) => (b.type === 'breedStrip' ? excerptOf(b.heading) : ''),
  },

  collectionStrip: {
    label: 'Смуга колекцій',
    hint: 'Плитки колекцій із каталогу.',
    fields: [HEADING, { kind: 'number', name: 'limit', label: 'Скільки показати', min: 1, max: 20 }],
    create: (id) => ({ id, type: 'collectionStrip', tone: 'plum', heading: 'Колекції', limit: 6 }),
    summary: (b) => (b.type === 'collectionStrip' ? excerptOf(b.heading) : ''),
  },
};

/**
 * Порядок у меню «додати блок» — той самий, що в контрактах, але з
 * відсіяними блоками вимкнених модулів.
 *
 * Показати сайту без товарів блок «Сітка принтів» означає запропонувати
 * поставити на сторінку порожнечу. Межа з контрактів працює й тут.
 */
export function addOrderFor(modules: ReadonlySet<'content' | 'shop'>): readonly BlockType[] {
  return BLOCK_TYPES.filter((type) => modules.has(moduleOfBlock(type)));
}

/** Поки сайт один і він торгує — увімкнені обидва модулі. */
export const ADD_ORDER: readonly BlockType[] = addOrderFor(new Set(['content', 'shop']));

/** Новий блок із унікальним id. */
export function createBlock(type: BlockType, existing: readonly string[]): AnyBlock {
  // id має бути стабільним і читабельним: він лишається в JSON назавжди й
  // потрапляє в якорі юридичних розділів.
  let n = 1;
  let id = `${type}-${n}`;
  while (existing.includes(id)) { n += 1; id = `${type}-${n}`; }
  return BLOCK_REGISTRY[type].create(id);
}
