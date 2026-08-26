import type { Metadata } from 'next';
import { PricingScreen } from '@/features/admin-pricing/pricing-screen';

export const metadata: Metadata = { title: 'Ціни · адмін' };

export default function PricingPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-ink">Ціни</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Ціна складається з трьох частин: база виробу, надбавки за розмір, тканину й колір,
        і знижка на рядок замовлення. Калькулятор показує, що з цього виходить.
      </p>
      <div className="mt-8">
        <PricingScreen />
      </div>
    </div>
  );
}
