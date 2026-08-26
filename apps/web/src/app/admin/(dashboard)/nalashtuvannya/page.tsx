import type { Metadata } from 'next';
import { SettingsScreen } from '@/features/admin-settings/settings-screen';

export const metadata: Metadata = { title: 'Налаштування · адмін' };

export default function SettingsPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-ink">Налаштування</h1>
      <p className="mt-2 max-w-prose text-sm text-ink-muted">
        Реквізити, контакти й меню. Усе звідси потрапляє і в футер, і в тексти сторінок через
        підстановки — тож правити треба тут, а не в кожному тексті окремо.
      </p>
      <div className="mt-8">
        <SettingsScreen />
      </div>
    </div>
  );
}
