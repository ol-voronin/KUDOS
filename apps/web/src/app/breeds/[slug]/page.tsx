import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BreedListDto, BreedPageDto, CollectionListDto, PageListDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { ArticleGrid } from '@/features/articles/article-card';
import { PublicLeadForm } from '@/features/leads/public-lead-form';
import { PrintGrid, SectionHead } from '@/features/home/print-card';
import { CollectionStrip } from '@/features/home/blocks';
import { plural } from '@/features/home/blocks';
import { serverFetch, serverFetchOrNull } from '@/lib/server-api';
import { breadcrumbJsonLd, breedItemListJsonLd, JsonLd } from '@/lib/json-ld';
import { getSettings } from '@/lib/site-settings';
import { ButtonLink } from '@/components/ui';
import { LIST } from '@/features/analytics/lists';
import { breedRuSnippet } from '@/features/catalog/breed-names-ru';

interface Params { params: { slug: string } }

const BASE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

/** Підписи для переходу в каталог за виробом. */
const GARMENT_PLURAL: Record<string, string> = {
  TSHIRT: 'Футболки', SWEATSHIRT: 'Світшоти', HOODIE: 'Худі',
  ZIP_HOODIE: 'Зіп-худі', JOGGERS: 'Джогери', TOTE_BAG: 'Шопери',
};

/**
 * Породна сторінка — головний вхід із пошуку.
 *
 * Людина гуглить «футболка з коргі», а не «принти». Тому H1 містить і породу,
 * і те, що ми продаємо, а синоніми (`вельш-коргі`, `corgi`) виводяться в
 * тексті: поле `Breed.synonyms` було в схемі з самого початку й досі ніде не
 * використовувалось, хоча це буквально запити, за якими сюди приходять.
 */

/** Усі породи — статикою. Порожні теж: така сторінка все одно працює. */
export async function generateStaticParams() {
  const list = await serverFetchOrNull('/catalog/breeds', BreedListDto, 3600);
  return (list?.items ?? []).map((breed) => ({ slug: breed.slug }));
}

export const revalidate = 300;
export const dynamicParams = true;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const site = await getSettings();
  const data = await serverFetchOrNull(`/catalog/breeds/${params.slug}`, BreedPageDto);
  if (!data) return { title: 'Породу не знайдено' };

  const name = data.breed.name;
  const count = data.prints.length;
  // Назва породи завжди в називному: «з принтом Такса» чи «Твій такса»
  // ламали мову, а відмінювати кожну з порід вручну — окреме поле в базі.
  const title = `${name}: футболки й худі з принтом — ${site.brand}`;
  const description = count > 0
    ? `${name}: ${count} ${plural(count, 'принт', 'принти', 'принтів')} на футболках, худі та світшотах. Друкуємо ${site.cityIn}.`
    : `${name}: готового принта ще немає — намалюємо з твого фото. Друкуємо ${site.cityIn}.`;
  // Російська фраза — тільки в meta description, під російськомовний попит
  // із пошуку; Open Graph і сама сторінка лишаються українськими.
  const ru = breedRuSnippet(params.slug);
  const metaDescription = ru === '' ? description : `${description} ${ru}`;

  return {
    title,
    description: metaDescription,
    alternates: { canonical: `/breeds/${params.slug}` },
    openGraph: {
      title, description, type: 'website',
      ...(data.prints[0] ? { images: [data.prints[0].previewUrl] } : {}),
    },
  };
}

export default async function BreedPage({ params }: Params) {
  let data: BreedPageDto;
  try {
    data = await serverFetch(`/catalog/breeds/${params.slug}`, BreedPageDto, 300);
  } catch {
    notFound();
  }

  const { breed, prints, relatedBreeds } = data;

  // Порода без принтів — усе одно сторінка каталогу, а не одна форма.
  // Показуємо жанри, у яких малюємо: людина бачить, ЩО саме отримає, а не
  // просто поле «телефон» і обіцянку.
  const collections = prints.length === 0
    ? (await serverFetchOrNull('/catalog/collections', CollectionListDto, 3600))?.items ?? []
    : [];

  // Матеріали про цю породу. Це і є та причина, заради якої блог тут
  // існує: стаття «Як доглядати вовну коргі» має стояти там, куди людина
  // приходить із пошуку по коргі, а не губитися в стрічці за датою.
  const site = await getSettings();
  const articles = (await serverFetchOrNull(
    `/content/pages?kind=ARTICLE&breed=${params.slug}&limit=3`,
    PageListDto,
    300,
  ))?.items ?? [];

  return (
    <PublicShell>
      {prints.length > 0 && <JsonLd data={breedItemListJsonLd(breed.name, prints, BASE)} />}
      <JsonLd data={breadcrumbJsonLd([
        { name: 'Головна', url: `${BASE}/` },
        { name: 'Породи', url: `${BASE}/breeds` },
        { name: breed.name, url: `${BASE}/breeds/${breed.slug}` },
      ])} />

      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-12">
        <nav aria-label="Хлібні крихти" className="text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <Link href="/breeds" className="hover:underline">Породи</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">{breed.name}</span>
        </nav>

        {/*
          Перший екран — товари (аудит 17.10.2026, IA-6). Раніше фото породи
          на телефоні стояло квадратом на всю ширину над заголовком, і перша
          картка принта починалася на 833 px при видимих 664. Сторінка породи —
          посадкова для «футболка з таксою»: людина має одразу бачити футболки.
          Тепер фото — аватар поруч із заголовком, опис коротший, а синоніми
          («Також шукають як») переїхали під сітку: для пошуковика вони там
          так само є, а покупцеві не заважають.
        */}
        <div className="mt-3 flex items-center gap-3 sm:gap-5">
          {breed.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={breed.photoUrl}
              alt={breed.name}
              className="h-16 w-16 shrink-0 rounded-full object-cover sm:h-24 sm:w-24"
            />
          )}
          <h1 className="min-w-0 font-display text-2xl font-bold leading-tight text-ink sm:text-hero">
            {breed.name}: футболки й худі з принтом
          </h1>
        </div>

        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-muted sm:text-lg">
          {prints.length > 0
            ? <>{prints.length} {plural(prints.length, 'принт', 'принти', 'принтів')} на вибір. Обери принт, далі — виріб. Друкуємо {site.cityIn}.</>
            : <>Готового принта для цієї породи ще немає — але це не проблема. Намалюємо саме твого пса з фото.</>}
        </p>

        {/*
          Перехід у каталог із уже обраною породою й виробом: там і сортування,
          і ціна «від» саме для худі чи світшота.
        */}
        {prints.length > 0 && data.garmentTypes.length > 1 && (
          <nav aria-label="Дивитись за виробом" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4" style={{ scrollbarWidth: 'none' }}>
            {data.garmentTypes.map((type) => (
              <Link
                key={type}
                href={`/prints?breed=${breed.slug}&garmentType=${type}`}
                className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-pill border border-line px-4 text-sm font-medium text-ink hover:border-ink"
              >
                {GARMENT_PLURAL[type] ?? type} →
              </Link>
            ))}
          </nav>
        )}

        <div className="mt-5 sm:mt-10">
          {prints.length > 0
            ? <PrintGrid prints={prints} list={LIST.breed} listId={breed.slug} aboveFold />
            : <EmptyBreed name={breed.name} collections={collections} />}
        </div>

        {/* Синоніми — те, за чим реально гуглять. Поле в схемі було завжди. */}
        {breed.synonyms.length > 0 && (
          <p className="mt-6 max-w-prose text-sm text-ink-subtle">
            Також шукають як: {breed.synonyms.join(', ')}.
          </p>
        )}

        {articles.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-xl font-bold text-ink">Про породу: {breed.name.toLowerCase()}</h2>
            <div className="mt-6">
              <ArticleGrid articles={articles} />
            </div>
          </section>
        )}

        {/* Міст у «свою ідею» — навіть коли принти є: свій пес завжди свій. */}
        {prints.length > 0 && (
          <div className="mt-12 border-t border-ink pt-6">
            <h2 className="font-display text-xl font-bold text-ink">
              Твій пес не схожий на жодного тут?
            </h2>
            <p className="mt-2 max-w-prose leading-relaxed text-ink-muted">
              Намалюємо саме його — з твого фото, з його вухами й характером.
            </p>
            <ButtonLink href="/svoya-ideya" className="mt-5" size="lg">
              Замовити свій принт
            </ButtonLink>
          </div>
        )}

        {relatedBreeds.length > 0 && (
          <section className="mt-16">
            <SectionHead title="Інші породи" />
            <div className="flex flex-wrap gap-2">
              {relatedBreeds.map((other) => (
                <ButtonLink key={other.id} href={`/breeds/${other.slug}`} variant="quiet" size="sm">
                  {other.name}
                  <span className="text-ink-subtle">{other.printCount}</span>
                </ButtonLink>
              ))}
            </div>
          </section>
        )}
      </div>
    </PublicShell>
  );
}

/**
 * Порожня порода — не помилка, а сценарій.
 *
 * Сторінка існує для кожної породи в базі, у тому числі тієї, для якої ще
 * немає жодного принта. Так вона працює з першого дня: людина приходить із
 * пошуку, бачить, що ми вміємо саме її породу, і лишає заявку.
 */
function EmptyBreed({
  name, collections,
}: { name: string; collections: readonly CollectionListDto['items'][number][] }) {
  return (
    <div className="space-y-10">
      <div className="grid gap-8 border-t border-ink pt-8 lg:grid-cols-[1fr_minmax(0,24rem)]">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Намалюємо {name.toLowerCase()} з твого фото</h2>
          <p className="mt-3 max-w-prose leading-relaxed text-ink-muted">
            Готового принта ще немає, але саме з цього ми й починали: портрет із фото,
            у будь-якому стилі — від ренесансу до обкладинки журналу.
          </p>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-muted">
            Ціну називаємо після того, як побачили ідею. Хочете відразу детально —
            заповніть <Link href="/svoya-ideya" className="font-medium text-ink underline">бриф</Link>.
          </p>
        </div>
        <PublicLeadForm source={`/breeds/${name}`} compact />
      </div>

      {collections.length > 0 && (
        <section>
          <SectionHead
            title={`У якому жанрі намалювати твого ${name.toLowerCase()}`}
            subtitle="Це напрями, у яких ми працюємо. Обери настрій — решту зробимо з твого фото."
            href="/collections"
            hrefLabel="Усі колекції"
          />
          <CollectionStrip collections={collections} />
        </section>
      )}
    </div>
  );
}
