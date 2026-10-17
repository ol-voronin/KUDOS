import type { Metadata } from 'next';
import Link from 'next/link';
import { BreedListDto, formatUAH, minor, PrintListDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { Section } from '@/components/section';
import { ButtonLink } from '@/components/ui';
import { PrintGrid, SectionHead } from '@/features/home/print-card';
import { plural } from '@/features/home/blocks';
import { LIST } from '@/features/analytics/lists';
import { NP_TARIFF_ESTIMATE, returnLine } from '@/config/order-terms';
import { serverFetchOrNull } from '@/lib/server-api';
import { breadcrumbJsonLd, collectionPageJsonLd, faqJsonLd, JsonLd } from '@/lib/json-ld';
import { freeShippingLabel, getSettings } from '@/lib/site-settings';

/**
 * Посадкова «Одяг з собаками».
 *
 * Навіщо окрема сторінка, якщо є `/prints`. Загальний запит («одяг з
 * собаками», «худі з собаками», «футболки с собаками») — це ≈420 пошуків на
 * місяць, найбільший кошик після такси (`ads/category-demand-2026-10-17`).
 * `/prints` — це каталог із фільтрами: H1 «Усі принти», жодного слова про
 * собак у заголовку й нуль тексту, тож Google не мав за що віднести його до
 * цього запиту. Тут — заголовок рівно під запит, пояснення людською мовою,
 * входи за породою і за виробом та відповіді на питання перед покупкою.
 *
 * Числа (принти, породи, ціна «від», строк, поріг доставки) — з каталогу й
 * налаштувань сайту, не вписані руками: зʼявиться 85-й принт — зміниться й тут.
 */

const BASE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';
const PATH = '/odyag-z-sobakamy';
const GRID_SIZE = 24;

/** Породи з найбільшим попитом у пошуку (Keyword Planner, 17.10.2026), у порядку попиту. */
const TOP_BREEDS = ['taksa', 'doberman', 'mops', 'shpits', 'frantsuzkyi-buldog', 'korgi'] as const;

/** Вироби: фільтр каталогу, а ціни на картках сервер рахує саме для обраного виробу. */
const GARMENTS = [
  { type: 'TSHIRT', label: 'Футболки з собаками' },
  { type: 'HOODIE', label: 'Худі з собаками' },
  { type: 'SWEATSHIRT', label: 'Світшоти з собаками' },
] as const;

export const revalidate = 300;

async function load() {
  const [list, cheapest, breeds, site] = await Promise.all([
    serverFetchOrNull(`/catalog/prints?page=1&perPage=${GRID_SIZE}`, PrintListDto, 300),
    // Найдешевший принт — джерело для «від … ₴», щоб ціна не розходилась із карткою.
    serverFetchOrNull('/catalog/prints?page=1&perPage=1&sort=cheap', PrintListDto, 300),
    serverFetchOrNull('/catalog/breeds', BreedListDto, 300),
    getSettings(),
  ]);
  const fromMinor = cheapest?.items[0]?.fromPriceMinor ?? null;
  return {
    prints: list?.items ?? [],
    printTotal: list?.total ?? 0,
    breeds: breeds?.items ?? [],
    fromPrice: fromMinor !== null ? formatUAH(minor(fromMinor)) : null,
    site,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const { prints, printTotal, breeds, fromPrice, site } = await load();
  const title = `Одяг з собаками: футболки, худі й світшоти | ${site.brand}`;
  const facts = [
    printTotal > 0 ? `${printTotal} ${plural(printTotal, 'принт', 'принти', 'принтів')}` : '',
    breeds.length > 0 ? `${breeds.length} ${plural(breeds.length, 'порода', 'породи', 'порід')}` : '',
  ].filter(Boolean).join(', ');
  const description = [
    `Футболки, худі й світшоти з собаками${facts ? `: ${facts}` : ''}.`,
    fromPrice ? `Від ${fromPrice}.` : '',
    `Друкуємо ${site.cityIn} до ${site.productionDaysMax} робочих днів, Нова Пошта по Україні.`,
  ].filter(Boolean).join(' ');

  return {
    title,
    description,
    alternates: { canonical: PATH },
    openGraph: {
      title, description, type: 'website', url: PATH,
      ...(prints[0] ? { images: [prints[0].previewUrl] } : {}),
    },
  };
}

export default async function DogClothingPage() {
  const { prints, printTotal, breeds, fromPrice, site } = await load();

  const freeFrom = freeShippingLabel(site);
  const days = site.productionDaysMax;
  const daysWord = plural(days, 'робочого дня', 'робочих днів', 'робочих днів');
  const breedCount = breeds.length;
  const bySlug = new Map(breeds.map((b) => [b.slug, b]));
  const topBreeds = TOP_BREEDS.flatMap((slug) => {
    const b = bySlug.get(slug);
    return b ? [b] : [];
  });

  const faq: ReadonlyArray<{ q: string; a: string }> = [
    {
      q: 'Скільки коштує одяг з собаками?',
      a: `${fromPrice ? `Футболка з принтом — від ${fromPrice}. ` : ''}Світшоти й худі дорожчі: ціна залежить від виробу, і точну суму видно, щойно обереш річ на сторінці принта.`,
    },
    {
      q: 'Скільки чекати на замовлення?',
      a: `Друкуємо ${site.cityIn} під кожне замовлення — до ${days} ${daysWord}, і одразу відправляємо Новою Поштою.`,
    },
    {
      q: 'Скільки коштує доставка?',
      a: `Нова Пошта по всій Україні: відділення, поштомат або курʼєр. Від ${freeFrom} доставка за наш рахунок, менші замовлення — за тарифом перевізника (орієнтовно ${NP_TARIFF_ESTIMATE.replace('~', '')}), оплачуєш при отриманні.`,
    },
    {
      q: 'А якщо моєї породи немає?',
      a: `${breedCount > 0 ? `У каталозі ${breedCount} ${plural(breedCount, 'порода', 'породи', 'порід')}. ` : ''}Немає твоєї — намалюємо пса з твого фото: заповни бриф «Свій принт», ціну назвемо, коли побачимо фото.`,
    },
    {
      q: 'Можна взяти принт на худі, а не на футболку?',
      a: 'Так. Будь-який принт із каталогу лягає на будь-яку річ з асортименту: футболку, світшот чи худі. Обираєш принт, потім виріб, колір і розмір.',
    },
    {
      q: 'Чи можна повернути?',
      a: returnLine({ hasPrinted: true, hasBlank: false }, site.returnDays),
    },
  ];

  return (
    <PublicShell>
      <JsonLd data={breadcrumbJsonLd([
        { name: 'Головна', url: `${BASE}/` },
        { name: 'Одяг з собаками', url: `${BASE}${PATH}` },
      ])} />
      {prints.length > 0 && (
        <JsonLd data={collectionPageJsonLd({
          name: 'Одяг з собаками',
          description: 'Футболки, худі й світшоти з принтами собак різних порід.',
          url: `${BASE}${PATH}`,
        }, prints, BASE)} />
      )}
      <JsonLd data={faqJsonLd(faq)} />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-12">
        <nav aria-label="Хлібні крихти" className="text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">Одяг з собаками</span>
        </nav>

        <h1 className="mt-3 font-display text-hero font-bold text-ink">Одяг з собаками</h1>
        <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-muted">
          Футболки, худі й світшоти з принтами
          {breedCount > 0 && <> {breedCount} {plural(breedCount, 'породи', 'порід', 'порід')}</>}.
          {fromPrice && <> Від {fromPrice}.</>} Друкуємо {site.cityIn} до {days} {daysWord}.
        </p>

        <div className="mt-8">
          {prints.length > 0 ? (
            <PrintGrid prints={prints} list={LIST.catalog} listId="odyag-z-sobakamy" aboveFold />
          ) : (
            <p className="text-ink-muted">Каталог зараз оновлюється. Зазирни в <Link href="/prints" className="underline underline-offset-4">усі принти</Link>.</p>
          )}
        </div>
        {printTotal > prints.length && (
          <div className="mt-8">
            <ButtonLink href="/prints" size="lg">
              Усі {printTotal} {plural(printTotal, 'принт', 'принти', 'принтів')} →
            </ButtonLink>
          </div>
        )}
      </div>

      <Section>
        <SectionHead
          title="За породою"
          subtitle="Найчастіше шукають ці. Решта — у переліку всіх порід."
          href="/breeds"
          hrefLabel={breedCount > 0 ? `Усі ${breedCount} ${plural(breedCount, 'порода', 'породи', 'порід')}` : 'Усі породи'}
        />
        <ul className="flex flex-wrap gap-2">
          {topBreeds.map((b) => (
            <li key={b.slug}>
              <ButtonLink href={`/breeds/${b.slug}`} variant="quiet" size="sm">
                {b.name}
                <span className="text-ink-subtle">{b.printCount}</span>
              </ButtonLink>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <SectionHead
          title="За виробом"
          subtitle="Той самий принт — на річ, яку ти справді носитимеш."
        />
        <ul className="flex flex-wrap gap-2">
          {GARMENTS.map((g) => (
            <li key={g.type}>
              <ButtonLink href={`/prints?garmentType=${g.type}`} variant="quiet" size="sm">
                {g.label}
              </ButtonLink>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="cream">
        <h2 className="font-display text-2xl font-bold text-ink">Собака на тобі, а не лише на дивані</h2>
        <div className="mt-4 flex max-w-prose flex-col gap-4 leading-relaxed text-ink-muted">
          <p>
            Ти й так ходиш у шерсті свого пса. Тепер можна ходити ще й у його портреті.
          </p>
          <p>
            У каталозі
            {printTotal > 0 && <> {printTotal} {plural(printTotal, 'принт', 'принти', 'принтів')}</>} з собаками
            {breedCount > 0 && <> {breedCount} {plural(breedCount, 'породи', 'порід', 'порід')}</>}: від{' '}
            <Link href="/breeds/taksa" className="underline underline-offset-4">такси</Link> й{' '}
            <Link href="/breeds/mops" className="underline underline-offset-4">мопса</Link> до добермана, шпіца,
            французького бульдога й коргі. Кожен принт друкуємо на футболці, худі чи світшоті:
            спершу обираєш собаку, потім річ, колір і розмір.
          </p>
          <p>
            Друкуємо {site.cityIn} під кожне замовлення, до {days} {daysWord}. Відправляємо Новою Поштою
            по всій Україні: від {freeFrom} доставка за наш рахунок, менші замовлення — за тарифом
            перевізника.{fromPrice && <> Футболка з принтом коштує від {fromPrice}, худі й світшоти дорожчі —
            точну ціну видно, щойно обереш виріб.</>}
          </p>
          <p>
            Гуглив «одежда с собаками» чи «футболки с собаками»? Ти за адресою.
            Шукаєш подарунок собачнику — обери породу його пса і вгадай розмір. Розмір, до речі, легше
            вгадати, ніж характер такси.
          </p>
          <p>
            Твоєї породи немає або твій пес «не такий, як на картинці»? Намалюємо саме його з фото —
            це <Link href="/svoya-ideya" className="underline underline-offset-4">свій принт</Link>.
          </p>
        </div>
      </Section>

      <Section>
        <h2 className="font-display text-2xl font-bold text-ink">Питають перед покупкою</h2>
        <div className="mt-4 max-w-3xl divide-y divide-line border-y border-line">
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
        <p className="mt-6 text-sm text-ink-muted">
          Більше відповідей — на сторінці <Link href="/faq" className="underline underline-offset-4">частих запитань</Link>.
        </p>
      </Section>
    </PublicShell>
  );
}
