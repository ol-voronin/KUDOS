import type { ReactNode } from 'react';

/**
 * Коробки, з яких складається сторінка.
 *
 * Рамка тут завжди волосінь і ніколи тінь: тінь підіймає елемент над
 * сторінкою, а на вітрині над сторінкою має підійматися тільки фотографія.
 */

/** Панель адмінки: рамка, білий папір, щільні відступи. */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-card border border-line bg-surface p-4 transition-colors duration-200 hover:border-line-strong ${className}`}>
      {children}
    </section>
  );
}

/**
 * Заголовок розділу з міткою над ним і дією праворуч.
 * Раніше цей блок був скопійований у шести файлах і встиг розʼїхатися
 * у трьох із них.
 */
export function PanelHead({
  eyebrow, title, hint, action,
}: { eyebrow?: string; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow !== undefined && <p className="label-eyebrow mb-1">{eyebrow}</p>}
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        {hint !== undefined && <p className="mt-1 max-w-prose text-sm text-ink-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

type ChipTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'accent';
const CHIP: Record<ChipTone, string> = {
  neutral: 'border-line text-ink-muted',
  ok: 'border-ok/40 text-ok',
  warn: 'border-sun/40 text-sun-ink',
  danger: 'border-danger/40 text-danger',
  accent: 'border-accent bg-accent text-white',
};

/** Стан рядка чи картки. Обведення замість заливки — менше шуму в таблиці. */
export function Chip({ tone = 'neutral', children }: { tone?: ChipTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide ${CHIP[tone]}`}>
      {children}
    </span>
  );
}

/**
 * Порожній стан.
 *
 * Був рівно один на всю адмінку — на решті екранів порожнеча виглядала як
 * поломка. Порожній екран — це момент, коли людина найбільше потребує
 * підказки, що робити далі, тому дія тут не опційна прикраса.
 */
export function EmptyState({
  title, hint, action,
}: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="animate-[fade-in_.4s_ease-out] rounded-card border border-dashed border-line-strong bg-surface-sunken px-6 py-10 text-center">
      <p className="font-display text-base font-bold text-ink">{title}</p>
      {hint !== undefined && <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">{hint}</p>}
      {action !== undefined && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * Помилка. Один вигляд на всі випадки — раніше їх було шість, і через це
 * не читалася сама серйозність: те саме «не вдалося зберегти» виглядало то
 * як банер, то як сірий рядок під полем.
 */
export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="animate-[fade-in_.25s_ease-out] rounded-card border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
      {children}
    </p>
  );
}

/** Смуга-скелет. Ширина в частках, щоб ряд не виглядав як рівна цегла. */
export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <span aria-hidden className={`skeleton block ${className}`} />;
}

/**
 * Заглушка таблиці на час завантаження.
 *
 * Головне тут не краса, а те, що фільтри й пошук лишаються на місці:
 * раніше кілька екранів на час запиту повністю замінювали себе рядком
 * «Завантаження…», і клавіатурний фокус втрачався разом із розміткою.
 */
export function TableSkeleton({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  const widths = ['w-3/4', 'w-1/2', 'w-2/3', 'w-1/3', 'w-5/6'];
  return (
    <div className="flex flex-col gap-3 py-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">Завантаження…</span>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4 border-b border-line pb-3">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={`h-4 flex-1 ${widths[(r + c) % widths.length] ?? 'w-1/2'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
