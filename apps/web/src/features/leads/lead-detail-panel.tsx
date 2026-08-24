'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getLeadDetail, resendTelegram } from './api';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Нова',
  CONTACTED: 'Зв’язались',
  CONVERTED: 'Купили',
  LOST: 'Втрачена',
};

export function LeadDetailPanel({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-lead-detail', leadId],
    queryFn: () => getLeadDetail(leadId),
  });

  const resend = useMutation({
    mutationFn: () => resendTelegram(leadId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-lead-detail', leadId] });
      void queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-detail-title"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-card border border-line bg-surface-raised p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="lead-detail-title" className="text-lg text-ink">Заявка</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-card p-1 text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
            aria-label="Закрити"
          >
            ✕
          </button>
        </div>

        {isLoading && <p className="text-ink-muted">Завантаження…</p>}
        {isError && <p className="text-danger">Не вдалося завантажити заявку.</p>}

        {data && (
          <div className="space-y-5 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
              <dt className="text-ink-muted">№</dt><dd>{data.number}</dd>
              <dt className="text-ink-muted">Ім&rsquo;я</dt><dd>{data.name}</dd>
              <dt className="text-ink-muted">Телефон</dt><dd>{data.phone}</dd>
              <dt className="text-ink-muted">Повідомлення</dt><dd>{data.message ?? '—'}</dd>
              <dt className="text-ink-muted">Джерело</dt><dd>{data.source ?? '—'}</dd>
              <dt className="text-ink-muted">Створено</dt>
              <dd>{new Date(data.createdAt).toLocaleString('uk-UA')}</dd>
            </dl>

            {data.telegramSentAt ? (
              <p className="text-ok">
                Telegram: доставлено {new Date(data.telegramSentAt).toLocaleString('uk-UA')}
              </p>
            ) : (
              <div>
                <p className="text-danger">
                  Telegram: не долетіло{data.telegramError ? ` — ${data.telegramError}` : ''}
                </p>
                <button
                  type="button"
                  onClick={() => resend.mutate()}
                  disabled={resend.isPending}
                  className="mt-2 rounded-card border border-line px-3 py-1.5 text-sm transition hover:border-ink disabled:opacity-40"
                >
                  {resend.isPending ? 'Надсилаємо…' : 'Надіслати ще раз'}
                </button>
                {resend.isError && <p className="mt-1 text-danger">Не вдалося надіслати.</p>}
              </div>
            )}

            {data.customer && (
              <div>
                <h3 className="mb-2 font-semibold text-ink">
                  Клієнт — усього заявок: {data.customer.totalLeads}
                </h3>
                {data.previousLeads.length === 0 ? (
                  <p className="text-ink-muted">Попередніх заявок немає.</p>
                ) : (
                  <ul className="space-y-1">
                    {data.previousLeads.map((lead) => (
                      <li key={lead.id} className="flex justify-between border-b border-line py-1">
                        <span>
                          №{lead.number} · {new Date(lead.createdAt).toLocaleDateString('uk-UA')}
                        </span>
                        <span className="text-ink-muted">{STATUS_LABELS[lead.status] ?? lead.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
