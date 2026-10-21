import type { Metadata } from 'next';
import Link from 'next/link';
import { PageDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { BlockRenderer } from '@/features/content/block-renderer';
import { serverFetchOrNull } from '@/lib/server-api';
import { faqJsonLd, JsonLd, organizationJsonLd, websiteJsonLd } from '@/lib/json-ld';
import { getSettings } from '@/lib/site-settings';
import { ButtonLink } from '@/components/ui';

/**
 * Головна — сторінка з CMS, як і всі інші.
 *
 * Раніше тут було 230 рядків верстки, і щоб змінити заголовок героя, треба
 * було мене й деплой. Тепер це документ із блоків за адресою `home`: та сама
 * форма, той самий попередній перегляд, та сама історія версій.
 *
 * Порожні стани зникли разом із версткою — і це нормально. Блок, якому нема
 * що показати, тепер не малюється зовсім: сітка принтів без принтів гірша за
 * її відсутність, а «каталог наповнюється» лишилося текстом у блоках, яким
 * можна керувати.
 */

const HOME_SLUG = 'home';
const BASE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

async function load(): Promise<PageDto | null> {
  return serverFetchOrNull(`/content/pages/${HOME_SLUG}`, PageDto, 60);
}

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const [page, settings] = await Promise.all([load(), getSettings()]);

  const title = page && page.seo.title.trim() !== ''
    ? page.seo.title
    : `Футболки та худі з собаками — принти порід і портрет твого пса | ${settings.brand}`;
  const description = page?.seo.description.trim() !== ''
    ? page?.seo.description
    : `Готові принти за породами або власний портрет із фото. Друкуємо ${settings.cityIn}.`;

  return {
    title,
    ...(description ? { description } : {}),
    alternates: { canonical: '/' },
    openGraph: { title, ...(description ? { description } : {}), type: 'website' },
  };
}

export default async function HomePage() {
  const [page, settings] = await Promise.all([load(), getSettings()]);

  // Розмітка FAQ збирається з блоків — того самого джерела, що й текст на
  // сторінці. Два списки питань розійшлися б на першій правці.
  const faq = page?.blocks.flatMap((b) => (b.type === 'faq' ? b.items : [])) ?? [];

  return (
    <PublicShell>
      {/* Хто ми й де нас шукати: знання про бренд у Google, включно з Instagram у sameAs. */}
      <JsonLd data={organizationJsonLd(BASE, settings)} />
      <JsonLd data={websiteJsonLd(BASE, settings)} />
      {faq.length > 0 && <JsonLd data={faqJsonLd(faq)} />}

      {page === null
        ? <MissingHome />
        : <BlockRenderer blocks={page.blocks} />}

      {/*
        Вміст головної — з CMS, а це посилання живе в коді навмисно: посадкова
        «Одяг з собаками» має отримувати посилання з головної незалежно від
        того, як переставлять блоки в адмінці.
      */}
      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
        <p className="max-w-prose text-ink-muted">
          Футболки, худі й світшоти за породою і виробом в одному місці:{' '}
          <Link href="/odyag-z-sobakamy" className="font-medium text-ink underline underline-offset-4">одяг з собаками</Link>.
        </p>
      </div>
    </PublicShell>
  );
}

/**
 * Якщо головної немає в базі.
 *
 * Не мало б статися — сторінку створює сідер, і вона системна, тобто її не
 * можна видалити з адмінки. Але порожній екран на головній читається як
 * «сайт помер», тож тут лишається хоч якийсь шлях далі.
 */
function MissingHome() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20 text-center">
      <h1 className="font-display text-3xl font-bold text-ink">Одяг з принтом твоєї собаки</h1>
      <p className="mt-4 text-ink-muted">
        Головна сторінка зараз оновлюється. Каталог працює як звичайно.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/prints" size="lg">
          Дивитись принти
        </ButtonLink>
        <ButtonLink href="/svoya-ideya" variant="outline" size="lg">
          Свій принт із фото
        </ButtonLink>
      </div>
    </div>
  );
}
