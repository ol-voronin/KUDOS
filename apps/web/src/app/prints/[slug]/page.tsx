import type { Metadata } from 'next';

interface Params { params: { slug: string } }

export function generateMetadata({ params }: Params): Metadata {
  return { title: params.slug };
}

/**
 * Product page. The print is the primary object; the garment, line, fabric,
 * colour and size are parameters chosen inside it.
 *
 * TODO(step 2): render PrintOffer via usePrintOffer + selectableColours /
 * selectableSizes. The selection logic and its tests already exist.
 */
export default function PrintPage({ params }: Params) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold">{params.slug}</h1>
    </main>
  );
}
