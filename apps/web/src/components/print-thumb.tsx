'use client';

import { useState } from 'react';

/**
 * Заглушка на місці фото, якого немає або яке не завантажилось.
 *
 * Поки завантаження зображень не зроблено, каталог тримається на демо-даних, і
 * будь-який з посилань може виявитись мертвим. Порожній прямокутник виглядає
 * як зламана сторінка; підписаний — як товар, у якого просто ще немає фото.
 */
export function PrintThumb({ src, alt, className = '' }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line-strong bg-surface-sunken text-ink-subtle ${className}`}
        role="img"
        aria-label={`${alt} — фото ще немає`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10" r="1.5" />
          <path d="m21 15-5-4-4 3-2-1.5L3 17" />
        </svg>
        <span className="px-2 text-center text-xs">Фото готуємо</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={`aspect-square w-full rounded-card object-cover ${className}`}
    />
  );
}
