'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AnalyticsEventName, EVENT_LABELS,
  type ConversionActionDto,
} from '@dt/contracts';
import { z } from 'zod';
import { apiFetch, ApiError } from '@/lib/api-client';

const KEY = ['admin-conversions'];
const Rows = z.array(z.object({
  id: z.string().uuid(),
  event: AnalyticsEventName,
  label: z.string(),
  sendValue: z.boolean(),
  isActive: z.boolean(),
}));

const BASE = '/admin/analytics/conversions';

const list = () => apiFetch(BASE, Rows);
const create = (dto: { event: string; label: string; sendValue: boolean }) =>
  apiFetch(BASE, Rows, { method: 'POST', body: JSON.stringify(dto) });
const update = (id: string, dto: { isActive?: boolean; sendValue?: boolean }) =>
  apiFetch(`${BASE}/${id}`, Rows, { method: 'PATCH', body: JSON.stringify(dto) });
const remove = (id: string) => apiFetch(`${BASE}/${id}`, Rows, { method: 'DELETE' });

/**
 * Конверсії Google Ads.
 *
 * Пояснення, яке варто прочитати раніше за поля: без конверсій реклама
 * оптимізується за кліками. Клік нічого не вартий — Google просто приведе
 * найдешевших людей, які клікають і йдуть. Конверсія каже алгоритму, що
 * саме вважати успіхом, і з цього моменту він працює на заявки, а не на
 * трафік.
 *
 * Мітка береться в самому Google Ads: у фрагменті `AW-123456789/AbC-D_efG`
 * друга частина після скісної — це вона.
 */
export function ConversionsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: KEY, queryFn: list });
  const [event, setEvent] = useState<string>('lead_submitted');
  const [label, setLabel] = useState('');

  const add = useMutation({
    mutationFn: create,
    onSuccess: (fresh) => { qc.setQueryData(KEY, fresh); setLabel(''); },
  });
  const patch = useMutation({
    mutationFn: ({ id, ...dto }: { id: string; isActive?: boolean; sendValue?: boolean }) => update(id, dto),
    onSuccess: (fresh) => qc.setQueryData(KEY, fresh),
  });
  const drop = useMutation({
    mutationFn: remove,
    onSuccess: (fresh) => qc.setQueryData(KEY, fresh),
  });

  if (isLoading) return <p className="text-ink-muted">Завантаження…</p>;

  const rows: ConversionActionDto[] = data ?? [];
  const error = add.error ?? patch.error ?? drop.error;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Конверсії Google Ads</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Без них реклама вчиться на кліках, а клік нічого не вартий. Мітку візьміть у
          Google Ads: у фрагменті <code className="text-xs">AW-123456789/AbC-D_efG</code> це
          частина після скісної.
        </p>
      </div>

      {error && (
        <p className="rounded-card border border-danger px-4 py-3 text-sm text-danger" role="alert">
          {error instanceof ApiError ? error.message : 'Не вдалося зберегти'}
        </p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Подія</th>
                <th scope="col" className="px-3 py-2 font-medium">Мітка</th>
                <th scope="col" className="px-3 py-2 text-center font-medium">Передавати суму</th>
                <th scope="col" className="px-3 py-2 text-center font-medium">Увімкнено</th>
                <th scope="col" className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line">
                  <th scope="row" className="py-2 pr-4 text-left font-medium text-ink">
                    {EVENT_LABELS[row.event]}
                  </th>
                  <td className="px-3 py-2 font-mono text-xs text-ink-muted">{row.label}</td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.sendValue}
                      aria-label={`Передавати суму: ${EVENT_LABELS[row.event]}`}
                      onChange={(e) => patch.mutate({ id: row.id, sendValue: e.target.checked })}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.isActive}
                      aria-label={`Увімкнено: ${EVENT_LABELS[row.event]}`}
                      onChange={(e) => patch.mutate({ id: row.id, isActive: e.target.checked })}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => drop.mutate(row.id)}
                      className="text-sm text-ink-subtle hover:text-danger"
                    >
                      Видалити
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form
        className="flex flex-wrap items-end gap-4 rounded-card border border-line p-4"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate({ event, label: label.trim(), sendValue: event === 'purchase' });
        }}
      >
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Подія
          <select
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            className="rounded-card border border-line px-2 py-2 text-sm text-ink focus:border-ink"
          >
            {AnalyticsEventName.options
              .filter((e) => e !== 'page_view')
              .map((e) => <option key={e} value={e}>{EVENT_LABELS[e]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Мітка
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="AbC-D_efG"
            className="w-56 rounded-card border border-line px-2 py-2 font-mono text-sm text-ink focus:border-ink"
          />
        </label>
        <button
          type="submit"
          disabled={label.trim().length < 3 || add.isPending}
          className="rounded-card bg-ink px-4 py-2 text-sm text-surface disabled:opacity-40"
        >
          Додати
        </button>
      </form>
    </section>
  );
}
