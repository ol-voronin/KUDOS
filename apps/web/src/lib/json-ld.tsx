import { site } from '@/config/site';

/**
 * JSON-LD. Єдине місце, де формуються структуровані дані.
 *
 * `FAQPage` тут не заради галочки: це один із небагатьох видів розмітки, що
 * дає видимий результат у видачі — відповіді розкриваються прямо в пошуку.
 */

export function organizationJsonLd(baseUrl: string) {
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
}, baseUrl: string) {
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
