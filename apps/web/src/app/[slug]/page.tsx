import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { PageDto, RedirectDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { BlockRenderer } from '@/features/content/block-renderer';
import { substitute } from '@/features/content/inline';
import { serverFetchOrNull } from '@/lib/server-api';
import { faqJsonLd, JsonLd } from '@/lib/json-ld';
import { site } from '@/config/site';

interface Params { params: { slug: string } }

export const revalidate = 300;

/**
 * Сторінка з CMS.
 *
 * Динамічний сегмент верхнього рівня перехоплює все, що не збіглося зі
 * статичними маршрутами (`/prints`, `/breeds`, `/vyroby`…) — у Next статичні
 * виграють завжди, тож підмінити каталог сторінкою з бази неможливо навіть
 * навмисно.
 */
async function load(slug: string): Promise<PageDto | null> {
  return serverFetchOrNull(`/content/pages/${slug}`, PageDto, 300);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const page = await load(params.slug);
  if (!page) return { title: 'Сторінку не знайдено' };

  // Порожнє SEO-поле означає «взяти зі сторінки». Змушувати редактора
  // дублювати заголовок у два поля — вірний спосіб отримати їх різними.
  const title = page.seo.title.trim() !== ''
    ? substitute(page.seo.title)
    : `${page.title} — ${site.brand}`;
  const description = substitute(
    page.seo.description.trim() !== '' ? page.seo.description : page.excerpt,
  );

  return {
    title,
    ...(description !== '' ? { description } : {}),
    alternates: { canonical: `/${page.slug}` },
    ...(page.seo.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      ...(description !== '' ? { description } : {}),
      type: 'website',
      ...(page.coverUrl !== '' ? { images: [page.coverUrl] } : {}),
    },
  };
}

export default async function ContentPage({ params }: Params) {
  const page = await load(params.slug);

  if (!page) {
    // Сторінки немає — можливо, її перейменували. 301 на нову адресу зберігає
    // і позиції в пошуку, і чужі посилання; 404 стирає й те, й те.
    const moved = await serverFetchOrNull(`/content/redirects/${params.slug}`, RedirectDto, 3600);
    if (moved) permanentRedirect(`/${moved.toSlug}`);
    notFound();
  }

  // Матеріали живуть під /statti. Показувати їх ще й тут означало б дві
  // адреси з тим самим текстом: пошук вибрав би одну сам, і не обовʼязково
  // ту, на яку ведуть посилання з сайту.
  if (page.kind === 'ARTICLE') redirect(`/statti/${page.slug}`);

  // Розмітка FAQ збирається з блоків, а не пишеться редактором окремо:
  // два джерела питань розійшлися б на першій же правці.
  const faq = page.blocks.flatMap((b) => (b.type === 'faq' ? b.items : []));

  return (
    <PublicShell>
      {faq.length > 0 && (
        <JsonLd data={faqJsonLd(faq.map((i) => ({ q: i.q, a: substitute(i.a) })))} />
      )}
      <nav aria-label="Хлібні крихти" className="mx-auto max-w-6xl px-6 pt-8 text-sm text-ink-muted">
        <Link href="/" className="hover:underline">Головна</Link>
        <span className="px-1.5">·</span>
        <span className="text-ink">{page.title}</span>
      </nav>
      <BlockRenderer blocks={page.blocks} />
    </PublicShell>
  );
}
