import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { PageDto, RedirectDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { BlockRenderer } from '@/features/content/block-renderer';
import { serverFetchOrNull } from '@/lib/server-api';
import { faqJsonLd, JsonLd } from '@/lib/json-ld';
import { getSettings } from '@/lib/site-settings';

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
  const site = await getSettings();
  const page = await load(params.slug);
  if (!page) return { title: 'Сторінку не знайдено' };

  // Порожнє SEO-поле означає «взяти зі сторінки». Змушувати редактора
  // дублювати заголовок у два поля — вірний спосіб отримати їх різними.
  const title = page.seo.title.trim() !== ''
    ? page.seo.title
    : `${page.title} — ${site.brand}`;
  const description = page.seo.description.trim() !== '' ? page.seo.description : page.excerpt;

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

  // Головна живе за адресою `/`, а в базі — під slug `home`. Без цього
  // редіректу той самий документ відкривався б за двома адресами, і пошук
  // сам обрав би, яку вважати головною.
  if (page.slug === 'home') permanentRedirect('/');

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
        <JsonLd data={faqJsonLd(faq)} />
      )}
      <nav aria-label="Хлібні крихти" className="mx-auto max-w-7xl px-4 sm:px-6 pt-8 text-sm text-ink-muted">
        <Link href="/" className="hover:underline">Головна</Link>
        <span className="px-1.5">·</span>
        <span className="text-ink">{page.title}</span>
      </nav>
      <BlockRenderer blocks={page.blocks} />
    </PublicShell>
  );
}
