import type { Metadata } from 'next';
import { PricingScreen } from '@/features/admin-pricing/pricing-screen';
import { AdminPage } from '@/features/admin-shell/admin-shell';

export const metadata: Metadata = { title: 'Ціни · адмін' };

export default function Page() {
  return (
    <AdminPage title="Ціни" hint="Ціна складається з трьох частин: база виробу, надбавки за розмір, тканину й колір, і знижка на рядок замовлення. Калькулятор показує, що з цього виходить.">
      <div className="max-w-6xl"><PricingScreen /></div>
    </AdminPage>
  );
}
