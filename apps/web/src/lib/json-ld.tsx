import type { SiteSettingsDto } from '@dt/contracts';

/**
 * JSON-LD. Єдине місце, де формуються структуровані дані.
 *
 * `FAQPage` тут не заради галочки: це один із небагатьох видів розмітки, що
 * дає видимий результат у видачі — відповіді розкриваються прямо в пошуку.
 */

export function organizationJsonLd(baseUrl: string, site: SiteSettingsDto) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.brand,
    url: baseUrl,
    ...(site.phone ? { telephone: site.phone } : {}),
    ...(site.city ? { address: { '@type': 'PostalAddress', addressLocality: site.city, addressCountry: 'UA' } } : {}),
    sameAs: [site.telegramUrl].filter(Boolean),
  };
}

export function faqJsonLd(items: ReadonlyArray<{ q: string; a: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

export function breedItemListJsonLd(
  breedName: string,
  prints: ReadonlyArray<{ slug: string; title: string }>,
  baseUrl: string,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Одяг з принтом ${breedName}`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: prints.length,
      itemListElement: prints.map((print, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${baseUrl}/prints/${print.slug}`,
        name: print.title,
      })),
    },
  };
}

/**
 * Стаття.
 *
 * `author` — організація, а не людина: підписувати матеріали іменем, якого
 * немає на сайті, гірше, ніж не підписувати. `dateModified` окремо від
 * `datePublished` навмисно — саме він каже пошуку, що матеріал оновлюють.
 */
export function articleJsonLd(article: {
  title: string;
  description: string;
  url: string;
  coverUrl: string;
  publishedAt: string | null;
  updatedAt: string;
}, baseUrl: string, site: SiteSettingsDto) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    ...(article.description !== '' ? { description: article.description } : {}),
    mainEntityOfPage: { '@type': 'WebPage', '@id': article.url },
    ...(article.coverUrl !== ''
      ? { image: [article.coverUrl.startsWith('http') ? article.coverUrl : `${baseUrl}${article.coverUrl}`] }
      : {}),
    ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
    dateModified: article.updatedAt,
    author: { '@type': 'Organization', name: site.brand, url: baseUrl },
    publisher: { '@type': 'Organization', name: site.brand, url: baseUrl },
  };
}

/**
 * Хлібні крихти.
 *
 * Пошук малює їх замість голої адреси в результатах — це те, що видно, а не
 * те, що «правильно за специфікацією».
 */
export function breadcrumbJsonLd(
  trail: ReadonlyArray<{ name: string; url: string }>,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Товар.
 *
 * `AggregateOffer`, а не `Offer`, і це не формальність: один принт продається
 * на семи виробах у різних цінах, тож єдиної ціни в нього немає. Вигадати її
 * означало б показати в пошуку суму, якої немає в кошику — а це той самий
 * дефект, що й ціна, яка не сходиться на касі, тільки помітний раніше.
 *
 * `availability` рахується з варіантів: якщо хоч щось є на складі — InStock,
 * інакше PreOrder. Писати InStock завжди — найшвидший спосіб отримати санкції
 * за невідповідність даних у Merchant Center.
 */
export function productJsonLd(product: {
  name: string;
  description: string;
  images: readonly string[];
  url: string;
  lowPriceMinor: number;
  highPriceMinor: number;
  inStock: boolean;
  offerCount: number;
}, baseUrl: string, site: SiteSettingsDto) {
  const absolute = (u: string) => (u.startsWith('http') ? u : `${baseUrl}${u}`);
  const uah = (minor: number) => (minor / 100).toFixed(2);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(product.description !== '' ? { description: product.description } : {}),
    ...(product.images.length > 0 ? { image: product.images.map(absolute) } : {}),
    brand: { '@type': 'Brand', name: site.brand },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'UAH',
      lowPrice: uah(product.lowPriceMinor),
      highPrice: uah(product.highPriceMinor),
      offerCount: product.offerCount,
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/PreOrder',
      url: product.url,
      seller: { '@type': 'Organization', name: site.brand },
    },
  };
}

/** Рендериться як <script type="application/ld+json"> у серверному компоненті. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // Дані наші, не користувацькі; JSON.stringify екранує лапки, а </script>
      // всередині рядків тут зʼявитись не може.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
