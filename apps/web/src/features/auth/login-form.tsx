'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api-client';
import { login } from './api';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login({ email, password });
      router.push('/admin');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося увійти');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="flex w-full max-w-sm flex-col gap-4" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Email
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-card border border-line px-3 py-2 text-ink focus:border-ink"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Пароль
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-card border border-line px-3 py-2 text-ink focus:border-ink"
        />
      </label>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-card bg-ink px-4 py-2.5 font-semibold text-surface transition hover:bg-ink/90 disabled:opacity-50"
      >
        {pending ? 'Входимо…' : 'Увійти'}
      </button>
    </form>
  );
}
