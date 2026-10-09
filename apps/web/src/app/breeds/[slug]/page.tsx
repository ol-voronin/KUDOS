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
import { breedItemListJsonLd, JsonLd } from '@/lib/json-ld';
import { getSettings } from '@/lib/site-settings';
import { ButtonLink } from '@/components/ui';
import { LIST } from '@/features/analytics/lists';

interface Params { params: { slug: string } }

const BASE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

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

  return {
    title,
    description,
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

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <nav aria-label="Хлібні крихти" className="text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">{breed.name}</span>
        </nav>

        {/*
          Фото породи стоїть ПОРУЧ із заголовком, а не банером на всю ширину.
          Це не герой сторінки: людина прийшла по принти, фото лише підтверджує,
          що вона потрапила до своєї собаки. Немає фото — колонка просто не
          малюється, і текст займає всю ширину, як раніше.
        */}
        <div className={breed.photoUrl ? 'mt-3 grid gap-6 md:grid-cols-[1fr_18rem] md:items-start' : 'mt-3'}>
          <div>
            <h1 className="font-display text-hero font-bold text-ink">
              {breed.name}: футболки й худі з принтом
            </h1>

            <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-muted">
              {prints.length > 0
                ? <>{prints.length} {plural(prints.length, 'принт', 'принти', 'принтів')} на вибір. Обери принт, а далі — виріб, на якому його надрукувати. Друкуємо {site.cityIn}.</>
                : <>Готового принта для цієї породи ще немає — але це не проблема. Намалюємо саме твого пса з фото.</>}
            </p>

            {/* Синоніми — те, за чим реально гуглять. Поле в схемі було завжди. */}
            {breed.synonyms.length > 0 && (
              <p className="mt-3 max-w-prose text-sm text-ink-subtle">
                Також шукають як: {breed.synonyms.join(', ')}.
              </p>
            )}
          </div>

          {breed.photoUrl && (
            <figure className="order-first md:order-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={breed.photoUrl}
                alt={breed.name}
                className="aspect-square w-full rounded-card object-cover"
              />
              <figcaption className="mt-2 text-xs text-ink-subtle">{breed.name}</figcaption>
            </figure>
          )}
        </div>

        <div className="mt-10">
          {prints.length > 0
            ? <PrintGrid prints={prints} list={LIST.breed} listId={breed.slug} />
            : <EmptyBreed name={breed.name} collections={collections} />}
        </div>

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
