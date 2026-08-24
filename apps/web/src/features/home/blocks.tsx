import Link from 'next/link';
import type { BreedCardDto, CollectionCardDto } from '@dt/contracts';
import { site } from '@/config/site';
import { PrintThumb } from '@/components/print-thumb';

/**
 * Смуга порід. Стоїть одразу під героєм, до каталогу й до всього іншого.
 *
 * Причина: «а мою породу вмієте?» — питання №1, з яким приходять. Ставити
 * його нижче сітки товарів означає змусити людину шукати відповідь на те,
 * з чим вона й прийшла. Остання плитка навмисно веде в бриф — саме там
 * закінчують ті, чиєї породи немає.
 */
export function BreedStrip({ breeds }: { breeds: readonly BreedCardDto[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {breeds.slice(0, 11).map((breed) => (
        <Link
          key={breed.id}
          href={`/breeds/${breed.slug}`}
          className="flex min-h-16 flex-col justify-center rounded-card border border-line bg-surface-raised px-4 py-3 transition hover:border-ink focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <span className="font-medium text-ink">{breed.name}</span>
          {/*
            Нуль принтів — не «порожньо», а «малюємо на замовлення». Це правда
            й це пропозиція; «0 принтів» було б і правдою, і антирекламою.
          */}
          <span className="text-sm text-ink-subtle">
            {breed.printCount > 0
              ? `${breed.printCount} ${plural(breed.printCount, 'принт', 'принти', 'принтів')}`
              : 'малюємо на замовлення'}
          </span>
        </Link>
      ))}
      <Link
        href="/svoya-ideya"
        className="flex min-h-16 flex-col justify-center rounded-card border border-dashed border-accent bg-accent-soft px-4 py-3 transition hover:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <span className="font-medium text-accent-strong">Немає вашої?</span>
        <span className="text-sm text-accent-strong/80">Намалюємо з фото →</span>
      </Link>
    </div>
  );
}

export function CollectionStrip({ collections }: { collections: readonly CollectionCardDto[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {collections.map((collection) => (
        <Link
          key={collection.id}
          href={`/collections/${collection.slug}`}
          className="group flex flex-col rounded-card border border-plum/20 bg-surface p-4 transition hover:border-plum focus:outline-none focus:ring-2 focus:ring-plum"
        >
          <div className="flex gap-2">
            {(collection.previewUrls.length > 0 ? collection.previewUrls : [null, null, null])
              .slice(0, 3)
              .map((url, i) => (
                <div key={i} className="w-1/3">
                  <PrintThumb src={url} alt="" />
                </div>
              ))}
          </div>
          <p className="mt-3 font-display font-bold text-ink group-hover:underline">{collection.title}</p>
          {collection.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-muted">{collection.description}</p>
          )}
          <p className="mt-auto pt-2 text-sm text-ink-subtle">
            {collection.printCount} {plural(collection.printCount, 'принт', 'принти', 'принтів')}
          </p>
        </Link>
      ))}
    </div>
  );
}

/**
 * Три шляхи. Це і є блок про кастомізацію й «принт з 0».
 *
 * Зроблений порівнянням, а не двома окремими рекламними блоками: людина
 * одразу бачить усі три варіанти поруч і розуміє, у який саме вона потрапляє
 * і скільки це коштує. Розділені блоки змушують тримати різницю в голові.
 */
const PATHS = [
  {
    title: 'Готовий принт',
    price: 'від 1 190 ₴',
    time: 'відправка за 1–2 дні, якщо є в наявності',
    text: 'Обираєте з каталогу, виріб, колір і розмір — і оформлюєте одразу на сайті.',
    href: '#новинки',
    cta: 'Дивитись каталог',
    accent: false,
  },
  {
    title: 'Готовий принт + зміни',
    price: 'від 1 190 ₴ + доплата',
    time: 'зазвичай 2–4 дні на правки',
    text: 'Той самий принт, але з вашим текстом, кличкою або в іншому кольорі. Обговорюємо в Telegram.',
    href: '/zayavka',
    cta: 'Написати нам',
    accent: false,
  },
  {
    title: 'Принт з нуля',
    price: 'рахуємо після брифу',
    time: 'від тижня — це проєкт, не покупка',
    text: 'Малюємо саме вашого пса з фото. Портрет, обкладинка, будь-яка ідея. Правки включені.',
    href: '/svoya-ideya',
    cta: 'Заповнити бриф',
    accent: true,
  },
] as const;

export function ThreePaths() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {PATHS.map((path) => (
        <div
          key={path.title}
          className={[
            'flex flex-col rounded-card border p-6',
            path.accent ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
          ].join(' ')}
        >
          <h3 className="font-display text-lg font-bold text-ink">{path.title}</h3>
          <p className={`mt-2 font-display text-lg font-bold ${path.accent ? 'text-accent-ink' : 'text-accent'}`}>
            {path.price}
          </p>
          <p className="text-sm text-ink-muted">{path.time}</p>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted">{path.text}</p>
          <Link
            href={path.href}
            className={[
              'mt-5 flex min-h-11 items-center justify-center rounded-card px-4 text-sm font-semibold transition',
              path.accent ? 'bg-ink text-surface hover:bg-ink/90' : 'border border-line text-ink hover:border-ink',
            ].join(' ')}
          >
            {path.cta}
          </Link>
        </div>
      ))}
    </div>
  );
}

/**
 * Довіра.
 *
 * Перша версія була списком того, що робимо ми: «шиємо самі», «друкуємо»,
 * «оплата через Monobank». Читач не зобовʼязаний перекладати це на свою
 * користь — і не перекладає: чотири заголовки без контексту виглядають як
 * дрібний шрифт унизу договору.
 *
 * Тепер кожна плитка починається з побоювання покупця, а наш процес іде
 * доказом. «Принт не злізе після прання» — це те, чого людина боїться,
 * купуючи футболку з друком за 1 200 грн. «DTF і DTG» — це чому не злізе.
 *
 * Без вигаданих цифр: «10 000 задоволених клієнтів» на бренді, де працює
 * двоє людей, читається як брехня — чесний масштаб продає краще.
 */
const TRUST = [
  {
    title: 'Принт не злізе після прання',
    text: 'Друкуємо DTF і DTG на промисловому обладнанні. Трісне з нашої вини — переробимо або повернемо гроші.',
  },
  {
    title: 'Виріб, який не соромно носити',
    text: 'Шиємо самі, тому відповідаємо і за тканину, і за крій. Друга лінійка — органічна бавовна Native Spirit.',
  },
  {
    title: 'З вами говорить людина',
    text: 'Нас двоє. Ми пишемо самі, підтверджуємо деталі й ведемо замовлення до відправки. Без чат-ботів і черг.',
  },
  {
    title: 'Гроші під захистом банку',
    text: 'Картку вводите на стороні Monobank, не в нас. Списуємо після того, як підтвердили замовлення.',
  },
] as const;

export function TrustRow() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {TRUST.map((item, i) => (
        <div key={item.title} className="rounded-card border border-teal/20 bg-surface p-5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-pill bg-teal text-sm font-bold text-white"
          >
            {i + 1}
          </span>
          <h3 className="mt-3 font-display font-bold text-ink">{item.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{item.text}</p>
        </div>
      ))}
    </div>
  );
}

/** FAQ. Питання зі справжніх розмов, а не з голови. */
export const FAQ_ITEMS = [
  {
    q: 'А мою породу вмієте?',
    a: 'Так. Якщо її ще немає в каталозі — намалюємо з вашого фото. Це окрема послуга «принт з нуля», заповніть бриф, і ми назвемо ціну після того, як подивимось.',
  },
  {
    q: 'Скільки чекати?',
    a: 'Якщо виріб є в наявності — 1–2 дні на друк і відправку. Якщо шиємо під замовлення, строк вказаний у картці товару, зазвичай 5–14 днів. Принт з нуля — від тижня.',
  },
  {
    q: 'Як обрати розмір?',
    a: 'У картці кожного виробу є таблиця замірів — ширина, довжина, рукав. Якщо сумніваєтесь, напишіть у Telegram: підберемо разом, це швидше за повернення.',
  },
  {
    q: 'Чи можна повернути?',
    a: 'Виріб із друком виготовляється під вас, тому повернення «бо передумав» неможливе. Якщо ми помилились із розміром, кольором чи якістю друку — переробимо або повернемо гроші.',
  },
  {
    q: 'Як оплатити?',
    a: 'Карткою через Monobank прямо на сайті. Для замовлень з довгим строком використовуємо утримання: гроші резервуються, а списуються після підтвердження.',
  },
  {
    q: 'Ви доставляєте по Україні?',
    a: 'Так, Новою поштою. Вартість доставки за тарифами перевізника, обговорюємо разом із замовленням у Telegram.',
  },
] as const;

export function Faq() {
  return (
    <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
      {FAQ_ITEMS.map((item) => (
        <div key={item.q}>
          <h3 className="font-medium text-ink">{item.q}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{item.a}</p>
        </div>
      ))}
    </div>
  );
}

/** Широкий блок «своя ідея» — потоку з найбільшим чеком потрібне місце. */
export function CustomBanner() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-accent-ink">Принт з нуля</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
          Намалюємо саме вашого пса
        </h2>
        <p className="mt-3 max-w-prose leading-relaxed text-ink-muted">
          З його вухами, шрамом і виразом морди, який знаєте тільки ви. Портрет,
          обкладинка журналу, будь-яка ідея. Ціну називаємо після того, як
          побачили — робота з нуля буває і на дві години, і на два дні.
        </p>
      </div>
      <div className="flex flex-col gap-3 lg:w-56">
        <Link
          href="/svoya-ideya"
          className="flex min-h-12 items-center justify-center rounded-card bg-ink px-6 text-sm font-semibold text-surface transition hover:bg-ink/90"
        >
          Заповнити бриф
        </Link>
        <a
          href={site.telegramUrl}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-12 items-center justify-center rounded-card border border-accent-strong bg-surface px-6 text-sm font-medium text-accent-ink transition hover:bg-accent-soft"
        >
          Спитати в Telegram
        </a>
      </div>
    </div>
  );
}

/** Українське відмінювання. 1 принт / 2 принти / 5 принтів. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
