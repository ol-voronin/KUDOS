import type { Metadata } from 'next';
import { StatsScreen } from '@/features/admin-stats/stats-screen';

export const metadata: Metadata = { title: 'Статистика · адмін' };

export default function StatsPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-ink">Статистика</h1>
      <p className="mt-2 max-w-prose text-sm text-ink-muted">
        Власні цифри, без сторонніх систем: рахуються з подій на сайті й не залежать від того,
        чи заблокував відвідувач Google. Персональних даних тут немає — ні IP, ні пристрою.
      </p>
      <div className="mt-8">
        <StatsScreen />
      </div>
    </div>
  );
}
