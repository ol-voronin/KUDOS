import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public-shell';
import { CartView } from '@/features/cart/cart-view';
import { getSettings } from '@/lib/site-settings';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  return {
    title: `Кошик — ${site.brand}`,
    // Кошик у кожного свій і в індексі йому нема чого робити.
    robots: { index: false, follow: true },
  };
}

export default function CartPage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <nav aria-label="Хлібні крихти" className="text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">Кошик</span>
        </nav>
        <h1 className="mt-3 font-display text-hero font-bold uppercase text-ink">Кошик</h1>
        <div className="mt-10">
          <CartView />
        </div>
      </div>
    </PublicShell>
  );
}
