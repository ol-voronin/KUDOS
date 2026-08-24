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
