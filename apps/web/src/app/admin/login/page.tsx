import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth/login-form';

export const metadata: Metadata = { title: 'Вхід' };

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-2xl font-semibold text-ink">Адмінка Doggie Tale</h1>
        <LoginForm />
      </div>
    </main>
  );
}
