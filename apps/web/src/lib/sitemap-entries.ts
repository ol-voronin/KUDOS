import type { MetadataRoute } from 'next';
import type { PageListDto, SitemapDto } from '@dt/contracts';

type Entry = MetadataRoute.Sitemap[number];
type Freq = NonNullable<Entry['changeFrequency']>;

/** Найсвіжіша дата зі списку; порожній список — `undefined`, а не «зараз». */
function latest(dates: ReadonlyArray<Date | string | undefined>): Date | undefined {
  let max: Date | undefined;
  for (const raw of dates) {
    if (raw === undefined) continue;
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    if (max === undefined || d > max) max = d;
  }
  return max;
}

/**
 * Карта сайту як чиста функція — щоб її можна було перевірити тестом без API.
 *
 * `lastmod` — тільки справжній. Для сторінок-добірок (головна, каталог,
 * породи, колекції, посадкова) це найсвіжіша зміна того, що на них
 * показано: опублікували принт — змінились і вони. Для довідкових сторінок
 * (FAQ, «Про нас», опт) дати зміни в базі немає, і `lastmod` там немає
 * свідомо: Google перестає вірити `lastmod` сайту, на якому він бреше.
 */
export function buildSitemap(
  base: string,
  data: SitemapDto | null,
  pages: PageListDto | null,
): MetadataRoute.Sitemap {
  const articles = (pages?.items ?? []).filter((p) => p.kind === 'ARTICLE');
  const catalogDate = latest([
    ...(data?.prints ?? []).map((p) => p.updatedAt),
    ...(data?.breeds ?? []).map((b) => b.updatedAt),
    ...(data?.collections ?? []).map((c) => c.updatedAt),
  ]);
  const printsDate = latest((data?.prints ?? []).map((p) => p.updatedAt));
  const breedsDate = latest((data?.breeds ?? []).map((b) => b.updatedAt));
  const collectionsDate = latest((data?.collections ?? []).map((c) => c.updatedAt));
  const garmentsDate = latest((data?.garments ?? []).map((g) => g.updatedAt));
  const articlesDate = latest(articles.map((a) => a.updatedAt));

  const page = (path: string, changeFrequency: Freq, priority: number, lastModified?: Date): Entry => ({
    url: `${base}${path}`,
    ...(lastModified !== undefined ? { lastModified } : {}),
    changeFrequency,
    priority,
  });

  const staticPages: MetadataRoute.Sitemap = [
    page('/', 'weekly', 1, catalogDate),
    page('/prints', 'weekly', 0.9, printsDate),
    // Посадкова під загальний запит «одяг / футболки / худі з собаками».
    page('/odyag-z-sobakamy', 'weekly', 0.9, printsDate),
    // Хаб усіх порід — головний вхід із пошуку «футболка з [порода]».
    page('/breeds', 'weekly', 0.9, breedsDate),
    page('/collections', 'weekly', 0.8, collectionsDate),
    // «футболка оверсайз жіноча», «худі 350 розмірна сітка» — запити з
    // наміром купити, і вони не про принт: відповідає на них сторінка асортименту.
    page('/vyroby', 'monthly', 0.8, garmentsDate),
    // FAQ із розміткою FAQPage: Google показує відповіді просто у видачі.
    page('/faq', 'monthly', 0.6),
    page('/zayavka', 'monthly', 0.6),
    page('/pro-nas', 'yearly', 0.5),
    page('/opt', 'monthly', 0.7),
    page('/insta', 'monthly', 0.3),
    page('/statti', 'weekly', 0.7, articlesDate),
  ];

  /*
   * Сторінки з CMS. Оферта потрапляє сюди свідомо: Monobank при підключенні
   * еквайрингу перевіряє, що вона опублікована й доступна ззовні.
   */
  const contentPages: MetadataRoute.Sitemap = (pages?.items ?? [])
    // Головна вже стоїть вище під адресою `/`; її slug `home` дав би дубль.
    .filter((p) => p.slug !== 'home')
    // `spivpratsia` переадресовується на `/opt` (next.config) — редирект у карті зайвий.
    .filter((p) => p.slug !== 'spivpratsia')
    // Статична сторінка з тією ж адресою перекриває CMS-сторінку — дубль у карті ні до чого.
    .filter((p) => p.kind === 'ARTICLE' || p.slug !== 'odyag-z-sobakamy')
    .map((p) => ({
      // Матеріал живе під /statti — у карті та адреса, на яку веде сайт, а не та, з якої 301.
      url: p.kind === 'ARTICLE' ? `${base}/statti/${p.slug}` : `${base}/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: p.kind === 'ARTICLE' ? ('monthly' as const) : ('yearly' as const),
      priority: p.kind === 'ARTICLE' ? 0.7 : 0.5,
    }));

  if (!data) return [...staticPages, ...contentPages];

  return [
    ...staticPages,
    ...contentPages,
    // Породні — головний вхід із пошуку, тому пріоритет вищий за картки.
    ...data.breeds.map((b) => ({
      url: `${base}/breeds/${b.slug}`, lastModified: b.updatedAt,
      changeFrequency: 'weekly' as const, priority: 0.8,
    })),
    // Сторінки виробів: «оверсайз футболка жіноча» — комерційний запит не про принт.
    ...data.garments.map((g) => ({
      url: `${base}/vyroby/${g.slug}`, lastModified: g.updatedAt,
      changeFrequency: 'monthly' as const, priority: 0.7,
    })),
    ...data.collections.map((c) => ({
      url: `${base}/collections/${c.slug}`, lastModified: c.updatedAt,
      changeFrequency: 'weekly' as const, priority: 0.7,
    })),
    ...data.prints.map((p) => ({
      url: `${base}/prints/${p.slug}`, lastModified: p.updatedAt,
      changeFrequency: 'monthly' as const, priority: 0.6,
    })),
  ];
}
