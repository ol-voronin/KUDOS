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

const STATUS_OPTIONS: LeadStatus[] = ['NEW', 'CONTACTED', 'CONVERTED', 'LOST'];

export function LeadsTable() {
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const queryClient = useQueryClient();

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
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-leads'] }),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-ink-muted" htmlFor="lead-status-filter">Статус</label>
        <select
          id="lead-status-filter"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as LeadStatus | '');
            setPage(1);
          }}
          className="rounded-card border border-line bg-surface-raised px-3 py-1.5 text-sm"
        >
          <option value="">Усі</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        <label className="text-sm text-ink-muted" htmlFor="lead-phone-filter">Телефон</label>
        <input
          id="lead-phone-filter"
          type="search"
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          placeholder="+380…"
          className="rounded-card border border-line bg-surface-raised px-3 py-1.5 text-sm"
        />

        <a
          href={leadsExportUrl(status || undefined, phone || undefined)}
          className="ml-auto rounded-card border border-line px-3 py-1.5 text-sm hover:bg-surface-sunken"
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
                  <select
                    value={lead.status}
                    onChange={(e) =>
                      mutation.mutate({ id: lead.id, nextStatus: e.target.value as LeadStatus })
                    }
                    disabled={mutation.isPending}
                    className="rounded-card border border-line bg-surface-raised px-2 py-1 text-sm"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
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
            className="rounded-card border border-line px-3 py-1 disabled:opacity-40"
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
            className="rounded-card border border-line px-3 py-1 disabled:opacity-40"
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

