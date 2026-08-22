import type { Metadata } from 'next';
import { PublicShell } from '@/components/public-shell';
import { PrintOfferView } from '@/features/catalog/components/PrintOfferView';

interface Params { params: { slug: string } }

export function generateMetadata({ params }: Params): Metadata {
  return { title: params.slug };
}

/**
 * Product page. The print is the primary object; the garment, line, fabric,
 * colour and size are parameters chosen inside it.
 */
export default function PrintPage({ params }: Params) {
  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <PrintOfferView slug={params.slug} />
      </div>
    </PublicShell>
  );
}
