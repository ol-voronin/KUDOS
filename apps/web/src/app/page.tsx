import type { Metadata } from 'next';
import Link from 'next/link';
import { HomeDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
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
    'Футболки, худі та світшоти з принтом вашої породи. Готові принти за породами або власний портрет із фото. Шиємо й друкуємо в Києві.',
  alternates: { canonical: '/' },
  openGraph: {
    title: `${site.brand} — одяг з принтом вашої собаки`,
    description: 'Готові принти за породами або власний портрет із фото. Київ.',
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
      <section className="mx-auto max-w-6xl px-6 pt-12 md:pt-16">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.11em] text-ink-subtle">
              Одяг для людей, а не для собак
            </p>
            <h1 className="font-display text-hero font-bold text-ink">Ваш пес — на вашій футболці</h1>
            <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-muted">
              Готові принти за породами або власний портрет із фото. Друкуємо в Києві, шиємо самі.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#породи"
                className="flex min-h-12 items-center rounded-card bg-ink px-6 text-sm font-semibold text-surface transition hover:bg-ink/90"
              >
                Знайти свою породу
              </Link>
              <Link
                href="/svoya-ideya"
                className="flex min-h-12 items-center rounded-card border border-line px-6 text-sm font-medium text-ink transition hover:border-ink"
              >
                Свій принт із фото
              </Link>
            </div>
          </div>

          <div className="flex aspect-[4/3] items-center justify-center rounded-card border border-line bg-surface-sunken">
            <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true">
              <circle cx="48" cy="48" r="30" stroke="currentColor" strokeWidth="3" className="text-accent" />
              <circle cx="36" cy="42" r="3.5" fill="currentColor" className="text-accent" />
              <circle cx="60" cy="42" r="3.5" fill="currentColor" className="text-accent" />
              <path d="M40 56c3 3 13 3 16 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-accent" />
              <path d="M24 34c-4-8 2-14 10-10M72 34c4-8-2-14-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-accent" />
            </svg>
          </div>
        </div>
      </section>

      {/* ── Породи: одразу під героєм, до каталогу ──────────────────── */}
      <section id="породи" className="mx-auto max-w-6xl px-6 pt-16 md:pt-20">
        <SectionHead
          title="Знайдіть свою породу"
          subtitle="Найчастіше питання, з яким приходять. Відповідь — так, і якщо породи тут немає, намалюємо."
        />
        {home && home.breeds.length > 0
          ? <BreedStrip breeds={home.breeds} />
          : <EmptyBreeds />}
      </section>

      {/* ── Готові до відправки ────────────────────────────────────── */}
      {home && home.readyToShip.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pt-16 md:pt-20">
          <SectionHead
            title="Готові до відправки"
            subtitle="Ці вироби вже є на складі — надрукуємо й відправимо за 1–2 дні, без очікування пошиття."
          />
          <PrintGrid prints={home.readyToShip} />
        </section>
      )}

      {/* ── Колекції ───────────────────────────────────────────────── */}
      {home && home.collections.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pt-16 md:pt-20">
          <SectionHead title="Колекції" subtitle="Не за породою, а за настроєм: портрети, обкладинки, характери." />
          <CollectionStrip collections={home.collections} />
        </section>
      )}

      {/* ── Нові принти ────────────────────────────────────────────── */}
      <section id="новинки" className="mx-auto max-w-6xl px-6 pt-16 md:pt-20">
        <SectionHead
          title="Нові принти"
          {...(home && home.totalPrints > home.newPrints.length
            ? { href: '/prints', hrefLabel: `Усі ${home.totalPrints}` }
            : {})}
        />
        {home && home.newPrints.length > 0
          ? <PrintGrid prints={home.newPrints} />
          : <EmptyCatalog />}
      </section>

      {/* ── Три шляхи: готовий / зміни / з нуля ────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-16 md:pt-20">
        <SectionHead title="Три способи отримати свій принт" subtitle="Обирайте той, що ближчий — ціни й строки різні." />
        <ThreePaths />
      </section>

      {/* ── Своя ідея ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-16 md:pt-20">
        <CustomBanner />
      </section>

      {/* ── Довіра ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-16 md:pt-20">
        <TrustRow />
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-16 md:pt-20">
        <SectionHead title="Питання, які ставлять найчастіше" />
        <Faq />
      </section>

      {/* ── Заявка ─────────────────────────────────────────────────── */}
      <section id="заявка" className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="grid gap-10 rounded-card border border-line bg-surface-raised p-6 sm:p-10 lg:grid-cols-[1fr_minmax(0,24rem)]">
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
      </section>
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
        className="mt-5 inline-flex min-h-11 items-center rounded-card bg-ink px-5 text-sm font-semibold text-surface"
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
        className="mt-5 inline-flex min-h-11 items-center rounded-card bg-ink px-5 text-sm font-semibold text-surface"
      >
        Залишити заявку
      </Link>
    </div>
  );
}
