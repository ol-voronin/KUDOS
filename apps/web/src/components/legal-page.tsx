import Link from 'next/link';
import type { ReactNode } from 'react';
import { PublicShell } from '@/components/public-shell';
import { Section } from '@/components/section';

/**
 * Каркас правової сторінки.
 *
 * Оферта й політика — це документи, які читають рідко, але коли читають —
 * шукають конкретний пункт. Тому нумерація наскрізна, заголовки клікабельні
 * якорями, а ширина колонки вужча за решту сайту: юридичний текст у 6 колонок
 * не читається.
 */
export function LegalPage({
  title, updatedAt, intro, children,
}: { title: string; updatedAt: string; intro: ReactNode; children: ReactNode }) {
  return (
    <PublicShell>
      <Section tone="cream">
        <nav aria-label="Хлібні крихти" className="text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">{title}</span>
        </nav>
        <h1 className="mt-3 max-w-3xl font-display text-hero font-bold text-ink">{title}</h1>
        <p className="mt-4 max-w-prose leading-relaxed text-ink-muted">{intro}</p>
        <p className="mt-4 text-sm text-ink-subtle">Редакція від {updatedAt}</p>
      </Section>

      <Section>
        <div className="max-w-3xl space-y-8">{children}</div>
      </Section>
    </PublicShell>
  );
}

/** Розділ документа. `n` — наскрізний номер, на нього посилаються в розмові. */
export function Clause({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  const id = `p${n}`;
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-xl font-bold text-ink">
        <a href={`#${id}`} className="hover:text-accent">
          {n}. {title}
        </a>
      </h2>
      <div className="mt-3 space-y-3 leading-relaxed text-ink-muted">{children}</div>
    </section>
  );
}

/** Нумерований підпункт: 4.1, 4.2 — щоб на них можна було послатися. */
export function Item({ n, children }: { n: string; children: ReactNode }) {
  return (
    <p>
      <span className="font-medium text-ink">{n}</span> {children}
    </p>
  );
}
