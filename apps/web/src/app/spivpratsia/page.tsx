import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public-shell';
import { Section } from '@/components/section';
import { PublicLeadForm } from '@/features/leads/public-lead-form';
import { site } from '@/config/site';

export const metadata: Metadata = {
  title: `Співпраця та опт — ${site.brand}`,
  description:
    `Оптові партії, мерч під логотипом, подарунки клієнтам. Працюємо із зоомагазинами, вет-клініками, грумінг-салонами та притулками. Шиємо й друкуємо ${site.cityIn}.`,
  alternates: { canonical: '/spivpratsia' },
  openGraph: {
    title: `Співпраця та опт — ${site.brand}`,
    description: 'Партії від 10 штук, мерч під логотипом, спільні лінійки з притулками.',
    type: 'website',
  },
};

/**
 * B2B-сторінка.
 *
 * Окремо від роздрібу навмисно: у зоомагазину інші питання (тираж, строк,
 * закупівельна ціна, чи буде логотип) і інша швидкість рішення. Змішувати
 * це з «намалюємо вашого пса» означає не відповісти жодному з двох.
 *
 * Цін тут немає свідомо: ціна залежить від тиражу й виробу, а фальшива
 * «від 500 грн» приведе розмову до розчарування на другій хвилині.
 */
const AUDIENCES = [
  {
    who: 'Зоомагазини',
    what: 'Партія футболок і худі з популярними породами на полицю. Беремо на себе принти, ви — асортимент і вітрину.',
  },
  {
    who: 'Вет-клініки та грумінг',
    what: 'Форма для команди з вашим логотипом і подарунок клієнту після процедури. Дрібні тиражі — норма, не виняток.',
  },
  {
    who: 'Притулки та зоозахист',
    what: 'Спільна лінійка: ваш підопічний на футболці, частина суми йде притулку. Умови обговорюємо окремо.',
  },
  {
    who: 'Корпоративні подарунки',
    what: 'Мерч для команди чи клієнтів — з вашим макетом або з нашим малюнком під ваш бренд.',
  },
] as const;

const HOW = [
  {
    step: 'Пишете, що потрібно',
    text: 'Виріб, приблизний тираж, строк. Макета може ще не бути — це нормально.',
  },
  {
    step: 'Рахуємо й показуємо',
    text: 'Даємо ціну під тираж і мокап, як це виглядатиме. Безкоштовно й ні до чого не зобовʼязує.',
  },
  {
    step: 'Робимо зразок',
    text: 'На великих партіях спочатку один виріб — щоб ви побачили тканину й друк живцем, а не на екрані.',
  },
  {
    step: 'Друкуємо тираж',
    text: 'Строк називаємо після зразка й тримаємо його. Відправка по Україні.',
  },
] as const;

export default function CooperationPage() {
  return (
    <PublicShell>
      <Section tone="sun">
        <nav aria-label="Хлібні крихти" className="text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">Співпраця</span>
        </nav>

        <h1 className="mt-3 max-w-3xl font-display text-hero font-bold text-ink">
          Опт, мерч і спільні проєкти
        </h1>
        <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-muted">
          Ми маленьке виробництво {site.cityIn}: шиємо самі й друкуємо самі. Через це
          беремося за тиражі, від яких великі цехи відмовляються — від десяти штук,
          з різними розмірами й різними принтами в одній партії.
        </p>
      </Section>

      <Section>
        <h2 className="font-display text-2xl font-bold text-ink">З ким працюємо</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {AUDIENCES.map((item) => (
            <div key={item.who} className="rounded-card border border-line bg-surface p-5">
              <h3 className="font-display font-bold text-ink">{item.who}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{item.what}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="teal">
        <h2 className="font-display text-2xl font-bold text-ink">Як це відбувається</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOW.map((item, i) => (
            <li key={item.step} className="rounded-card border border-teal/20 bg-surface p-5">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-pill bg-teal text-sm font-bold text-white"
              >
                {i + 1}
              </span>
              <h3 className="mt-3 font-display font-bold text-ink">{item.step}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{item.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="cream">
        <div className="grid gap-10 rounded-card border border-line bg-surface p-6 sm:p-10 lg:grid-cols-[1fr_minmax(0,24rem)]">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink">Порахуємо ваш тираж</h2>
            <p className="mt-3 max-w-prose leading-relaxed text-ink-muted">
              Лишіть телефон — зателефонуємо або напишемо в Telegram, як вам зручніше.
              Достатньо приблизно знати виріб і кількість; решту допоможемо визначити.
            </p>
            <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-muted">
              Швидше буде написати одразу в{' '}
              <a
                href={site.telegramUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-ink underline"
              >
                Telegram
              </a>
              {site.phoneDisplay ? <> або подзвонити на {site.phoneDisplay}</> : null}.
            </p>
          </div>
          <PublicLeadForm source="/spivpratsia" compact />
        </div>
      </Section>
    </PublicShell>
  );
}
