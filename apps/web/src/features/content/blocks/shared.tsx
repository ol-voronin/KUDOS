import Link from 'next/link';
import type { BlockLink } from '@dt/contracts';
import { Inline } from '../inline';

/** Кнопки блока. Перша — заливкою, решта контуром, якщо не сказано інакше. */
export function BlockLinks({ links, className = '' }: { links: readonly BlockLink[]; className?: string }) {
  if (links.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {links.map((l, i) => {
        const secondary = l.secondary || i > 0;
        const cls = secondary
          ? 'border-2 border-ink text-ink hover:bg-ink hover:text-surface'
          : 'bg-accent text-white hover:bg-accent-strong';
        const external = /^https?:\/\//.test(l.href);
        return external ? (
          <a
            key={`${l.href}-${i}`}
            href={l.href}
            target="_blank"
            rel="noreferrer"
            className={`flex min-h-12 items-center rounded-card px-6 text-sm font-semibold transition ${cls}`}
          >
            {l.label}
          </a>
        ) : (
          <Link
            key={`${l.href}-${i}`}
            href={l.href}
            className={`flex min-h-12 items-center rounded-card px-6 text-sm font-semibold transition ${cls}`}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Заголовок секції. Порожній рядок не малює нічого — і не лишає відступу. */
export function BlockHeading({ text, lead }: { text: string; lead?: string }) {
  if (text.trim() === '' && (lead ?? '').trim() === '') return null;
  return (
    <div className="mb-6 max-w-prose">
      {text.trim() !== '' && (
        <h2 className="font-display text-2xl font-bold text-ink">{text}</h2>
      )}
      {(lead ?? '').trim() !== '' && (
        <p className="mt-3 leading-relaxed text-ink-muted"><Inline text={lead as string} /></p>
      )}
    </div>
  );
}
