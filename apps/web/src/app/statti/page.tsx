import type { Metadata } from 'next';
import Link from 'next/link';
import { PageListDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { ArticleGrid } from '@/features/articles/article-card';
import { serverFetchOrNull } from '@/lib/server-api';
import { getSettings } from '@/lib/site-settings';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  return {
    title: `Статті — ${site.brand}`,
    description: 'Про породи, догляд за одягом із принтом і те, як ми його робимо.',
    alternates: { canonical: '/statti' },
  
  };
}

/**
 * Стрічка матеріалів.
 *
 * Окрема адреса, а не тег на спільному списку сторінок: стаття й сторінка
 * живуть за різними правилами — у статті є дата, автор і місце в стрічці, а
 * в оферти нічого з цього немає й бути не повинно.
 */
export default async function ArticlesPage() {
  const list = await serverFetchOrNull('/content/pages?kind=ARTICLE', PageListDto, 300);
  const articles = list?.items ?? [];

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <nav aria-label="Хлібні крихти" className="text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">Статті</span>
        </nav>

        <h1 className="mt-6 font-display text-3xl font-bold text-ink">Статті</h1>
        <p className="mt-3 max-w-prose text-ink-muted">
          Про породи, догляд за одягом із принтом і те, як ми його робимо.
        </p>

        <div className="mt-10">
          {articles.length === 0
            ? (
              <p className="text-ink-muted">
                Матеріалів поки немає. Загляньте в{' '}
                <Link href="/prints" className="text-accent hover:underline">каталог</Link>.
              </p>
            )
            : <ArticleGrid articles={articles} />}
        </div>
      </div>
    </PublicShell>
  );
}
