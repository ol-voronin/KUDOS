import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public-shell';
import { CheckoutForm } from '@/features/cart/checkout-form';
import { getSettings } from '@/lib/site-settings';
import { isPreviewDeploy } from '@/lib/deploy-env';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  return {
    title: `Оформлення замовлення — ${site.brand}`,
    robots: { index: false, follow: false },
  };
}

export default function CheckoutPage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <nav aria-label="Хлібні крихти" className="text-sm text-ink-muted">
          <Link href="/koshyk" className="hover:underline">Кошик</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">Оформлення</span>
        </nav>
        <h1 className="mt-3 font-display text-hero font-bold uppercase text-ink">Оформлення</h1>
        <div className="mt-10">
          <CheckoutForm orderingDisabled={isPreviewDeploy()} />
        </div>
      </div>
    </PublicShell>
  );
}
