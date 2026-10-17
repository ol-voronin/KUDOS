import type { Metadata } from 'next';
import Link from 'next/link';
import { BreedListDto, RangeDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { Section } from '@/components/section';
import { ButtonLink } from '@/components/ui';
import { PublicLeadForm } from '@/features/leads/public-lead-form';
import { plural } from '@/features/home/blocks';
import { faqJsonLd, JsonLd } from '@/lib/json-ld';
import { serverFetchOrNull } from '@/lib/server-api';
import { getSettings } from '@/lib/site-settings';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  return {
    title: `Опт і мерч для кінологів, вет-клінік, притулків і dog-спільнот | ${site.brand}`,
    description:
      'Футболки, худі й світшоти з собаками або вашим логотипом — від 10 штук, різні розміри й принти '
      + `в одній партії. Друкуємо ${site.cityIn}. Розрахунок і мокап безкоштовно.`,
    alternates: { canonical: '/opt' },
  };
}

/**
 * Опт / B2B — для тих, хто працює з собаками.
 *
 * Сторінка, на яку веде пошукова реклама на кінологів, вет-клініки,
 * грумерів, притулки й клуби. Людина тут не купує в кошик, а лишає заявку —
 * тому головна дія на кожному екрані одна: «Порахувати тираж» (якір на
 * форму), а Telegram — запасний шлях для тих, кому форми не до душі.
 *
 * Ціни за тираж тут свідомо немає: вона залежить від виробу, кількості й
 * друку, і будь-яке «від» на сторінці або бреше, або відлякує. Обіцяємо
 * тільки те, що тримаємо: від 10 штук, змішані розміри й принти, зразок,
 * безкоштовний розрахунок із мокапом.
 *
 * Асортимент і кількість порід — живі, з каталогу: додали виріб в адмінці —
 * він тут.
 *
 * Стара CMS-сторінка `/spivpratsia` переадресовується сюди (next.config).
 */

const AUDIENCES: ReadonlyArray<{ title: string; tone: string; lead: string; items: readonly string[] }> = [
  {
    title: 'Кінологи й школи дресирування',
    tone: 'tone-yellow',
    lead: 'Щоб на майданчику було видно, хто тренер, а випускники носили школу з гордістю.',
    items: ['форма для тренерів і помічників', 'футболки випускникам курсу — «диплом, який носять»', 'мерч школи для учнів і їхніх родин'],
  },
  {
    title: 'Ветеринарні клініки',
    tone: 'bg-surface-sunken',
    lead: 'Форма, яка не лякає ні пацієнтів, ні їхніх людей.',
    items: ['футболки й світшоти для команди з вашим логотипом', 'подарунок клієнту після операції чи першої вакцинації', 'мерч на рецепції — порода пацієнта на футболці'],
  },
  {
    title: 'Грумінг-салони',
    tone: 'tone-yellow',
    lead: 'Красиво стрижете — красиво й виглядайте.',
    items: ['форма майстрів', 'подарунок постійним клієнтам', 'футболка з портретом «до / після» вашого улюбленого клієнта'],
  },
  {
    title: 'Притулки й зоозахист',
    tone: 'bg-surface-sunken',
    lead: 'Ваші підопічні на футболках — і гроші на їхній корм.',
    items: ['благодійна лінійка з портретами підопічних', 'футболки для волонтерів на акції та виїзди', 'подяка донорам і опікунам'],
  },
  {
    title: 'Клуби порід і dog-спільноти',
    tone: 'bg-surface-sunken',
    lead: 'Виставки, змагання, канікрос, зустрічі — щоб свої впізнавали своїх.',
    items: ['командна форма на змагання й виставки', 'мерч клубу породи з нашим малюнком', 'футболки з кличками собак учасників'],
  },
  {
    title: 'Зоомагазини й pet-бренди',
    tone: 'bg-surface-sunken',
    lead: 'Готові принти за породами — на полицю або в подарунок до замовлення.',
    items: ['партія з популярними породами на продаж', 'мерч під ваш бренд', 'подарунки клієнтам і партнерам'],
  },
];

const STEPS: ReadonlyArray<{ title: string; text: string }> = [
  { title: 'Пишете, що потрібно', text: 'Виріб, приблизний тираж, строк. Макета може ще не бути — це нормально, допоможемо.' },
  { title: 'Рахуємо й показуємо мокап', text: 'Ціна під ваш тираж і картинка, як це виглядатиме. Безкоштовно й ні до чого не зобовʼязує.' },
  { title: 'Робимо зразок', text: 'На великих партіях спочатку один виріб — щоб ви побачили тканину й друк живцем, а не на екрані.' },
  { title: 'Друкуємо й відправляємо', text: 'Строк називаємо після зразка й тримаємо його. Відправка Новою поштою по всій Україні.' },
];

export default async function OptPage() {
  const [site, range, breedsData] = await Promise.all([
    getSettings(),
    serverFetchOrNull('/catalog/range', RangeDto, 300),
    serverFetchOrNull('/catalog/breeds', BreedListDto, 300),
  ]);
  const garments = range?.garments ?? [];
  const breedCount = breedsData?.items.length ?? 0;

  const faq: ReadonlyArray<{ q: string; a: string }> = [
    { q: 'Який мінімальний тираж?', a: 'Від 10 штук. Розміри, кольори й навіть принти в одній партії можна змішувати — 10 штук не означає 10 однакових.' },
    { q: 'Скільки коштує?', a: 'Залежить від виробу, кількості й друку. Напишіть виріб і приблизну кількість — порахуємо й покажемо мокап безкоштовно.' },
    { q: 'Можна з нашим логотипом?', a: 'Так. Надішліть логотип у будь-якому вигляді — якщо треба, підготуємо його до друку. Можна поєднати логотип із нашим малюнком собаки.' },
    { q: 'А якщо макета немає зовсім?', a: `Намалюємо. У нас уже є принти для ${breedCount > 0 ? `${breedCount} ${plural(breedCount, 'породи', 'порід', 'порід')}` : 'багатьох порід'}, а нову породу чи конкретного пса малюємо з фото.` },
    { q: 'Можна спершу подивитися зразок?', a: 'Так, на великих партіях спершу робимо один виріб, щоб ви побачили тканину й друк наживо.' },
    { q: 'Як швидко?', a: 'Точний строк називаємо після розрахунку й зразка — він залежить від тиражу. Якщо у вас дата (виставка, змагання, відкриття), скажіть одразу.' },
    { q: 'Ви працюєте з притулками на інших умовах?', a: 'Так, для притулків і зоозахисту умови обговорюємо окремо — зокрема благодійні лінійки, де частина суми йде притулку.' },
  ];

  return (
    <PublicShell>
      <JsonLd data={faqJsonLd(faq)} />

      {/* ── Обкладинка ─────────────────────────────────────────── */}
      <Section tone="cream">
        <nav aria-label="Хлібні крихти" className="mb-6 text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">Опт і мерч</span>
        </nav>
        <p className="label-eyebrow">Опт · B2B · мерч</p>
        <h1 className="mt-3 max-w-5xl font-display text-hero font-bold uppercase text-ink">
          Мерч із собаками <span className="ghost-word">для тих, хто працює</span> <span className="wave-underline text-accent">з собаками</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">
          Кінологи, вет-клініки, грумери, притулки, клуби порід. Друкуємо самі {site.cityIn} —
          тому беремося за тиражі від 10 штук, з різними розмірами й принтами в одній партії.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="#rozrakhunok" size="lg">Порахувати тираж</ButtonLink>
          <ButtonLink href={site.telegramUrl} variant="outline" size="lg">Написати в Telegram</ButtonLink>
        </div>
        <dl className="mt-12 grid grid-cols-2 gap-6 border-t border-ink pt-8 md:grid-cols-4">
          {[
            { n: '10+', l: 'штук — мінімальна партія' },
            { n: String(garments.length > 0 ? garments.length : 7), l: 'виробів на вибір' },
            { n: breedCount > 0 ? String(breedCount) : '30+', l: 'порід уже намальовано' },
            { n: '0 ₴', l: 'розрахунок і мокап' },
          ].map((s) => (
            <div key={s.l}>
              <dt className="sr-only">{s.l}</dt>
              <dd className="font-display text-4xl font-bold text-ink md:text-5xl">{s.n}</dd>
              <dd className="mt-1 text-sm text-ink-muted">{s.l}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ── Для кого ───────────────────────────────────────────── */}
      <Section>
        <p className="label-eyebrow">Для кого</p>
        <h2 className="mt-3 text-section font-bold uppercase text-ink">
          Знайдіть себе <span className="ghost-word">— і що зазвичай замовляють</span>
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {AUDIENCES.map((a) => (
            <article key={a.title} className={`flex flex-col rounded-3xl ${a.tone} p-6 md:p-8`}>
              <h3 className="font-display text-xl font-bold uppercase leading-tight text-ink">{a.title}</h3>
              <p className="mt-3 text-ink-muted">{a.lead}</p>
              <ul className="mt-5 flex flex-col gap-2 border-t border-ink/15 pt-4 text-sm text-ink">
                {a.items.map((i) => (
                  <li key={i} className="flex gap-2"><span aria-hidden className="text-accent">✦</span>{i}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      {/* ── Що друкуємо ────────────────────────────────────────── */}
      <Section tone="ink">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="label-eyebrow text-surface/60">Що друкуємо</p>
            <h2 className="mt-3 text-section font-bold uppercase">Три варіанти малюнка</h2>
            <ol className="mt-8 flex flex-col gap-6">
              {[
                ['Ваш логотип', 'Надішліть у будь-якому вигляді — підготуємо до друку.'],
                ['Наш малюнок', `Готові принти для ${breedCount > 0 ? breedCount : 'десятків'} ${plural(breedCount || 30, 'породи', 'порід', 'порід')} або новий — з фото вашого пса, підопічного чи талісмана клубу.`],
                ['Разом', 'Логотип + собака, клички учасників, номери на спині для змагань.'],
              ].map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[4rem_1fr] gap-2">
                  <span className="font-display text-3xl font-bold text-accent">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <span className="block font-display text-lg font-bold uppercase">{t}</span>
                    <span className="mt-1 block text-surface/70">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          {garments.length > 0 && (
            <div>
              <p className="label-eyebrow text-surface/60">На чому друкуємо</p>
              <ul className="mt-6 divide-y divide-surface/15 border-y border-surface/15">
                {garments.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-4">
                    <Link href={`/vyroby/${g.slug}`} className="font-medium hover:text-accent">{g.name}</Link>
                    <span className="text-sm text-surface/60">
                      {[
                        g.fabrics.map((f) => f.name).join(' / '),
                        g.colours.length > 0 ? `${g.colours.length} ${plural(g.colours.length, 'колір', 'кольори', 'кольорів')}` : '',
                        g.sizes.length > 0 ? `${g.sizes[0]?.label}–${g.sizes[g.sizes.length - 1]?.label}` : '',
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-surface/60">Розміри, кольори й вироби в одній партії можна змішувати.</p>
            </div>
          )}
        </div>
      </Section>

      {/* ── Як працюємо ────────────────────────────────────────── */}
      <Section tone="teal">
        <p className="label-eyebrow">Як це відбувається</p>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t-2 border-ink pt-4">
              <span className="font-display text-3xl font-bold text-accent">{String(i + 1).padStart(2, '0')}</span>
              <p className="mt-2 font-display text-lg font-bold uppercase leading-tight text-ink">{s.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── Притулкам окремо ───────────────────────────────────── */}
      <Section>
        <div className="grid items-center gap-8 rounded-3xl border-2 border-ink p-6 md:grid-cols-[1.5fr_1fr] md:p-12">
          <div>
            <p className="label-eyebrow">Притулкам і зоозахисту</p>
            <h2 className="mt-3 text-section font-bold uppercase text-ink">
              Благодійна лінійка <span className="ghost-word">з вашими підопічними</span>
            </h2>
            <p className="mt-4 max-w-prose leading-relaxed text-ink-muted">
              Малюємо підопічних притулку, робимо з них лінійку — і частина суми з кожної проданої
              речі йде вам. Люди отримують футболку з собакою, якій допомогли, а собака — корм і
              шанс, що її побачать майбутні господарі. Умови обговорюємо окремо під кожен притулок.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <ButtonLink href="#rozrakhunok" size="lg">Обговорити лінійку</ButtonLink>
            <ButtonLink href={site.telegramUrl} variant="outline" size="lg">Написати в Telegram</ButtonLink>
          </div>
        </div>
      </Section>

      {/* ── Питання ────────────────────────────────────────────── */}
      <Section tone="cream">
        <h2 className="text-section font-bold uppercase text-ink">Часті питання про опт</h2>
        <div className="mt-6 max-w-3xl divide-y divide-line border-y border-line">
          {faq.map((item) => (
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

      {/* ── Заявка ─────────────────────────────────────────────── */}
      <Section id="rozrakhunok">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-section font-bold uppercase text-ink md:text-5xl">
              Порахуємо <span className="ghost-word">ваш</span> тираж
            </h2>
            <p className="mt-5 max-w-xl leading-relaxed text-ink-muted">
              Лишіть імʼя й телефон, а в коментарі — хто ви, виріб і приблизну кількість. Зателефонуємо
              або напишемо в Telegram, як зручніше, з ціною й мокапом.
            </p>
            <p className="mt-4 text-ink-muted">
              Швидше — одразу в <a href={site.telegramUrl} target="_blank" rel="noreferrer" className="font-medium text-ink underline underline-offset-4">Telegram</a>
              {' '}або за телефоном <a href={`tel:${site.phone}`} className="font-medium text-ink underline underline-offset-4">{site.phoneDisplay}</a>.
            </p>
          </div>
          <div className="rounded-card border border-line bg-surface-raised p-6 sm:p-8">
            <PublicLeadForm source="/opt" />
          </div>
        </div>
      </Section>
    </PublicShell>
  );
}
