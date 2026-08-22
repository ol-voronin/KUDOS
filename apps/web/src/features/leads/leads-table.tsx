'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LeadStatus } from '@dt/contracts';
import { leadsExportUrl, listLeads, updateLeadStatus } from './api';
import { LeadDetailPanel } from './lead-detail-panel';

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'Нова',
  CONTACTED: 'Зв’язались',
  CONVERTED: 'Купили',
  LOST: 'Втрачена',
};

const STATUS_PILL_LABELS: Record<LeadStatus, string> = {
  NEW: 'Нові',
  CONTACTED: 'В роботі',
  CONVERTED: 'Конвертовані',
  LOST: 'Втрачені',
};

const STATUS_DOT: Record<LeadStatus, string> = {
  NEW: 'bg-accent',
  CONTACTED: 'bg-info',
  CONVERTED: 'bg-ok',
  LOST: 'bg-ink-subtle',
};

const STATUS_OPTIONS: LeadStatus[] = ['NEW', 'CONTACTED', 'CONVERTED', 'LOST'];

function useStatusCounts() {
  return useQuery({
    queryKey: ['admin-leads-status-counts'],
    queryFn: async () => {
      const [all, ...perStatus] = await Promise.all([
        listLeads(undefined, 1),
        ...STATUS_OPTIONS.map((s) => listLeads(s, 1)),
      ]);
      const byStatus = Object.fromEntries(
        STATUS_OPTIONS.map((s, i) => [s, perStatus[i]?.total ?? 0]),
      ) as Record<LeadStatus, number>;
      return { all: all.total, byStatus };
    },
    staleTime: 15_000,
  });
}

function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function LeadsTable() {
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const counts = useStatusCounts();

  // Debounce phone search so every keystroke doesn't fire a request.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPhone(phoneInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timeout);
  }, [phoneInput]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-leads', status, phone, page],
    queryFn: () => listLeads(status || undefined, page, phone || undefined),
  });

  const mutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: LeadStatus }) =>
      updateLeadStatus(id, nextStatus),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-leads-status-counts'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-leads-new-count'] });
    },
  });

  return (
    <div>
      <div
        role="group"
        aria-label="Фільтр за статусом"
        className="mb-4 flex flex-wrap gap-2"
      >
        <button
          type="button"
          aria-pressed={status === ''}
          onClick={() => { setStatus(''); setPage(1); }}
          className={[
            'rounded-pill px-3 py-1.5 text-sm font-medium transition',
            status === '' ? 'bg-ink text-surface' : 'bg-surface-sunken text-ink-muted hover:text-ink',
          ].join(' ')}
        >
          Усі {counts.data ? counts.data.all : ''}
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={[
              'rounded-pill px-3 py-1.5 text-sm font-medium transition',
              status === s ? 'bg-ink text-surface' : 'bg-surface-sunken text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {STATUS_PILL_LABELS[s]} {counts.data ? counts.data.byStatus[s] : ''}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-ink-muted" htmlFor="lead-phone-filter">Телефон</label>
        <input
          id="lead-phone-filter"
          type="search"
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          placeholder="+380…"
          className="rounded-card border border-line bg-surface-raised px-3 py-1.5 text-sm focus:border-ink"
        />

        <a
          href={leadsExportUrl(status || undefined, phone || undefined)}
          className="ml-auto rounded-card border border-line px-3 py-1.5 text-sm transition hover:border-ink"
        >
          Експорт CSV
        </a>
      </div>

      {isLoading && <p className="text-ink-muted">Завантаження…</p>}
      {isError && <p className="text-danger">Не вдалося завантажити заявки.</p>}
      {data && data.items.length === 0 && <p className="text-ink-muted">Заявок немає.</p>}

      {data && data.items.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-muted">
              <th className="py-2 pr-4">№</th>
              <th className="py-2 pr-4">Ім&rsquo;я</th>
              <th className="py-2 pr-4">Телефон</th>
              <th className="py-2 pr-4">Повідомлення</th>
              <th className="py-2 pr-4">Telegram</th>
              <th className="py-2 pr-4">Статус</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((lead) => (
              <tr key={lead.id} className="border-b border-line">
                <td className="py-2 pr-4">
                  <button
                    type="button"
                    onClick={() => setSelectedLeadId(lead.id)}
                    className="underline decoration-dotted underline-offset-2 hover:text-accent"
                  >
                    {lead.number}
                  </button>
                </td>
                <td className="py-2 pr-4">{lead.name}</td>
                <td className="py-2 pr-4">{lead.phone}</td>
                <td className="max-w-xs truncate py-2 pr-4" title={lead.message ?? ''}>
                  {lead.message ?? '—'}
                </td>
                <td className="py-2 pr-4">
                  {lead.telegramSentAt ? (
                    <span className="text-ok">доставлено</span>
                  ) : (
                    <span className="text-danger" title={lead.telegramError ?? ''}>не долетіло</span>
                  )}
                </td>
                <td className="py-2 pr-4">
                  <label className="sr-only" htmlFor={`lead-status-${lead.id}`}>
                    Статус заявки №{lead.number}
                  </label>
                  <select
                    id={`lead-status-${lead.id}`}
                    value={lead.status}
                    onChange={(e) =>
                      mutation.mutate({ id: lead.id, nextStatus: e.target.value as LeadStatus })
                    }
                    disabled={mutation.isPending}
                    className="rounded-card border border-line bg-surface-raised px-2 py-1 text-sm focus:border-ink"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <span className="sr-only"> </span>
                  <StatusBadge status={lead.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data && data.total > data.perPage && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-card border border-line px-3 py-1 transition hover:border-ink disabled:opacity-40 disabled:hover:border-line"
          >
            Назад
          </button>
          <span className="text-ink-muted">
            {page} з {Math.ceil(data.total / data.perPage)}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page * data.perPage >= data.total}
            className="rounded-card border border-line px-3 py-1 transition hover:border-ink disabled:opacity-40 disabled:hover:border-line"
          >
            Далі
          </button>
        </div>
      )}

      {selectedLeadId && (
        <LeadDetailPanel leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />
      )}
    </div>
  );
}

