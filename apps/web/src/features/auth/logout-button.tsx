'use client';

import { useRouter } from 'next/navigation';
import { logout } from './api';

export function LogoutButton() {
  const router = useRouter();

  async function handleClick() {
    await logout().catch(() => undefined);
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-card border border-line px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
    >
      Вийти
    </button>
  );
}
