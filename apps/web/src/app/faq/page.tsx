import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public-shell';
import { Section } from '@/components/section';
import { ButtonLink } from '@/components/ui';
import { faqJsonLd, JsonLd } from '@/lib/json-ld';
import { getSettings } from '@/lib/site-settings';
import { RETURN_POLICY_TEXT } from '@/config/returns';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  return {
    title: `Часті запитання — розміри, строки, доставка, повернення | ${site.brand}`,
    description:
      'Відповіді на головні питання: як обрати розмір, скільки чекати, як оплатити, '
      + 'що з поверненням, як доглядати за принтом і як замовити малюнок зі свого фото.',
    alternates: { canonical: '/faq' },
  };
}

/**
 * Окрема сторінка частих запитань (прохання Олексія).
 *
 * На головній лишається короткий FAQ-блок — це вітрина. Ця сторінка —
 * довідник: повніший, з якорями з шапки, і з розміткою FAQPage, за яку
 * Google вміє показувати відповіді просто у видачі.
 *
 * Числа (строки, поріг доставки, дні повернення) беруться з налаштувань
 * сайту, а не вписані в текст: зміняться в адмінці — зміняться й тут.
 */
export default async function FaqPage() {
  const site = await getSettings();
  const shipFree = `${Math.round(site.freeShippingFromMinor / 100).toLocaleString('uk-UA')} ₴`;
  const days = `${site.productionDaysMin}–${site.productionDaysMax}`;

  const groups: ReadonlyArray<{ title: string; items: ReadonlyArray<{ q: string; a: React.ReactNode; plain: string }> }> = [
    {
      title: 'Замовлення і строки',
      items: [
        {
          q: 'Скільки чекати на замовлення?',
          plain: `Готовий принт із каталогу — ${days} робочих днів на друк і відправку. Малюнок із вашого фото — 7–14 робочих днів: спершу ескіз і ваше «так», потім друк.`,
          a: <>Готовий принт із каталогу — {days} робочих днів на друк і відправку. Малюнок із твого фото — 7–14 робочих днів: спершу ескіз і твоє «так», потім друк.</>,
        },
        {
          q: 'Як оплатити?',
          plain: 'Після оформлення ми звіряємо наявність і надсилаємо рахунок — оплата карткою через Monobank. Гроші блокуються і списуються лише після підтвердження замовлення.',
          a: <>Після оформлення ми звіряємо наявність і надсилаємо рахунок — оплата карткою через Monobank. Картку вводиш на стороні банку, не в нас; гроші блокуються й списуються лише після того, як ми підтвердили замовлення.</>,
        },
        {
          q: 'Чи можна купити річ без принта?',
          plain: 'Так. Кожен виріб продається і чистим — розділ «Базовий одяг». А будь-який принт із каталогу можна поставити на будь-яку річ.',
          a: <>Так. Кожен виріб продається і чистим — дивись розділ <Link href="/vyroby" className="underline underline-offset-4">«Базовий одяг»</Link>. І навпаки: будь-який принт із каталогу лягає на будь-яку річ з асортименту.</>,
        },
      ],
    },
    {
      title: 'Розміри',
      items: [
        {
          q: 'Як обрати розмір?',
          plain: 'У картці кожного виробу є таблиця замірів: ширина, довжина, рукав — і як їх знімати. Якщо сумніваєтесь, напишіть у Telegram, підберемо разом.',
          a: <>У картці кожного виробу є таблиця замірів — ширина, довжина, рукав, і як їх знімати з речі, яка добре сидить. Сумніваєшся — напиши в <a href={site.telegramUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">Telegram</a>: підберемо разом, це швидше за повернення.</>,
        },
        {
          q: 'А якщо мого розміру немає?',
          plain: 'Виготовляємо самі, тому багато що можемо зробити під вас. Напишіть нам, порахуємо.',
          a: <>Виготовляємо самі, тому багато що можемо зробити під тебе. Залиш <Link href="/zayavka" className="underline underline-offset-4">заявку</Link> — порахуємо.</>,
        },
      ],
    },
    {
      title: 'Доставка',
      items: [
        {
          q: 'Як і скільки їде доставка?',
          plain: `Нова пошта — відділення, поштомат або кур'єр, по всій Україні. Замовлення від ${shipFree} доставляємо своїм коштом, менші — за тарифами перевізника.`,
          a: <>Нова пошта — на відділення, в поштомат або курʼєром, по всій Україні. Замовлення від {shipFree} доставляємо за свій рахунок, менші — за тарифами перевізника.</>,
        },
      ],
    },
    {
      title: 'Повернення й гарантія',
      items: [
        {
          q: 'Чи можна повернути або обміняти?',
          plain: `${RETURN_POLICY_TEXT.join(' ')} Базовий одяг можна повернути протягом ${site.returnDays} днів, якщо річ не носили і збережено вигляд.`,
          a: (
            <>
              Обміняти чи повернути можна лише базовий одяг — без принта: {site.returnDays} днів,
              якщо річ не носили й збережено вигляд. Одяг із принтами виготовляється під
              замовлення: ми не тримаємо всі принти в усіх розмірах і кольорах, а робимо кожну
              річ під конкретний виріб, розмір, колір і принт — обміняти її просто нема на що.
              Якщо ж річ неналежної якості або є брак — повернемо гроші чи поміняємо, і зворотна
              пересилка за наш рахунок.
            </>
          ),
        },
        {
          q: 'Принт не потріскається після прання?',
          plain: 'Друк DTF/DTG на промисловому обладнанні: принт не тріскається і не злазить. Трісне з нашої вини — переробимо або повернемо гроші.',
          a: <>Друкуємо DTF або DTG на промисловому обладнанні — принт не тріскається й не злазить після прання. Якщо трісне з нашої вини — переробимо або повернемо гроші.</>,
        },
        {
          q: 'Як доглядати за річчю з принтом?',
          plain: 'Прати при 30 °C навиворіт, без відбілювача. Не сушити в машині. Прасувати з вивороту або через тканину, не по принту.',
          a: <>Прати при 30 °C навиворіт, без відбілювача. Не сушити в машині. Прасувати з вивороту або через тканину — не по принту.</>,
        },
      ],
    },
    {
      title: 'Свій пес на речі',
      items: [
        {
          q: 'А мою породу вмієте?',
          plain: 'Так. Якщо її ще немає в каталозі — намалюємо з вашого фото: заповніть бриф «Свій принт», назвемо ціну після перегляду фото.',
          a: <>Так. Обери у <Link href="/breeds" className="underline underline-offset-4">каталозі за породами</Link> — а якщо твоєї ще немає, намалюємо з фото: заповни <Link href="/svoya-ideya" className="underline underline-offset-4">бриф «Свій принт»</Link>.</>,
        },
        {
          q: 'Сподобався принт, але пес не той — можна зі своїм?',
          plain: 'Так: надішліть 2–3 фото свого собаки — зробимо цей самий принт з його мордочкою. Доплата 200 ₴, строк той самий.',
          a: <>Так: надішли 2–3 фото свого хвостика — зробимо той самий принт із його мордочкою. Доплата 200 ₴, строк той самий. Кнопка є в картці кожного принта.</>,
        },
      ],
    },
  ];

  const flat = groups.flatMap((g) => g.items.map((i) => ({ q: i.q, a: i.plain })));

  return (
    <PublicShell>
      <JsonLd data={faqJsonLd(flat)} />
      <Section tone="cream">
        <nav aria-label="Хлібні крихти" className="mb-4 text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">Часті запитання</span>
        </nav>
        <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">Часті запитання</h1>
        <p className="mt-4 max-w-2xl text-ink-muted">
          Все, що зазвичай питають перед першим замовленням. Не знайшлось твого питання —
          напиши в <a href={site.telegramUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">Telegram</a>,
          відповідаємо швидко.
        </p>
      </Section>

      {groups.map((group) => (
        <Section key={group.title}>
          <h2 className="font-display text-2xl font-bold text-ink">{group.title}</h2>
          <div className="mt-4 max-w-3xl divide-y divide-line border-y border-line">
            {group.items.map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="flex cursor-pointer items-center justify-between gap-3 font-medium text-ink">
                  {item.q}
                  <span aria-hidden className="text-ink-subtle transition-transform group-open:rotate-180">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </Section>
      ))}

      <Section tone="teal">
        <h2 className="font-display text-2xl font-bold text-ink">Лишилось питання?</h2>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Напиши — розкажемо, підкажемо з розміром і покажемо, як виглядатиме принт на твоїй речі.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={site.telegramUrl} size="lg">Написати в Telegram</ButtonLink>
          <ButtonLink href="/zayavka" variant="outline" size="lg">Залишити заявку</ButtonLink>
        </div>
      </Section>
    </PublicShell>
  );
}
