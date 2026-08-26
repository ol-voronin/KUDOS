import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth/login-form';
import { getSettings } from '@/lib/site-settings';

export const metadata: Metadata = { title: 'Вхід' };

export default async function AdminLoginPage() {
  const site = await getSettings();
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="w-full max-w-sm">
        <p className="mb-1 font-display text-sm font-bold uppercase tracking-wide text-ink-subtle">{site.brand}</p>
        <h1 className="mb-6 text-2xl text-ink">Адмінка</h1>
        <LoginForm />
      </div>
    </main>
  );
}
