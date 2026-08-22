import type { Metadata } from 'next';
import { PublicShell } from '@/components/public-shell';

interface Params { params: { slug: string } }

/** The long-tail SEO surface: every print carrying this breed, any collection. */
export function generateMetadata({ params }: Params): Metadata {
  return {
    title: `Принти з породою ${params.slug}`,
    alternates: { canonical: `/breeds/${params.slug}` },
  };
}

// TODO(step 2): wire real data via `GET /catalog/breeds/:slug` — this is
// still a visual stub, not a working breed page.
export default function BreedPage({ params }: Params) {
  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl text-ink">{params.slug}</h1>
      </div>
    </PublicShell>
  );
}
