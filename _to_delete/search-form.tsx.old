'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

/**
 * Пошук у шапці.
 *
 * Звичайна форма з переходом на `/search?q=…`, а не випадайка з миттєвими
 * підказками. Причини дві: сторінка результатів індексується й нею можна
 * поділитись посиланням, і вона працює без JavaScript. Випадайку можна
 * додати згори пізніше — вона не замінює сторінку, а доповнює її.
 */
export function SearchForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params?.get('q') ?? '');

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = value.trim();
    if (q.length < 2) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      action="/search"
      method="get"
      className={compact ? 'w-full' : 'w-full max-w-xs'}
    >
      <label htmlFor="site-search" className="sr-only">Пошук по сайту</label>
      <div className="relative">
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
        >
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id="site-search"
          name="q"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Порода, колекція, принт…"
          className="h-11 w-full rounded-card border border-line bg-surface pl-10 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
        />
      </div>
    </form>
  );
}
