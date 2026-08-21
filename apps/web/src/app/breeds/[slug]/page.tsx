import type { Metadata } from 'next';

interface Params { params: { slug: string } }

/** The long-tail SEO surface: every print carrying this breed, any collection. */
export function generateMetadata({ params }: Params): Metadata {
  return {
    title: `Принти з породою ${params.slug}`,
    alternates: { canonical: `/breeds/${params.slug}` },
  };
}

export default function BreedPage({ params }: Params) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold">{params.slug}</h1>
    </main>
  );
}
