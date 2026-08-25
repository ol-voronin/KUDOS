import type { Metadata } from 'next';
import { PricingTable } from '@/features/admin-pricing/pricing-table';

export const metadata: Metadata = { title: 'Ціни · адмін' };

export default function PricingPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-ink">Ціни</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Ціни, залиті скриптом, — заглушки. Виправте їх тут: зміна діє одразу, деплой не потрібен,
        і повторний запуск сідера їх більше не перетре.
      </p>
      <div className="mt-8">
        <PricingTable />
      </div>
    </div>
  );
}
