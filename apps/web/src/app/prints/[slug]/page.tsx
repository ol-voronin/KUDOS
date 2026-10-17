import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BreedListDto, CollectionListDto, PrintOfferDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { PrintOfferView } from '@/features/catalog/components/PrintOfferView';
import { RelatedPrints } from '@/features/catalog/components/RelatedRail';
import { serverFetch, serverFetchOrNull } from '@/lib/server-api';
import { breadcrumbJsonLd, JsonLd, productJsonLd } from '@/lib/json-ld';
import { getSettings } from '@/lib/site-settings';
import { isOfferable } from '@/features/catalog/variant-selection';

const BASE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

interface Params { params: { slug: string } }

export const revalidate = 60;

/**
 * Раніше тут стояло `{ title: params.slug }` — тобто заголовком сторінки
 * принта з коргі був рядок `korhi-renesans`. Для сторінки, яку має знайти
 * пошук, це найдешевша з можливих помилок і найдорожча за наслідками.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const site = await getSettings();
  const [offer, collections] = await Promise.all([
    serverFetchOrNull(`/catalog/prints/${params.slug}`, PrintOfferDto),
    serverFetchOrNull('/catalog/collections', CollectionListDto, 300),
  ]);
  if (!offer) return { title: 'Принт не знайдено' };

  // «Коргі» є в трьох колекціях — без назви колекції три сторінки мали
  // однаковий заголовок, і пошук бачив дублікати. Колекція робить їх різними.
  const collection = collections?.items.find((c) => offer.print.collectionSlugs.includes(c.slug))?.title;
  const name = collection ? `${offer.print.title} — ${collection}` : offer.print.title;
  const title = `${name}: футболка й худі з принтом | ${site.brand}`;
  const description = `${name}: принт на футболці, худі або світшоті. Друкуємо ${site.cityIn}, виготовляємо самі, доставка Новою поштою.`;

  return {
    title,
    description,
    alternates: { canonical: `/prints/${params.slug}` },
    openGraph: { title, description, type: 'website', images: [offer.print.previewUrl] },
  };
}

/**
 * Картка товару. Дані тягне сервер і віддає готовими в HTML; клієнтським
 * лишається лише вибір виробу, кольору й розміру.
 */
export default async function PrintPage({ params }: Params) {
  let offer: PrintOfferDto;
  try {
    offer = await serverFetch(`/catalog/prints/${params.slug}`, PrintOfferDto, 60);
  } catch {
    notFound();
  }

  const [site, breedList, collectionList] = await Promise.all([
    getSettings(),
    serverFetchOrNull('/catalog/breeds', BreedListDto, 300),
    serverFetchOrNull('/catalog/collections', CollectionListDto, 300),
  ]);

  /*
   * Звідки цей принт: порода й колекція. Крихти й посилання «ще з цією
   * породою» ведуть туди (аудит 17.10.2026, IA-4): власник стафа, що прийшов
   * на один принт, має побачити ще два зі стафом, а не лише «весь каталог».
   * Порода важливіша за колекцію — саме за нею тут шукають.
   */
  const breed = offer.print.breedSlugs
    .map((slug) => breedList?.items.find((b) => b.slug === slug))
    .find((b) => b !== undefined);
  const collection = offer.print.collectionSlugs
    .map((slug) => collectionList?.items.find((c) => c.slug === slug))
    .find((c) => c !== undefined);

  /*
   * Один ланцюжок і для видимих крихт, і для BreadcrumbList: раніше JSON-LD
   * казав «Принти», а на екрані було «Каталог» — пошуковик і людина бачили
   * різну структуру.
   */
  const trail: Array<{ name: string; href: string }> = [
    { name: 'Головна', href: '/' },
    ...(breed
      ? [{ name: 'Породи', href: '/breeds' }, { name: breed.name, href: `/breeds/${breed.slug}` }]
      : collection
        ? [{ name: 'Колекції', href: '/collections' }, { name: collection.title, href: `/collections/${collection.slug}` }]
        : [{ name: 'Усі принти', href: '/prints' }]),
  ];
  // Та сама назва, що в <title>: «Шпіц» без колекції — це три різні товари
  // з однаковою назвою (Polo, паб, зима), і Google їх не розрізняє.
  const productName = collection ? `${offer.print.title} — ${collection.title}` : offer.print.title;

  // Ціни рахує сервер і кладе на кожен варіант; тут лишається взяти межі.
  // Складати «база + друк» руками означало б третю реалізацію ціни — після
  // вітрини й каси.
  //
  // У межі йдуть лише варіанти, які можна купити: ціна в розмітці має бути
  // ціною, за яку товар справді продається (і яку показує фід).
  const offerable = offer.variants.filter(isOfferable);
  const totals = (offerable.length > 0 ? offerable : offer.variants)
    .map((v) => v.priceMinor + offer.printPriceMinor);
  const inStock = offerable.length > 0;

  return (
    <PublicShell>
      {totals.length > 0 && (
        <JsonLd data={productJsonLd({
          name: productName,
          sku: offer.print.slug,
          description: `${offer.print.title}: друк на футболці, худі або світшоті. Друкуємо ${site.cityIn}.`,
          images: offer.images.map((i) => i.url),
          url: `${BASE}/prints/${params.slug}`,
          lowPriceMinor: Math.min(...totals),
          highPriceMinor: Math.max(...totals),
          inStock,
          offerCount: totals.length,
        }, BASE, site)} />
      )}
      <JsonLd data={breadcrumbJsonLd([
        ...trail.map((c) => ({ name: c.name, url: `${BASE}${c.href}` })),
        { name: offer.print.title, url: `${BASE}/prints/${params.slug}` },
      ])} />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
        {/*
          Середній рівень у крихтах обовʼязковий: без нього з картки товару
          немає шляху на щабель угору — тільки на головну або назад кнопкою
          браузера. Людина, що прийшла з пошуку чи реклами, іншого входу в
          каталог на цій сторінці не має.
        */}
        <nav aria-label="Хлібні крихти" className="mb-6 text-sm text-ink-muted">
          <ol className="flex flex-wrap items-center gap-y-1">
            {trail.map((c) => (
              <li key={c.href} className="flex items-center">
                <Link href={c.href} className="hover:underline">{c.name}</Link>
                <span aria-hidden className="px-1.5">·</span>
              </li>
            ))}
            <li className="text-ink" aria-current="page">{offer.print.title}</li>
          </ol>
        </nav>
        <PrintOfferView slug={params.slug} initialData={offer} />
        {(breed || collection) && (
          <nav aria-label="Дивитись ще" className="mt-8 flex flex-wrap gap-2">
            {breed && breed.printCount > 1 && (
              <Link
                href={`/breeds/${breed.slug}`}
                className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-medium text-ink hover:border-ink"
              >
                Усі принти з породою {breed.name} ({breed.printCount}) →
              </Link>
            )}
            {collection && (
              <Link
                href={`/collections/${collection.slug}`}
                className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-medium text-ink hover:border-ink"
              >
                Колекція «{collection.title}» ({collection.printCount}) →
              </Link>
            )}
          </nav>
        )}
        <RelatedPrints
          excludeSlug={params.slug}
          breedSlugs={offer.print.breedSlugs}
          collectionSlug={offer.print.collectionSlugs[0]}
        />
      </div>
    </PublicShell>
  );
}
