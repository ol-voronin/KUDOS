import type { Metadata } from 'next';
import Link from 'next/link';
import { HomeDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { Section } from '@/components/section';
import { PublicLeadForm } from '@/features/leads/public-lead-form';
import { PrintGrid, SectionHead } from '@/features/home/print-card';
import {
  BreedStrip, CollectionStrip, CustomBanner, Faq, FAQ_ITEMS, ThreePaths, TrustRow,
} from '@/features/home/blocks';
import { serverFetchOrNull } from '@/lib/server-api';
import { faqJsonLd, JsonLd } from '@/lib/json-ld';
import { site } from '@/config/site';

export const metadata: Metadata = {
  title: `${site.brand} — одяг з принтом вашої собаки`,
  description:
    `Футболки, худі та світшоти з принтом вашої породи. Готові принти за породами або власний портрет із фото. Шиємо й друкуємо ${site.cityIn}.`,
  alternates: { canonical: '/' },
  openGraph: {
    title: `${site.brand} — одяг з принтом вашої собаки`,
    description: `Готові принти за породами або власний портрет із фото. ${site.city}.`,
    type: 'website',
  },
};

/** Каталог змінюється разів на тиждень — хвилина свіжості тут із запасом. */
export const revalidate = 60;

export default async function HomePage() {
  // Одним запитом: склад головної — рішення сервера, а не збірка на клієнті.
  const home = await serverFetchOrNull('/catalog/home', HomeDto);

  return (
    <PublicShell>
      <JsonLd data={faqJsonLd(FAQ_ITEMS)} />

      {/* ── Герой ─────────────────────────────────────────────────── */}
      <Section tone="cream">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-pill bg-accent-soft px-3 py-1 text-xs font-bold uppercase tracking-[0.11em] text-accent-ink">
              Одяг для людей, а не для собак
            </p>
            <h1 className="font-display text-hero font-bold text-ink">
              Ваш пес — <span className="text-accent">на вашій футболці</span>
            </h1>
            <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-muted">
              Готові принти за породами або власний портрет із фото.
              Шиємо й друкуємо {site.cityIn}, відправляємо по всій Україні.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#породи"
                className="flex min-h-12 items-center rounded-card bg-accent px-6 text-sm font-semibold text-white transition hover:bg-accent-strong"
              >
                Знайти свою породу
              </Link>
              <Link
                href="/svoya-ideya"
                className="flex min-h-12 items-center rounded-card border border-ink px-6 text-sm font-medium text-ink transition hover:bg-ink hover:text-surface"
              >
                Намалювати мого пса
              </Link>
            </div>
          </div>

          <div className="flex aspect-[4/3] items-center justify-center rounded-card border border-accent/25 bg-accent-soft">
            <svg width="112" height="112" viewBox="0 0 96 96" fill="none" aria-hidden="true">
              <circle cx="48" cy="48" r="30" stroke="currentColor" strokeWidth="3" className="text-accent" />
              <circle cx="36" cy="42" r="3.5" fill="currentColor" className="text-accent" />
              <circle cx="60" cy="42" r="3.5" fill="currentColor" className="text-accent" />
              <path d="M40 56c3 3 13 3 16 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-accent" />
              <path d="M24 34c-4-8 2-14 10-10M72 34c4-8-2-14-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-accent" />
            </svg>
          </div>
        </div>
      </Section>

      {/* ── Породи: одразу під героєм, до каталогу ──────────────────── */}
      <Section id="породи">
        <SectionHead
          title="Знайдіть свою породу"
          subtitle="Найчастіше питання, з яким приходять. Відповідь — так, і якщо породи тут немає, намалюємо."
        />
        {home && home.breeds.length > 0
          ? <BreedStrip breeds={home.breeds} />
          : <EmptyBreeds />}
      </Section>

      {/* ── Готові до відправки ────────────────────────────────────── */}
      {home && home.readyToShip.length > 0 && (
        <Section tone="cream">
          <SectionHead
            title="Готові до відправки"
            subtitle="Ці вироби вже є на складі — надрукуємо й відправимо за 1–2 дні, без очікування пошиття."
          />
          <PrintGrid prints={home.readyToShip} />
        </Section>
      )}

      {/* ── Колекції ───────────────────────────────────────────────── */}
      {home && home.collections.length > 0 && (
        <Section tone="plum">
          <SectionHead title="Колекції" subtitle="Не за породою, а за настроєм: портрети, обкладинки, характери." />
          <CollectionStrip collections={home.collections} />
        </Section>
      )}

      {/* ── Нові принти ────────────────────────────────────────────── */}
      <Section id="новинки">
        <SectionHead
          title="Нові принти"
          {...(home && home.totalPrints > home.newPrints.length
            ? { href: '/prints', hrefLabel: `Усі ${home.totalPrints}` }
            : {})}
        />
        {home && home.newPrints.length > 0
          ? <PrintGrid prints={home.newPrints} />
          : <EmptyCatalog />}
      </Section>

      {/* ── Три шляхи: готовий / зміни / з нуля ────────────────────── */}
      <Section tone="cream">
        <SectionHead title="Три способи отримати свій принт" subtitle="Обирайте той, що ближчий — ціни й строки різні." />
        <ThreePaths />
      </Section>

      {/* ── Своя ідея ──────────────────────────────────────────────── */}
      <Section tone="accent">
        <CustomBanner />
      </Section>

      {/* ── Довіра ─────────────────────────────────────────────────── */}
      <Section tone="teal">
        <SectionHead
          title="Що ви отримуєте"
          subtitle="Чотири речі, через які купівля футболки з друком зазвичай і зривається."
        />
        <TrustRow />
      </Section>

      {/* ── Співпраця ──────────────────────────────────────────────── */}
      <Section tone="sun">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-sun-ink">Для бізнесу</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
              Зоомагазин, вет-клініка, грумінг?
            </h2>
            <p className="mt-3 max-w-prose leading-relaxed text-ink-muted">
              Робимо мерч під вашим логотипом, партії від десяти штук, подарунки клієнтам
              і спільні лінійки з притулками. Ціна на опт інша — порахуємо під тираж.
            </p>
          </div>
          <Link
            href="/spivpratsia"
            className="flex min-h-12 items-center justify-center rounded-card bg-ink px-6 text-sm font-semibold text-surface transition hover:bg-ink/90 lg:w-56"
          >
            Умови співпраці
          </Link>
        </div>
      </Section>

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <Section>
        <SectionHead title="Питання, які ставлять найчастіше" />
        <Faq />
      </Section>

      {/* ── Заявка ─────────────────────────────────────────────────── */}
      <Section id="заявка" tone="cream">
        <div className="grid gap-10 rounded-card border border-line bg-surface p-6 sm:p-10 lg:grid-cols-[1fr_minmax(0,24rem)]">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink">Не знайшли свою породу?</h2>
            <p className="mt-3 max-w-prose leading-relaxed text-ink-muted">
              Лишіть телефон — напишемо й розберемось разом. Формулювати ідеально не треба.
            </p>
            <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-muted">
              Якщо ідея вже сформульована, є{' '}
              <Link href="/svoya-ideya" className="font-medium text-ink underline">повний бриф</Link> —
              так ми відповімо точніше й одразу з ціною.
            </p>
          </div>
          <PublicLeadForm source="/" compact />
        </div>
      </Section>
    </PublicShell>
  );
}

/**
 * Порожні стани, які продають.
 *
 * Каталог поки може бути порожнім — реальні принти тільки заводяться. «Нічого
 * не знайдено» на головній виглядає як зламаний сайт; «ми малюємо з нуля» —
 * як пропозиція.
 */
function EmptyBreeds() {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface-sunken p-8 text-center">
      <p className="font-medium text-ink">Каталог порід ще наповнюється</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
        Але це не заважає: ми малюємо принт із фото вашої собаки з нуля, якої б вона не була породи.
      </p>
      <Link
        href="/svoya-ideya"
        className="mt-5 inline-flex min-h-11 items-center rounded-card bg-accent px-5 text-sm font-semibold text-white"
      >
        Замовити свій принт
      </Link>
    </div>
  );
}

function EmptyCatalog() {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface-sunken p-8 text-center">
      <p className="font-medium text-ink">Готові принти зʼявляться найближчим часом</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
        Поки що працюємо під замовлення — напишіть, що вам потрібно, і ми зробимо.
      </p>
      <Link
        href="/zayavka"
        className="mt-5 inline-flex min-h-11 items-center rounded-card bg-accent px-5 text-sm font-semibold text-white"
      >
        Залишити заявку
      </Link>
    </div>
  );
}
