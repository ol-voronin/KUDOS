import type { Metadata } from 'next';
import Link from 'next/link';
import { BlobImage } from '@/components/blob-image';
import { BreedListDto, PrintListDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { Section } from '@/components/section';
import { ButtonLink } from '@/components/ui';
import { plural } from '@/features/home/blocks';
import { serverFetchOrNull } from '@/lib/server-api';
import { getSettings } from '@/lib/site-settings';
import { INSTAGRAM_URL } from '@/config/social';

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
 * з містом, строками й телефоном. Тому жарти тут чергуються з фактами, а
 * факти — живі: породи, принти й прев'ю беруться з каталогу, строки й поріг
 * доставки — з налаштувань. Додали породу в адмінці — тут стало на одну більше.
 *
 * Фото команди поки немає навмисно: порожня рамка «тут буде фото» на живому
 * сайті гірша, ніж її відсутність. Обличчя бренду тут — принти.
 */
export default async function AboutPage() {
  const [site, breedsData, printsData] = await Promise.all([
    getSettings(),
    serverFetchOrNull('/catalog/breeds', BreedListDto, 300),
    serverFetchOrNull('/catalog/prints?page=1&perPage=1', PrintListDto, 300),
  ]);
  const breeds = breedsData?.items ?? [];
  const drawn = breeds.filter((b) => b.printCount > 0);
  // Сума `printCount` за породами завищує число: принт із двома породами
  // рахується двічі. Тому беремо `total` самого каталогу принтів.
  const printTotal = printsData?.total ?? 0;
  const gallery = drawn.filter((b) => b.previewUrl !== '').slice(0, 12);

  const days = `${site.productionDaysMin}–${site.productionDaysMax}`;
  const shipFree = `${Math.round(site.freeShippingFromMinor / 100).toLocaleString('uk-UA')} ₴`;

  return (
    <PublicShell>
      {/* ── Привіт ─────────────────────────────────────────────── */}
      <Section tone="cream" className="overflow-hidden">
        <nav aria-label="Хлібні крихти" className="mb-6 text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">Про нас</span>
        </nav>
        <div className="relative">
          <p className="inline-block -rotate-2 rounded-full border-2 border-ink px-4 py-1.5 text-sm font-medium text-ink">
            раніше — <span className="line-through decoration-accent decoration-2">Kudos print</span>
          </p>
          <h1 className="mt-6 font-display text-hero font-bold uppercase text-ink">
            Привіт,<br />
            <span className="ghost-word">ми</span> <span className="wave-underline text-accent">Бабака</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
            Даша й Олексій, {site.city}. Робимо одяг для людей, які люблять своїх собак
            трохи більше, ніж це прийнято показувати на людях.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-dog.svg"
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none mt-10 h-24 w-auto md:absolute md:bottom-0 md:right-0 md:mt-0 md:h-40"
          />
        </div>
      </Section>

      {/* ── Біжучий рядок порід ─────────────────────────────────── */}
      {breeds.length > 0 && (
        <div className="overflow-hidden border-y border-ink bg-ink py-4 text-surface" aria-label="Породи, які ми малюємо">
          <div className="flex w-max animate-marquee gap-8 whitespace-nowrap font-display text-xl font-bold uppercase hover:[animation-play-state:paused] motion-reduce:animate-none">
            {[0, 1].map((copy) => (
              <span key={copy} className="flex gap-8" aria-hidden={copy === 1}>
                {breeds.map((b) => (
                  <Link key={b.id} href={`/breeds/${b.slug}`} tabIndex={copy === 1 ? -1 : undefined} className="flex items-center gap-8 hover:text-accent">
                    {b.name}<span aria-hidden className="text-accent">✦</span>
                  </Link>
                ))}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── До / після ─────────────────────────────────────────── */}
      <Section>
        <p className="label-eyebrow">Як ми сюди дійшли</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-line bg-surface-sunken p-6 md:p-10">
            <p className="font-display text-sm font-bold uppercase text-ghost-ink">До · Kudos print</p>
            <h2 className="mt-3 text-section font-bold uppercase text-ink">
              Друкували <span className="ghost-word">все-все-все</span>
            </h2>
            <p className="mt-4 max-w-prose leading-relaxed text-ink-muted">
              Що попросите, на чому попросите і скільки попросите. Ми дуже старалися бути
              друкарнею на всі випадки життя.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Що ми прибрали">
              {['все-все-все', '«а можна ще й на…»', 'терміново на вчора', 'понти'].map((t, i) => (
                <li
                  key={t}
                  className={`rounded-full border border-ghost-ink px-3 py-1 text-sm text-ghost-ink line-through decoration-accent decoration-2 ${i % 2 === 0 ? '-rotate-2' : 'rotate-2'}`}
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col rounded-3xl bg-ink p-6 text-surface md:p-10" data-cursor="light">
            <p className="font-display text-sm font-bold uppercase text-accent">Після · Бабака</p>
            <h2 className="mt-3 text-section font-bold uppercase">
              Але найкраще в нас завжди виходили собаки
            </h2>
            <p className="mt-4 max-w-prose leading-relaxed text-surface/75">
              З першого дня. Їх ми любили малювати найбільше, і по них до нас приходили
              найчастіше. Тож ми прибрали зайве й лишили те, що любимо й розуміємо.
            </p>
            <p className="mt-auto flex items-center gap-3 pt-8 font-display text-4xl font-bold uppercase md:text-6xl">
              <span aria-hidden className="text-accent">✓</span> Собаки
            </p>
          </div>
        </div>
      </Section>

      {/* ── Цифри ──────────────────────────────────────────────── */}
      <Section tone="sun">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
          {[
            breeds.length > 0 && { n: String(breeds.length), label: `${plural(breeds.length, 'порода', 'породи', 'порід')} у каталозі` },
            printTotal > 0 && { n: String(printTotal), label: `${plural(printTotal, 'принт', 'принти', 'принтів')} із собаками` },
            { n: '1', label: 'кіт (так, ми знаємо)' },
            { n: '0', label: 'понтів' },
          ].filter((x): x is { n: string; label: string } => Boolean(x)).map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd className="font-display text-hero font-bold text-ink">{s.n}</dd>
              <dd className="mt-2 text-ink-muted">{s.label}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ── Штатний розклад ────────────────────────────────────── */}
      <Section>
        <p className="label-eyebrow">Штатний розклад</p>
        <h2 className="mt-3 text-section font-bold uppercase text-ink">
          Нас четверо. <span className="ghost-word">Двоє з нас — не люди.</span>
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { name: 'Боня', role: 'муза · модель · контроль якості', duty: 'Перевіряє м’якість кожного худі. Методом лежання. Без її схвалення жодна партія не їде.', pay: 'смаколики', tone: 'tone-yellow', tilt: '-rotate-1' },
            { name: 'Паштет', role: 'внутрішній аудит · відділ кадрів', duty: 'Єдиний кіт у бренді про собак. Сідає на кожну нову партію і досі не визнає, що це гарно.', pay: 'паштет (очевидно)', tone: 'bg-surface', tilt: 'rotate-1', stamp: 'Так, він кіт' },
            { name: 'Даша', role: 'співзасновниця', duty: 'Вирішує, що ми робимо, як це звучить і чому саме так. Остання інстанція після Боні.', pay: 'задоволення від справи', tone: 'tone-yellow', tilt: 'rotate-1' },
            { name: 'Олексій', role: 'співзасновник', duty: 'Друк, сайт і все, що з проводами. Відповідає, коли щось зламалось, — навіть якщо це зробив Паштет.', pay: 'задоволення від справи', tone: 'bg-surface', tilt: '-rotate-1' },
          ].map((p) => (
            <article key={p.name} className={`relative flex flex-col rounded-3xl border border-ink ${p.tone} p-6 transition-transform duration-300 hover:rotate-0 motion-reduce:transform-none ${p.tilt}`}>
              {/* Дірка під ремінець бейджа — дрібниця, через яку картка читається як посвідчення. */}
              <span aria-hidden className="mx-auto -mt-2 mb-4 block h-2 w-12 rounded-full bg-ink/80" />
              {p.stamp !== undefined && (
                <span className="absolute -right-3 -top-3 rotate-12 rounded-md border-2 border-accent bg-surface px-2 py-0.5 font-display text-[0.7rem] font-bold uppercase text-accent">
                  {p.stamp}
                </span>
              )}
              <p className="label-eyebrow">{p.role}</p>
              <h3 className="mt-2 font-display text-3xl font-bold uppercase text-ink">{p.name}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted">{p.duty}</p>
              <p className="mt-5 border-t border-ink/20 pt-3 text-xs uppercase tracking-label text-ink-subtle">
                Оплата праці: <span className="text-ink">{p.pay}</span>
              </p>
            </article>
          ))}
        </div>
      </Section>

      {/* ── Кого ми вже намалювали ─────────────────────────────── */}
      {gallery.length >= 4 && (
        <Section tone="cream">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-section font-bold uppercase text-ink">
              Кого ми <span className="ghost-word">вже</span> намалювали
            </h2>
            <Link href="/breeds" className="link-sweep text-ink">Усі породи →</Link>
          </div>
          <ul className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {gallery.map((b, i) => (
              <li key={b.id}>
                <Link href={`/breeds/${b.slug}`} className="group block">
                  <span className={`relative block aspect-square overflow-hidden rounded-card border border-line bg-surface transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transform-none ${i % 3 === 1 ? 'rotate-1' : i % 3 === 2 ? '-rotate-1' : ''}`}>
                    <BlobImage src={b.previewUrl} alt={b.name} sizes="(min-width: 1024px) 200px, (min-width: 640px) 25vw, 33vw" className="object-cover" />
                  </span>
                  <span className="mt-2 block truncate text-sm font-medium text-ink">{b.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── Правила ────────────────────────────────────────────── */}
      <Section tone="ink">
        <p className="label-eyebrow text-surface/60">Правила Бабаки</p>
        <ol className="mt-8 divide-y divide-surface/15 border-y border-surface/15">
          {[
            ['Тільки собаки.', 'Паштет — виняток, а не правило.'],
            [`Друкуємо самі, ${site.cityIn}.`, 'На одязі, який носимо самі.'],
            ['Немає твоєї породи — намалюємо.', 'Портрет саме твого пса з фото.'],
            ['Без понтів.', 'Чесні строки, чесні фото, відповідаємо людською мовою.'],
          ].map(([rule, note], i) => (
            <li key={rule} className="grid gap-2 py-6 md:grid-cols-[6rem_1fr_1fr] md:items-baseline">
              <span className="font-display text-3xl font-bold text-accent">{String(i + 1).padStart(2, '0')}</span>
              <span className="font-display text-2xl font-bold uppercase">{rule}</span>
              <span className="text-surface/70">{note}</span>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── Дрібний шрифт великими літерами ───────────────────── */}
      <Section>
        <h2 className="text-section font-bold uppercase text-ink">
          Дрібний шрифт, <span className="ghost-word">який ми пишемо великим</span>
        </h2>
        <dl className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: `${days} робочих днів`, d: <>На друк і відправку готового принта. Принт із твого фото — так само: спершу ескіз і твоє «так».</> },
            { t: 'Оплата після розмови', d: <>Спершу заявка: менеджер напише протягом години, уточнить деталі й надішле рахунок — за реквізитами або посиланням Monobank.</> },
            { t: `Доставка безкоштовна від ${shipFree}`, d: <>Новою поштою по всій Україні.</> },
            { t: `${site.returnDays} днів на повернення`, d: <>Деталі й винятки — у <Link href="/faq" className="underline underline-offset-4">частих запитаннях</Link>.</> },
          ].map((f) => (
            <div key={f.t} className="border-t-2 border-ink pt-4">
              <dt className="font-display text-lg font-bold uppercase leading-tight text-ink">{f.t}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-ink-muted">{f.d}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ── Заклик ─────────────────────────────────────────────── */}
      <Section tone="teal">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-hero font-bold uppercase text-ink">
              Яка порода <span className="ghost-word">в тебе?</span>
            </h2>
            <p className="mt-4 max-w-xl text-ink-muted">
              Знайди її в каталозі — або напиши нам, і намалюємо саме твого. Паштет перевірить.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/breeds" size="lg">Обрати породу</ButtonLink>
            <ButtonLink href={site.telegramUrl} variant="outline" size="lg">Написати в Telegram</ButtonLink>
            {INSTAGRAM_URL !== '' && (
              <ButtonLink href={INSTAGRAM_URL} variant="outline" size="lg">Боня й Паштет в Instagram</ButtonLink>
            )}
          </div>
        </div>
      </Section>
    </PublicShell>
  );
}
