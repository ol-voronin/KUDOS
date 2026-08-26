import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { PageDto, PageListDto, RedirectDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { ArticleGrid, articleDate } from '@/features/articles/article-card';
import { BlockRenderer } from '@/features/content/block-renderer';
import { serverFetchOrNull } from '@/lib/server-api';
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd, JsonLd } from '@/lib/json-ld';
import { getSettings } from '@/lib/site-settings';

interface Params { params: { slug: string } }

export const revalidate = 300;

const BASE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

async function load(slug: string): Promise<PageDto | null> {
  return serverFetchOrNull(`/content/pages/${slug}`, PageDto, 300);
}

export async function generateStaticParams() {
  const list = await serverFetchOrNull('/content/pages?kind=ARTICLE', PageListDto, 3600);
  return (list?.items ?? []).map((a) => ({ slug: a.slug }));
}

export const dynamicParams = true;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const site = await getSettings();
  const page = await load(params.slug);
  if (!page || page.kind !== 'ARTICLE') return { title: 'Матеріал не знайдено' };

  const title = page.seo.title.trim() !== ''
    ? page.seo.title
    : `${page.title} — ${site.brand}`;
  const description = page.seo.description.trim() !== '' ? page.seo.description : page.excerpt;

  return {
    title,
    ...(description !== '' ? { description } : {}),
    alternates: { canonical: `/statti/${page.slug}` },
    ...(page.seo.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      ...(description !== '' ? { description } : {}),
      type: 'article',
      ...(page.publishedAt ? { publishedTime: page.publishedAt } : {}),
      ...(page.coverUrl !== '' ? { images: [page.coverUrl] } : {}),
    },
  };
}

/**
 * Матеріал.
 *
 * Той самий документ із блоків, що й будь-яка сторінка, — редактор,
 * попередній перегляд і історія версій спільні. Відрізняється тільки
 * оболонка: дата, час читання, звʼязки з породами й сусідні матеріали.
 * Заводити заради цього окрему сутність означало б підтримувати другий
 * редактор і другу історію версій.
 */
export default async function ArticlePage({ params }: Params) {
  const page = await load(params.slug);

  if (!page) {
    const moved = await serverFetchOrNull(`/content/redirects/${params.slug}`, RedirectDto, 3600);
    if (moved) permanentRedirect(`/statti/${moved.toSlug}`);
    notFound();
  }

  // Сторінка, яка не є матеріалом, живе на верхньому рівні. Показати її ще
  // й тут означало б дві адреси з тим самим текстом — пошук вибере одну сам,
  // і не обовʼязково ту, на яку ведуть посилання.
  if (page.kind !== 'ARTICLE') redirect(`/${page.slug}`);

  const faq = page.blocks.flatMap((b) => (b.type === 'faq' ? b.items : []));
  const date = articleDate(page.publishedAt);

  // Сусідні матеріали: спершу про ту саму породу, інакше просто свіжі.
  const relatedQuery = page.breeds[0]
    ? `/content/pages?kind=ARTICLE&breed=${page.breeds[0].slug}&limit=4`
    : '/content/pages?kind=ARTICLE&limit=4';
  const [related, settings] = await Promise.all([
    serverFetchOrNull(relatedQuery, PageListDto, 300),
    getSettings(),
  ]);
  const siblings = (related?.items ?? []).filter((a) => a.slug !== page.slug).slice(0, 3);

  return (
    <PublicShell>
      <JsonLd data={articleJsonLd({
        title: page.title,
        description: page.excerpt,
        url: `${BASE}/statti/${page.slug}`,
        coverUrl: page.coverUrl,
        publishedAt: page.publishedAt,
        updatedAt: page.updatedAt,
      }, BASE, settings)} />
      <JsonLd data={breadcrumbJsonLd([
        { name: 'Головна', url: `${BASE}/` },
        { name: 'Статті', url: `${BASE}/statti` },
        { name: page.title, url: `${BASE}/statti/${page.slug}` },
      ])} />
      {faq.length > 0 && (
        <JsonLd data={faqJsonLd(faq)} />
      )}

      <article className="mx-auto max-w-3xl px-6 py-10">
        <nav aria-label="Хлібні крихти" className="text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <Link href="/statti" className="hover:underline">Статті</Link>
        </nav>

        <h1 className="mt-6 font-display text-3xl font-bold leading-tight text-ink">{page.title}</h1>

        <p className="mt-4 flex flex-wrap items-center gap-x-2 text-sm text-ink-subtle">
          {date !== '' && <time dateTime={page.publishedAt ?? undefined}>{date}</time>}
          {date !== '' && <span aria-hidden="true">·</span>}
          <span>{page.readingMinutes} хв читання</span>
        </p>

        {page.excerpt !== '' && (
          <p className="mt-5 text-lg leading-relaxed text-ink-muted">{page.excerpt}</p>
        )}

        {page.coverUrl !== '' && (
          <span className="relative mt-8 block aspect-[3/2] overflow-hidden rounded-card bg-surface-sunken">
            <Image src={page.coverUrl} alt="" fill sizes="(max-width: 768px) 100vw, 48rem" className="object-cover" priority />
          </span>
        )}
      </article>

      <BlockRenderer blocks={page.blocks} />

      {(page.breeds.length > 0 || page.collections.length > 0) && (
        <section className="mx-auto max-w-3xl px-6 py-10">
          <h2 className="font-display text-lg font-bold text-ink">Дивіться також</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {page.breeds.map((b) => (
              <Link
                key={b.slug}
                href={`/breeds/${b.slug}`}
                className="rounded-pill border border-line px-4 py-1.5 text-sm text-ink-muted transition hover:border-ink hover:text-ink"
              >
                Одяг з принтом {b.name}
              </Link>
            ))}
            {page.collections.map((c) => (
              <Link
                key={c.slug}
                href={`/collections/${c.slug}`}
                className="rounded-pill border border-line px-4 py-1.5 text-sm text-ink-muted transition hover:border-ink hover:text-ink"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {siblings.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="font-display text-xl font-bold text-ink">Ще матеріали</h2>
          <div className="mt-6">
            <ArticleGrid articles={siblings} />
          </div>
        </section>
      )}
    </PublicShell>
  );
}
