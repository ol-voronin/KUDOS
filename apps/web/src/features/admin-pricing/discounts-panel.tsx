'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AdminPriceRulesDto, DiscountDto, DiscountScope, PriceAdjustKind } from '@dt/contracts';
import { ApiError } from '@/lib/api-client';
import { AmountField, fromStored, toStored } from './amount-field';
import { createDiscount, deleteDiscount, updateDiscount } from './rules-api';
import { RULES_KEY } from './rules-key';

const SCOPE_LABEL: Record<DiscountScope, string> = {
  ALL: 'Весь асортимент',
  GARMENT: 'Один виріб',
  COLLECTION: 'Колекція',
};

/** `datetime-local` дає «2026-09-01T00:00», а контракт чекає ISO з зоною. */
function toIso(local: string): string | null {
  if (local === '') return null;
  const parsed = new Date(local);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Знижки: опт і акції.
 *
 * Це одна сутність із двома умовами, а не два механізми. «Від 10 шт» і «до
 * 31 грудня» — обидва просто звужують, коли правило діє; решта в них
 * однакова. Розводити їх по різних таблицях означало б згодом пояснювати,
 * чому оптова знижка з датою — це третя таблиця.
 *
 * Знижки не складаються: діє одна, найвигідніша покупцеві.
 */
export function DiscountsPanel({ data }: { data: AdminPriceRulesDto }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const save = useMutation({
    mutationFn: ({ id, ...dto }: { id: string; amount?: number; isActive?: boolean; minQty?: number }) =>
      updateDiscount(id, dto),
    onSuccess: (fresh) => qc.setQueryData(RULES_KEY, fresh),
  });

  const remove = useMutation({
    mutationFn: deleteDiscount,
    onSuccess: (fresh) => qc.setQueryData(RULES_KEY, fresh),
  });

  const error = save.error ?? remove.error;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Знижки</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Застосовуються до рядка замовлення — після того, як ціна виробу вже порахована.
          Діє одна знижка, найвигідніша покупцеві: вони не складаються.
        </p>
      </div>

      {error && (
        <p className="rounded-card border border-danger px-4 py-3 text-sm text-danger" role="alert">
          {error instanceof ApiError ? error.message : 'Не вдалося зберегти'}
        </p>
      )}

      {data.discounts.length === 0 && !adding && (
        <p className="text-sm text-ink-subtle">Знижок немає.</p>
      )}

      {data.discounts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Назва</th>
                <th scope="col" className="px-3 py-2 font-medium">Діє на</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Розмір</th>
                <th scope="col" className="px-3 py-2 font-medium">Строк</th>
                <th scope="col" className="px-3 py-2 text-center font-medium">Стан</th>
                <th scope="col" className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.discounts.map((d) => (
                <DiscountRow
                  key={d.id}
                  discount={d}
                  busy={save.isPending || remove.isPending}
                  onSave={(dto) => save.mutate({ id: d.id, ...dto })}
                  onDelete={() => remove.mutate(d.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding
        ? <NewDiscountForm options={data.options} onDone={() => setAdding(false)} />
        : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="self-start rounded-card border border-line px-4 py-2 text-sm text-ink hover:border-ink"
          >
            Додати знижку
          </button>
        )}
    </section>
  );
}

function windowLabel(d: DiscountDto): string {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('uk-UA');
  if (d.startsAt === null && d.endsAt === null) return 'безстроково';
  if (d.startsAt === null) return `до ${fmt(d.endsAt as string)}`;
  if (d.endsAt === null) return `з ${fmt(d.startsAt)}`;
  return `${fmt(d.startsAt)} — ${fmt(d.endsAt)}`;
}

function DiscountRow({
  discount, busy, onSave, onDelete,
}: {
  discount: DiscountDto;
  busy: boolean;
  onSave: (dto: { amount?: number; isActive?: boolean }) => void;
  onDelete: () => void;
}) {
  const [typed, setTyped] = useState(fromStored(discount.amount));
  const stored = toStored(discount.kind, typed);
  const dirty = stored !== null && stored > 0 && stored !== discount.amount;

  return (
    <tr className="border-b border-line">
      <th scope="row" className="py-2 pr-4 text-left font-medium text-ink">{discount.name}</th>
      <td className="px-3 py-2 text-ink-muted">{discount.scopeLabel}</td>
      <td className="px-3 py-2 text-right">
        <span className="flex items-center justify-end gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={typed}
            aria-label={`Розмір знижки: ${discount.name}`}
            onChange={(e) => setTyped(e.target.value)}
            onBlur={() => { if (dirty) onSave({ amount: stored }); }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            disabled={busy}
            className={[
              'w-24 rounded-card border px-2 py-1 text-right tabular-nums text-ink',
              stored === null || stored <= 0 ? 'border-danger' : 'border-line focus:border-ink',
              dirty ? 'bg-sun-soft' : '',
            ].join(' ')}
          />
          <span className="text-ink-subtle">{discount.kind === 'PERCENT' ? '%' : '₴'}</span>
        </span>
      </td>
      <td className="px-3 py-2 text-ink-muted">{windowLabel(discount)}</td>
      <td className="px-3 py-2 text-center">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={discount.isActive}
            aria-label={`Увімкнено: ${discount.name}`}
            disabled={busy}
            onChange={(e) => onSave({ isActive: e.target.checked })}
            className="h-4 w-4"
          />
          {/* Увімкнена, але поза строком — окремий стан, і мовчати про нього
              не можна: інакше «знижка ж увімкнена, чому не діє». */}
          {discount.isActive && !discount.activeNow && (
            <span className="text-xs text-ink-subtle">поза строком</span>
          )}
        </label>
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="text-sm text-ink-subtle hover:text-danger"
        >
          Видалити
        </button>
      </td>
    </tr>
  );
}

function NewDiscountForm({
  options, onDone,
}: {
  options: AdminPriceRulesDto['options'];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [scope, setScope] = useState<DiscountScope>('ALL');
  const [garmentId, setGarmentId] = useState(options.garments[0]?.id ?? '');
  const [collectionId, setCollectionId] = useState(options.collections[0]?.id ?? '');
  const [kind, setKind] = useState<PriceAdjustKind>('PERCENT');
  const [typed, setTyped] = useState('10');
  const [minQty, setMinQty] = useState('1');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const create = useMutation({
    mutationFn: createDiscount,
    onSuccess: (fresh) => { qc.setQueryData(RULES_KEY, fresh); onDone(); },
  });

  const stored = toStored(kind, typed);
  const qty = Number(minQty);
  const canSubmit = name.trim() !== ''
    && stored !== null && stored > 0
    && Number.isInteger(qty) && qty >= 1;

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (stored === null) return;
        create.mutate({
          name: name.trim(),
          scope,
          garmentId: scope === 'GARMENT' ? garmentId : null,
          collectionId: scope === 'COLLECTION' ? collectionId : null,
          kind,
          amount: stored,
          minQty: qty,
          startsAt: toIso(startsAt),
          endsAt: toIso(endsAt),
          isActive: true,
        });
      }}
    >
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Назва
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Опт від 10 шт"
            className="w-56 rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Діє на
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as DiscountScope)}
            className="rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
          >
            {(Object.keys(SCOPE_LABEL) as DiscountScope[]).map((s) => (
              <option key={s} value={s}>{SCOPE_LABEL[s]}</option>
            ))}
          </select>
        </label>

        {scope === 'GARMENT' && (
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Виріб
            <select
              value={garmentId}
              onChange={(e) => setGarmentId(e.target.value)}
              className="rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
            >
              {options.garments.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
        )}

        {scope === 'COLLECTION' && (
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Колекція
            <select
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              className="rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
            >
              {options.collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Як рахувати
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as PriceAdjustKind)}
            className="rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
          >
            <option value="PERCENT">У відсотках</option>
            <option value="DELTA">У гривнях з одиниці</option>
          </select>
        </label>

        <AmountField kind={kind} value={typed} onChange={setTyped} label="Розмір знижки" />

        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Від скількох штук
          <input
            type="number"
            min={1}
            value={minQty}
            onChange={(e) => setMinQty(e.target.value)}
            className="w-24 rounded-card border border-line px-2 py-1 text-right tabular-nums text-ink focus:border-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Початок
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Кінець
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
          />
        </label>
      </div>

      <p className="text-xs text-ink-subtle">
        Порожні дати — знижка діє безстроково. Час місцевий, зберігається в UTC.
      </p>

      {create.error && (
        <p className="text-sm text-danger" role="alert">
          {create.error instanceof ApiError ? create.error.message : 'Не вдалося створити'}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!canSubmit || create.isPending}
          className="rounded-card bg-ink px-4 py-2 text-sm text-surface disabled:opacity-40"
        >
          Створити
        </button>
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-ink-muted">
          Скасувати
        </button>
      </div>
    </form>
  );
}
