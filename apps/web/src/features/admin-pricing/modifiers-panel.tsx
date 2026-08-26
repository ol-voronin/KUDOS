'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AdminPriceRulesDto, PriceAdjustKind, PriceModifierDto, PriceModifierTarget,
} from '@dt/contracts';
import { ApiError } from '@/lib/api-client';
import { AmountField, fromStored, toStored } from './amount-field';
import { createModifier, deleteModifier, updateModifier } from './rules-api';
import { RULES_KEY } from './rules-key';

const TARGET_LABEL: Record<PriceModifierTarget, string> = {
  SIZE_LABEL: 'Розмір',
  FABRIC: 'Тканина',
  COLOUR: 'Колір',
};

/**
 * Надбавки.
 *
 * Правило замість ціни в кожному варіанті — це не оптимізація, а єдиний
 * спосіб, у який цим можна користуватися. Варіантів у нас тисячі: сім виробів
 * на чотири тканини на двадцять три кольори на вісім розмірів. Правил —
 * одиниці, і кожне читається вголос: «2XL дорожчий на 50 ₴».
 */
export function ModifiersPanel({ data }: { data: AdminPriceRulesDto }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const save = useMutation({
    mutationFn: ({ id, ...dto }: { id: string; amount?: number; isActive?: boolean; kind?: PriceAdjustKind }) =>
      updateModifier(id, dto),
    onSuccess: (fresh) => qc.setQueryData(RULES_KEY, fresh),
  });

  const remove = useMutation({
    mutationFn: deleteModifier,
    onSuccess: (fresh) => qc.setQueryData(RULES_KEY, fresh),
  });

  const error = save.error ?? remove.error;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Надбавки</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Формують ціну виробу: база плюс надбавки за розмір, тканину й колір. Складаються між
          собою. Відсоток завжди рахується від базової ціни, тож порядок правил не впливає на
          результат. Відʼємна сума — знижка на цю ознаку.
        </p>
      </div>

      {error && (
        <p className="rounded-card border border-danger px-4 py-3 text-sm text-danger" role="alert">
          {error instanceof ApiError ? error.message : 'Не вдалося зберегти'}
        </p>
      )}

      {data.modifiers.length === 0 && !adding && (
        <p className="text-sm text-ink-subtle">Надбавок немає — ціна виробу дорівнює базовій.</p>
      )}

      {data.modifiers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Назва</th>
                <th scope="col" className="px-3 py-2 font-medium">Діє на</th>
                <th scope="col" className="px-3 py-2 font-medium">Виріб</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Сума</th>
                <th scope="col" className="px-3 py-2 text-center font-medium">Увімкнено</th>
                <th scope="col" className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.modifiers.map((m) => (
                <ModifierRow
                  key={m.id}
                  modifier={m}
                  busy={save.isPending || remove.isPending}
                  onSave={(dto) => save.mutate({ id: m.id, ...dto })}
                  onDelete={() => remove.mutate(m.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding
        ? <NewModifierForm options={data.options} onDone={() => setAdding(false)} />
        : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="self-start rounded-card border border-line px-4 py-2 text-sm text-ink hover:border-ink"
          >
            Додати надбавку
          </button>
        )}
    </section>
  );
}

function ModifierRow({
  modifier, busy, onSave, onDelete,
}: {
  modifier: PriceModifierDto;
  busy: boolean;
  onSave: (dto: { amount?: number; isActive?: boolean }) => void;
  onDelete: () => void;
}) {
  const [typed, setTyped] = useState(fromStored(modifier.amount));
  const stored = toStored(modifier.kind, typed);
  const dirty = stored !== null && stored !== modifier.amount;

  return (
    <tr className="border-b border-line">
      <th scope="row" className="py-2 pr-4 text-left font-medium text-ink">{modifier.name}</th>
      <td className="px-3 py-2 text-ink-muted">{modifier.targetLabel}</td>
      <td className="px-3 py-2 text-ink-muted">{modifier.garmentLabel ?? 'усі'}</td>
      <td className="px-3 py-2 text-right">
        <span className="flex items-center justify-end gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={typed}
            aria-label={`Сума: ${modifier.name}`}
            onChange={(e) => setTyped(e.target.value)}
            onBlur={() => { if (dirty) onSave({ amount: stored }); }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            disabled={busy}
            className={[
              'w-24 rounded-card border px-2 py-1 text-right tabular-nums text-ink',
              stored === null ? 'border-danger' : 'border-line focus:border-ink',
              dirty ? 'bg-sun-soft' : '',
            ].join(' ')}
          />
          <span className="text-ink-subtle">{modifier.kind === 'PERCENT' ? '%' : '₴'}</span>
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={modifier.isActive}
          aria-label={`Увімкнено: ${modifier.name}`}
          disabled={busy}
          onChange={(e) => onSave({ isActive: e.target.checked })}
          className="h-4 w-4"
        />
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

function NewModifierForm({
  options, onDone,
}: {
  options: AdminPriceRulesDto['options'];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [target, setTarget] = useState<PriceModifierTarget>('SIZE_LABEL');
  const [sizeLabel, setSizeLabel] = useState(options.sizeLabels[0] ?? '');
  const [fabricId, setFabricId] = useState(options.fabrics[0]?.id ?? '');
  const [colourId, setColourId] = useState(options.colours[0]?.id ?? '');
  const [garmentId, setGarmentId] = useState('');
  const [kind, setKind] = useState<PriceAdjustKind>('DELTA');
  const [typed, setTyped] = useState('0');

  const create = useMutation({
    mutationFn: createModifier,
    onSuccess: (fresh) => { qc.setQueryData(RULES_KEY, fresh); onDone(); },
  });

  const stored = toStored(kind, typed);
  const canSubmit = name.trim() !== '' && stored !== null && stored !== 0;

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (stored === null) return;
        create.mutate({
          name: name.trim(),
          target,
          sizeLabel: target === 'SIZE_LABEL' ? sizeLabel : null,
          fabricId: target === 'FABRIC' ? fabricId : null,
          colourId: target === 'COLOUR' ? colourId : null,
          garmentId: garmentId === '' ? null : garmentId,
          kind,
          amount: stored,
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
            placeholder="Великі розміри"
            className="w-56 rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Діє на
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as PriceModifierTarget)}
            className="rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
          >
            {(Object.keys(TARGET_LABEL) as PriceModifierTarget[]).map((t) => (
              <option key={t} value={t}>{TARGET_LABEL[t]}</option>
            ))}
          </select>
        </label>

        {target === 'SIZE_LABEL' && (
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Розмір
            <select
              value={sizeLabel}
              onChange={(e) => setSizeLabel(e.target.value)}
              className="rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
            >
              {options.sizeLabels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
        )}

        {target === 'FABRIC' && (
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Тканина
            <select
              value={fabricId}
              onChange={(e) => setFabricId(e.target.value)}
              className="rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
            >
              {options.fabrics.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
        )}

        {target === 'COLOUR' && (
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Колір
            <select
              value={colourId}
              onChange={(e) => setColourId(e.target.value)}
              className="rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
            >
              {options.colours.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Тільки для виробу
          <select
            value={garmentId}
            onChange={(e) => setGarmentId(e.target.value)}
            className="rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
          >
            <option value="">усі вироби</option>
            {options.garments.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Як рахувати
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as PriceAdjustKind)}
            className="rounded-card border border-line px-2 py-1 text-ink focus:border-ink"
          >
            <option value="DELTA">У гривнях</option>
            <option value="PERCENT">У відсотках від бази</option>
          </select>
        </label>

        <AmountField kind={kind} value={typed} onChange={setTyped} label="Сума" />
      </div>

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
