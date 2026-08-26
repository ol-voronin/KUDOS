'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LeadStatus } from '@dt/contracts';
import { leadsExportUrl, listLeads, updateLeadStatus } from './api';
import { LeadDetailPanel } from './lead-detail-panel';
import {
  Button, Chip, EmptyState, ErrorBanner, TableSkeleton,
  TableWrap, Thead, Th, Tr, Td, inputClass,
} from '@/components/ui';

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
            'tap-sm min-h-8 rounded-pill border px-3 text-sm transition',
            status === '' ? 'border-ink bg-ink font-semibold text-surface' : 'border-line text-ink-muted hover:border-ink hover:text-ink',
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
              'tap-sm min-h-8 rounded-pill border px-3 text-sm transition',
              status === s ? 'border-ink bg-ink font-semibold text-surface' : 'border-line text-ink-muted hover:border-ink hover:text-ink',
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
          className={`${inputClass()} w-44`}
        />

        <a
          href={leadsExportUrl(status || undefined, phone || undefined)}
          className="tap-sm ml-auto inline-flex min-h-8 items-center rounded-pill border border-line px-3 text-sm font-semibold text-ink transition hover:border-ink"
        >
          Експорт CSV
        </a>
      </div>

      {isLoading && <TableSkeleton rows={5} cols={5} />}
      {isError && <ErrorBanner>Не вдалося завантажити заявки.</ErrorBanner>}
      {data && data.items.length === 0 && (
        <EmptyState
          title={status === '' ? 'Заявок ще немає' : 'У цьому статусі порожньо'}
          hint={status === ''
            ? 'Щойно хтось надішле форму на сайті, вона зʼявиться тут — і одразу полетить у Telegram.'
            : 'Спробуйте інший статус або зніміть фільтр.'}
        />
      )}

      {data && data.items.length > 0 && (
        <TableWrap minWidth="46rem">
          <Thead>
            <Th>№</Th>
            <Th>Ім&rsquo;я</Th>
            <Th>Телефон</Th>
            <Th>Повідомлення</Th>
            <Th>Telegram</Th>
            <Th>Статус</Th>
          </Thead>
          <tbody>
            {data.items.map((lead) => (
              <Tr key={lead.id}>
                <Td>
                  <button
                    type="button"
                    onClick={() => setSelectedLeadId(lead.id)}
                    className="tap-sm font-semibold underline decoration-dotted underline-offset-2"
                  >
                    {lead.number}
                  </button>
                </Td>
                <Td>{lead.name}</Td>
                <Td className="whitespace-nowrap tabular-nums">{lead.phone}</Td>
                <Td className="max-w-xs truncate" title={lead.message ?? ''}>
                  {lead.message ?? '—'}
                </Td>
                <Td>
                  {lead.telegramSentAt
                    ? <Chip tone="ok">доставлено</Chip>
                    : <span title={lead.telegramError ?? ''}><Chip tone="danger">не долетіло</Chip></span>}
                </Td>
                <Td>
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
                    className={`${inputClass()} py-1`}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      {data && data.total > data.perPage && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <Button variant="quiet" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Назад
          </Button>
          <span className="text-ink-muted">
            {page} з {Math.ceil(data.total / data.perPage)}
          </span>
          <Button variant="quiet" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page * data.perPage >= data.total}>
            Далі
          </Button>
        </div>
      )}

      {selectedLeadId && (
        <LeadDetailPanel leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />
      )}
    </div>
  );
}

