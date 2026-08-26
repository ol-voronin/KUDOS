'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { SeoAuditDto, type SeoFindingDto, type SeoLevel } from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';

const KEY = ['admin-seo'];

function getAudit(): Promise<SeoAuditDto> {
  return apiFetch('/admin/settings/seo', SeoAuditDto);
}

const LEVEL: Record<SeoLevel, { label: string; cls: string }> = {
  error: { label: 'Помилка', cls: 'bg-danger-soft text-danger' },
  warning: { label: 'Варто', cls: 'bg-sun-soft text-sun-ink' },
  info: { label: 'До відома', cls: 'bg-info-soft text-info' },
};

/**
 * Перевірка SEO.
 *
 * Тут навмисно немає бала зі ста. Бал не каже, що робити, і його можна
 * підняти, нічого не полагодивши. Список або порожній — і тоді все справді
 * гаразд, — або з кожного рядка видно сторінку, причину й дію.
 */
export function SeoPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({ queryKey: KEY, queryFn: getAudit });

  if (isLoading) return <p className="text-ink-muted">Перевіряю…</p>;
  if (isError || !data) return <p className="text-danger">Не вдалося перевірити.</p>;

  const { summary, findings } = data;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Перевірка SEO</h2>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            Рахується щоразу заново — по тому, що зараз у базі.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="rounded-card border border-line px-4 py-2 text-sm text-ink hover:border-ink disabled:opacity-40"
        >
          {isFetching ? 'Перевіряю…' : 'Перевірити знову'}
        </button>
      </div>

      <dl className="grid gap-3 sm:grid-cols-4">
        <Stat label="Опубліковано" value={summary.published} />
        <Stat label="Видно пошуку" value={summary.indexable} muted={summary.indexable === 0} />
        <Stat label="Помилок" value={summary.errors} danger={summary.errors > 0} />
        <Stat label="Зауважень" value={summary.warnings} />
      </dl>

      {!summary.allowIndexing && (
        <p className="rounded-card bg-info-soft px-4 py-3 text-sm text-info" role="status">
          Індексацію вимкнено — сайт закритий від пошуку. Це нормально, доки немає домену
          й остаточної назви: вийти в пошук зі старою назвою в заголовках дорожче, ніж зачекати.
          Вмикається вище, у налаштуваннях.
        </p>
      )}

      {findings.length === 0
        ? <p className="text-sm text-ink-muted">Дефектів немає.</p>
        : (
          <ul className="flex flex-col gap-3">
            {findings.map((f, i) => <Finding key={`${f.code}-${f.pageId ?? 'site'}-${i}`} finding={f} />)}
          </ul>
        )}
    </section>
  );
}

function Stat({ label, value, danger = false, muted = false }: {
  label: string; value: number; danger?: boolean; muted?: boolean;
}) {
  return (
    <div className="rounded-card border border-line p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className={[
        'mt-1 font-display text-2xl font-bold tabular-nums',
        danger ? 'text-danger' : muted ? 'text-ink-subtle' : 'text-ink',
      ].join(' ')}>
        {value}
      </dd>
    </div>
  );
}

function Finding({ finding }: { finding: SeoFindingDto }) {
  const level = LEVEL[finding.level];

  return (
    <li className="rounded-card border border-line p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`rounded-card px-2 py-0.5 text-xs font-bold ${level.cls}`}>{level.label}</span>
        <span className="font-medium text-ink">{finding.message}</span>
      </div>
      {finding.fix !== '' && <p className="mt-1.5 text-sm text-ink-muted">{finding.fix}</p>}
      {finding.pageId !== null && (
        <p className="mt-2 text-sm">
          <Link href={`/admin/storinky/${finding.pageId}`} className="text-accent hover:underline">
            {finding.pageTitle}
          </Link>
          <span className="ml-2 text-ink-subtle">/{finding.pageSlug}</span>
        </p>
      )}
    </li>
  );
}
