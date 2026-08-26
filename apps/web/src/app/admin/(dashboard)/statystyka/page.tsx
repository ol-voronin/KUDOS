import type { Metadata } from 'next';
import { StatsScreen } from '@/features/admin-stats/stats-screen';
import { AdminPage } from '@/features/admin-shell/admin-shell';

export const metadata: Metadata = { title: 'Статистика · адмін' };

export default function Page() {
  return (
    <AdminPage title="Статистика" hint="Власні цифри, без сторонніх систем: рахуються з подій на сайті й не залежать від того, чи заблокував відвідувач Google. Персональних даних тут немає — ні IP, ні пристрою.">
      <StatsScreen />
    </AdminPage>
  );
}
