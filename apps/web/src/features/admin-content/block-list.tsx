'use client';

import { useState } from 'react';
import { AnyBlock, type BlockType } from '@dt/contracts';
import { ADD_ORDER, BLOCK_REGISTRY, TONE_OPTIONS, createBlock } from './block-registry';
import { FieldInput } from './field-input';

/**
 * Список блоків сторінки: додати, прибрати, посунути, розгорнути й правити.
 *
 * Порядок міняється стрілками, а не перетягуванням. Це свідомо: drag-n-drop
 * добре виглядає на демонстрації і погано працює там, де ним користуються —
 * на телефоні, з клавіатури й екранною читалкою. Стрілка робить рівно одну
 * зрозумілу дію й доступна всім.
 *
 * Кожен блок перевіряється схемою одразу, а не при збереженні. Дізнатися,
 * що третій блок неправильний, після пʼятнадцяти хвилин роботи над
 * дванадцятим — найгірший з можливих моментів.
 */

interface Props {
  blocks: AnyBlock[];
  onChange: (next: AnyBlock[]) => void;
}

export function BlockList({ blocks, onChange }: Props) {
  const [open, setOpen] = useState<string | null>(blocks[0]?.id ?? null);
  const [adding, setAdding] = useState(false);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    onChange(next);
  };

  const patch = (index: number, name: string, value: unknown) => {
    onChange(blocks.map((b, i) => (i === index ? ({ ...b, [name]: value } as AnyBlock) : b)));
  };

  const add = (type: BlockType) => {
    const block = createBlock(type, blocks.map((b) => b.id));
    onChange([...blocks, block]);
    setOpen(block.id);
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, index) => {
        const spec = BLOCK_REGISTRY[block.type];
        const parsed = AnyBlock.safeParse(block);
        const expanded = open === block.id;

        return (
          <div
            key={block.id}
            className={[
              'rounded-card border bg-surface',
              parsed.success ? 'border-line' : 'border-danger',
            ].join(' ')}
          >
            <div className="flex items-center gap-2 p-3">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : block.id)}
                aria-expanded={expanded}
                className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
              >
                <span className="shrink-0 font-display text-sm font-bold text-ink">{spec.label}</span>
                <span className="truncate text-sm text-ink-muted">{spec.summary(block)}</span>
                {!parsed.success && (
                  <span className="shrink-0 rounded-card bg-danger-soft px-1.5 text-xs font-semibold text-danger">
                    не заповнено
                  </span>
                )}
              </button>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button" onClick={() => move(index, index - 1)} disabled={index === 0}
                  aria-label={`${spec.label}: вище`}
                  className="rounded-card border border-line px-2 py-1 text-xs text-ink-muted disabled:opacity-30"
                >↑</button>
                <button
                  type="button" onClick={() => move(index, index + 1)} disabled={index === blocks.length - 1}
                  aria-label={`${spec.label}: нижче`}
                  className="rounded-card border border-line px-2 py-1 text-xs text-ink-muted disabled:opacity-30"
                >↓</button>
                <button
                  type="button"
                  onClick={() => onChange(blocks.filter((_, i) => i !== index))}
                  aria-label={`${spec.label}: прибрати блок`}
                  className="rounded-card border border-line px-2 py-1 text-xs text-danger"
                >×</button>
              </div>
            </div>

            {expanded && (
              <div className="flex flex-col gap-4 border-t border-line p-4">
                <p className="text-xs leading-relaxed text-ink-subtle">{spec.hint}</p>

                {spec.fields.map((field) => (
                  <FieldInput
                    key={field.name}
                    field={field}
                    value={(block as unknown as Record<string, unknown>)[field.name]}
                    onChange={(next) => patch(index, field.name, next)}
                  />
                ))}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-ink-subtle" htmlFor={`tone-${block.id}`}>
                    Фон секції
                  </label>
                  <select
                    id={`tone-${block.id}`}
                    className="mt-1 rounded-card border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                    value={block.tone}
                    onChange={(e) => patch(index, 'tone', e.target.value)}
                  >
                    {TONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-ink-subtle">
                    Сусідні блоки з однаковим фоном зливаються в одну секцію — між ними не буде зайвої порожнечі.
                  </p>
                </div>

                {!parsed.success && (
                  <p className="rounded-card bg-danger-soft px-3 py-2 text-xs text-danger" role="alert">
                    {parsed.error.issues.map((i) => `${i.path.join('.') || 'блок'}: ${i.message}`).join('; ')}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {blocks.length === 0 && (
        <p className="rounded-card border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-subtle">
          Сторінка порожня. Почніть із блока «Герой».
        </p>
      )}

      {adding ? (
        <div className="rounded-card border border-line bg-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-sm font-bold text-ink">Який блок додати</span>
            <button type="button" onClick={() => setAdding(false)} className="text-sm text-ink-muted">Скасувати</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {ADD_ORDER.map((type) => (
              <button
                key={type} type="button" onClick={() => add(type)}
                className="rounded-card border border-line p-3 text-left transition hover:border-ink"
              >
                <span className="block font-display text-sm font-bold text-ink">{BLOCK_REGISTRY[type].label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{BLOCK_REGISTRY[type].hint}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          type="button" onClick={() => setAdding(true)}
          className="rounded-card border-2 border-dashed border-line-strong px-4 py-3 text-sm font-medium text-ink-muted transition hover:border-ink hover:text-ink"
        >
          Додати блок
        </button>
      )}
    </div>
  );
}
