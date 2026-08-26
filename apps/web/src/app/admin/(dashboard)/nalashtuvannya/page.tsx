import type { Metadata } from 'next';
import { SettingsScreen } from '@/features/admin-settings/settings-screen';
import { AdminPage } from '@/features/admin-shell/admin-shell';

export const metadata: Metadata = { title: 'Налаштування · адмін' };

export default function Page() {
  return (
    <AdminPage title="Налаштування" hint="Реквізити, контакти й меню. Усе звідси потрапляє і в футер, і в тексти сторінок через підстановки — тож правити треба тут, а не в кожному тексті окремо.">
      <div className="max-w-4xl"><SettingsScreen /></div>
    </AdminPage>
  );
}
