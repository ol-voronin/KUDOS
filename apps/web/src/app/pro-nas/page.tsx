import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public-shell';
import { Section } from '@/components/section';
import { ButtonLink } from '@/components/ui';
import { getSettings } from '@/lib/site-settings';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  return {
    title: `Про нас — хто такі Бабака і чому тільки собаки | ${site.brand}`,
    description:
      `Ми Даша й Олексій, раніше — Kudos print. Друкуємо одяг із собаками ${site.cityIn}: `
      + 'принти за породами й портрет саме твого пса з фото.',
    alternates: { canonical: '/pro-nas' },
  };
}

/**
 * «Про нас» — та сама історія, що й у пості-знайомстві в Instagram.
 *
 * Сторінка потрібна не для краси: на неї приходять із реклами люди, які
 * бачать бренд уперше і перед оплатою хочуть знати, що по той бік живі люди
 * з містом, строками й телефоном. Тому під історією — факти, які знімають
 * сумнів, і ті самі числа з налаштувань, що й у FAQ: зміняться в адмінці —
 * зміняться й тут.
 *
 * Фото команди тут поки немає навмисно: порожня рамка «тут буде фото» на
 * живому сайті гірша, ніж її відсутність.
 */
export default async function AboutPage() {
  const site = await getSettings();
  const days = `${site.productionDaysMin}–${site.productionDaysMax}`;
  const shipFree = `${Math.round(site.freeShippingFromMinor / 100).toLocaleString('uk-UA')} ₴`;

  const facts: ReadonlyArray<{ title: string; text: React.ReactNode }> = [
    {
      title: `Друкуємо ${site.cityIn}`,
      text: <>Самі, на одязі, який носимо самі. Відправляємо Новою поштою по всій Україні.</>,
    },
    {
      title: `${days} робочих днів`,
      text: <>Стільки займає друк і відправка готового принта. Малюнок із твого фото — 7–14 днів, бо спершу ескіз і твоє «так».</>,
    },
    {
      title: 'Списуємо лише після підтвердження',
      text: <>Оплата карткою через Monobank: сума блокується, а списується тільки тоді, коли ми підтвердили замовлення. Картку вводиш на стороні банку, не в нас.</>,
    },
    {
      title: `Безкоштовна доставка від ${shipFree}`,
      text: <>А якщо щось не так — є повернення {site.returnDays} днів. Деталі — у <Link href="/faq" className="underline underline-offset-4">частих запитаннях</Link>.</>,
    },
  ];

  return (
    <PublicShell>
      <Section tone="cream">
        <nav aria-label="Хлібні крихти" className="mb-4 text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">Про нас</span>
        </nav>
        <p className="label-eyebrow">раніше — Kudos print</p>
        <h1 className="mt-3 font-display text-4xl font-bold uppercase text-ink md:text-6xl">
          Привіт, <span className="ghost-word">ми</span> <span className="text-accent">Бабака</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-muted">
          Даша й Олексій, {site.city}. Робимо одяг для людей, які люблять своїх собак
          трохи більше, ніж це прийнято показувати.
        </p>
      </Section>

      <Section>
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <p className="label-eyebrow">Як було</p>
            <h2 className="mt-3 text-3xl font-bold uppercase text-ink">
              Друкували <span className="ghost-word">все-все-все</span>
            </h2>
            <p className="mt-4 max-w-prose leading-relaxed text-ink-muted">
              Що попросите, на чому попросите і скільки попросите. Ми дуже старалися бути
              друкарнею на всі випадки життя — і називалися Kudos print.
            </p>
          </div>
          <div>
            <p className="label-eyebrow">Що ми помітили</p>
            <h2 className="mt-3 text-3xl font-bold uppercase text-ink">
              <span className="ghost-word">Але найкраще виходили</span> собаки
            </h2>
            <p className="mt-4 max-w-prose leading-relaxed text-ink-muted">
              З першого дня. Їх ми любили малювати найбільше, і по них до нас приходили
              найчастіше.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="ink">
        <h2 className="text-3xl font-bold uppercase md:text-5xl">Тож ми прибрали зайве</h2>
        <ul className="mt-6 flex flex-col gap-2 text-lg text-ghost-ink">
          <li className="line-through decoration-accent decoration-2">все-все-все</li>
          <li className="line-through decoration-accent decoration-2">понти</li>
        </ul>
        <p className="mt-6 text-2xl font-bold uppercase">
          <span className="text-accent">✓</span> Собаки
        </p>
        <p className="mt-4 max-w-2xl leading-relaxed text-surface/80">
          Робимо те, що любимо й розуміємо. Так з’явилася Бабака.
        </p>
      </Section>

      <Section>
        <p className="label-eyebrow">Команда</p>
        <h2 className="mt-3 text-3xl font-bold uppercase text-ink">Нас четверо</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <article className="rounded-3xl bg-teal-soft p-6 md:p-8">
            <p className="label-eyebrow">муза · модель · контроль якості</p>
            <h3 className="mt-2 font-display text-4xl font-bold uppercase text-ink">Боня</h3>
            <p className="mt-4 leading-relaxed text-ink-muted">
              Перевіряє м’якість кожного худі. Методом лежання. Без її схвалення жодна
              партія не їде.
            </p>
          </article>
          <article className="relative rounded-3xl bg-plum-soft p-6 md:p-8">
            <span className="absolute right-6 top-6 rotate-6 rounded-lg border-2 border-accent px-3 py-1 font-display text-xs font-bold uppercase text-accent">
              Так, він кіт
            </span>
            <p className="label-eyebrow pr-28">внутрішній аудит · відділ кадрів</p>
            <h3 className="mt-2 font-display text-4xl font-bold uppercase text-ink">Паштет</h3>
            <p className="mt-4 leading-relaxed text-ink-muted">
              Єдиний кіт у бренді про собак. Сідає на кожну нову партію і досі не визнає,
              що це гарно.
            </p>
            <p className="mt-3 text-sm text-ink-subtle">* Так, ми теж не знаємо, як так вийшло.</p>
          </article>
        </div>
        <p className="mt-6 max-w-2xl text-ink-muted">
          І ми з Олексієм — малюємо, друкуємо, пакуємо й відповідаємо в Telegram.
        </p>
      </Section>

      <Section tone="cream">
        <p className="label-eyebrow">Що ми тепер робимо</p>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          <li>
            <p className="font-display text-3xl font-bold text-accent">01</p>
            <p className="mt-2 font-medium text-ink">Принти з собаками за породами</p>
            <Link href="/breeds" className="mt-1 inline-block text-sm text-ink-muted underline underline-offset-4">Знайти свою породу</Link>
          </li>
          <li>
            <p className="font-display text-3xl font-bold text-accent">02</p>
            <p className="mt-2 font-medium text-ink">Портрет саме твого пса з фото</p>
            <Link href="/svoya-ideya" className="mt-1 inline-block text-sm text-ink-muted underline underline-offset-4">Як це працює</Link>
          </li>
          <li>
            <p className="font-display text-3xl font-bold text-accent">03</p>
            <p className="mt-2 font-medium text-ink">Друкуємо {site.cityIn}, на одязі, який носимо самі</p>
            <Link href="/vyroby" className="mt-1 inline-block text-sm text-ink-muted underline underline-offset-4">Подивитися вироби</Link>
          </li>
        </ol>
      </Section>

      <Section>
        <h2 className="text-3xl font-bold uppercase text-ink">Чому нам можна довіряти</h2>
        <dl className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((f) => (
            <div key={f.title} className="border-t border-ink pt-4">
              <dt className="font-display font-bold text-ink">{f.title}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-ink-muted">{f.text}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section tone="teal">
        <h2 className="text-3xl font-bold uppercase text-ink">Яка порода в тебе?</h2>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Знайди її в каталозі — або напиши нам, і намалюємо саме твого.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/breeds" size="lg">Обрати породу</ButtonLink>
          <ButtonLink href={site.telegramUrl} variant="outline" size="lg">Написати в Telegram</ButtonLink>
        </div>
      </Section>
    </PublicShell>
  );
}
