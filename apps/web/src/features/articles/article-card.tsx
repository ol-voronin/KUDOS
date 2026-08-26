import Image from 'next/image';
import Link from 'next/link';
import type { PageCardDto } from '@dt/contracts';

/**
 * Картка матеріалу.
 *
 * Одна на всі списки — стрічка, породна сторінка, блок на головній. Друга
 * така сама, але «трохи інша», означає два різні уявлення про те, що в
 * матеріалі головне, і розходяться вони швидко.
 */

export function articleDate(iso: string | null): string {
  if (iso === null) return '';
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function ArticleCard({ article }: { article: PageCardDto }) {
  const date = articleDate(article.publishedAt);

  return (
    <article className="group flex flex-col">
      <Link href={`/statti/${article.slug}`} className="flex flex-col gap-3">
        {article.coverUrl !== '' && (
          <span className="relative block aspect-[3/2] overflow-hidden bg-surface-sunken">
            <Image
              src={article.coverUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          </span>
        )}
        <h3 className="font-display text-lg font-bold leading-snug text-ink group-hover:text-ink">
          {article.title}
        </h3>
      </Link>

      {article.excerpt !== '' && (
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{article.excerpt}</p>
      )}

      <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-ink-subtle">
        {date !== '' && <span>{date}</span>}
        {date !== '' && <span aria-hidden="true">·</span>}
        <span>{article.readingMinutes} хв читання</span>
      </p>

      {/* Породи — не прикраса: саме вони ведуть із матеріалу туди, де купують. */}
      {article.breeds.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-2">
          {article.breeds.map((b) => (
            <Link
              key={b.slug}
              href={`/breeds/${b.slug}`}
              className="rounded-pill border border-line px-2.5 py-0.5 text-xs text-ink-muted transition hover:border-ink hover:text-ink"
            >
              {b.name}
            </Link>
          ))}
        </p>
      )}
    </article>
  );
}

export function ArticleGrid({ articles }: { articles: readonly PageCardDto[] }) {
  return (
    <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((a) => <ArticleCard key={a.slug} article={a} />)}
    </div>
  );
}
