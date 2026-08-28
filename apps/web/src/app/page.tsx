import type { Metadata } from 'next';
import Link from 'next/link';
import { PageDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { BlockRenderer } from '@/features/content/block-renderer';
import { serverFetchOrNull } from '@/lib/server-api';
import { faqJsonLd, JsonLd } from '@/lib/json-ld';
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

async function load(): Promise<PageDto | null> {
  return serverFetchOrNull(`/content/pages/${HOME_SLUG}`, PageDto, 60);
}

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const [page, settings] = await Promise.all([load(), getSettings()]);

  const title = page && page.seo.title.trim() !== ''
    ? page.seo.title
    : `${settings.brand} — одяг з принтом твоєї собаки`;
  const description = page?.seo.description.trim() !== ''
    ? page?.seo.description
    : `Готові принти за породами або власний портрет із фото. Шиємо й друкуємо ${settings.cityIn}.`;

  return {
    title,
    ...(description ? { description } : {}),
    alternates: { canonical: '/' },
    openGraph: { title, ...(description ? { description } : {}), type: 'website' },
  };
}

export default async function HomePage() {
  const page = await load();

  // Розмітка FAQ збирається з блоків — того самого джерела, що й текст на
  // сторінці. Два списки питань розійшлися б на першій правці.
  const faq = page?.blocks.flatMap((b) => (b.type === 'faq' ? b.items : [])) ?? [];

  return (
    <PublicShell>
      {faq.length > 0 && <JsonLd data={faqJsonLd(faq)} />}

      {page === null
        ? <MissingHome />
        : <BlockRenderer blocks={page.blocks} />}
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
