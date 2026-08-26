'use client';

import { emptyItem, type Field } from './fields';
import { ImageDropTarget } from './image-drop-target';
import { inputClass } from '@/components/ui';

/**
 * Одне поле форми, побудоване з опису.
 *
 * Значення приходить як `unknown` і приводиться до типу тут, у кожній гілці
 * окремо. Виглядає надлишково, але саме це дозволяє редактору відкрити блок
 * старого покоління: поле, якого в даних ще немає, покаже порожнє значення
 * замість того, щоб уронити весь екран на `undefined.map`.
 */


function asString(v: unknown): string { return typeof v === 'string' ? v : ''; }
function asNumber(v: unknown, fallback: number): number { return typeof v === 'number' ? v : fallback; }
function asArray(v: unknown): unknown[] { return Array.isArray(v) ? v : []; }
function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Кнопки «вгору / вниз / прибрати» для будь-якого списку. */
function RowControls({
  index, total, onMove, onRemove, label,
}: { index: number; total: number; onMove: (from: number, to: number) => void; onRemove: (i: number) => void; label: string }) {
  return (
    <div className="flex shrink-0 gap-1">
      <button
        type="button" onClick={() => onMove(index, index - 1)} disabled={index === 0}
        aria-label={`${label} ${index + 1}: вище`}
        className="rounded-card border border-line px-2 py-1 text-xs text-ink-muted disabled:opacity-30"
      >↑</button>
      <button
        type="button" onClick={() => onMove(index, index + 1)} disabled={index === total - 1}
        aria-label={`${label} ${index + 1}: нижче`}
        className="rounded-card border border-line px-2 py-1 text-xs text-ink-muted disabled:opacity-30"
      >↓</button>
      <button
        type="button" onClick={() => onRemove(index)}
        aria-label={`${label} ${index + 1}: прибрати`}
        className="rounded-card border border-line px-2 py-1 text-xs text-danger"
      >×</button>
    </div>
  );
}

/**
 * Операції над списком. НЕ хук: назви з `use` тут бути не може, бо функція
 * викликається всередині `switch`, а хук у гілці — порушення правил React.
 */
function listOps(value: unknown, onChange: (next: unknown) => void) {
  const items = asArray(value);
  return {
    items,
    move: (from: number, to: number) => {
      if (to < 0 || to >= items.length) return;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onChange(next);
    },
    remove: (i: number) => onChange(items.filter((_, n) => n !== i)),
    add: (item: unknown) => onChange([...items, item]),
    set: (i: number, item: unknown) => onChange(items.map((v, n) => (n === i ? item : v))),
  };
}

export function FieldInput({
  field, value, onChange,
}: { field: Field; value: unknown; onChange: (next: unknown) => void }) {
  const id = `f-${field.name}`;

  const help = field.help ? (
    <p className="mt-1 text-xs leading-relaxed text-ink-subtle">{field.help}</p>
  ) : null;

  switch (field.kind) {
    case 'text':
      return (
        <div>
          <label className="label-eyebrow" htmlFor={id}>{field.label}</label>
          <input
            id={id} type="text" className={`${inputClass()} w-full mt-1`} value={asString(value)}
            placeholder={field.placeholder ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
          {help}
        </div>
      );

    case 'textarea':
    case 'rich':
      return (
        <div>
          <label className="label-eyebrow" htmlFor={id}>{field.label}</label>
          <textarea
            id={id} rows={field.rows ?? 3} className={`${inputClass()} w-full mt-1 leading-relaxed`}
            value={asString(value)} onChange={(e) => onChange(e.target.value)}
          />
          {help}
        </div>
      );

    case 'number':
      return (
        <div>
          <label className="label-eyebrow" htmlFor={id}>{field.label}</label>
          <input
            id={id} type="number" min={field.min} max={field.max}
            className={`${inputClass()} mt-1 w-28 tabular-nums`}
            value={asNumber(value, field.min)}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange(Number.isFinite(n) ? Math.min(field.max, Math.max(field.min, Math.round(n))) : field.min);
            }}
          />
          {help}
        </div>
      );

    case 'select': {
      // `columns` у схемі — число, а `<select>` завжди віддає рядок. Тому
      // повертаємо число там, де варіанти числові: інакше блок перестане
      // проходити схему рівно після зміни випадного списку.
      const numeric = field.options.every((o) => /^\d+$/.test(o.value));
      return (
        <div>
          <label className="label-eyebrow" htmlFor={id}>{field.label}</label>
          <select
            id={id} className={`${inputClass()} w-full mt-1`}
            value={String(value ?? field.options[0]?.value ?? '')}
            onChange={(e) => onChange(numeric ? Number(e.target.value) : e.target.value)}
          >
            {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {help}
        </div>
      );
    }

    case 'toggle':
      return (
        <div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox" className="h-4 w-4" checked={value === true}
              onChange={(e) => onChange(e.target.checked)}
            />
            {field.label}
          </label>
          {help}
        </div>
      );

    case 'image': {
      const img = asRecord(value);
      return (
        <fieldset className="rounded-card border border-line p-3">
          <legend className="label-eyebrow">{field.label}</legend>
          <ImageDropTarget
            url={asString(img['url'])}
            alt={asString(img['alt'])}
            onPick={(asset) => onChange({
              ...img, url: asset.url,
              // Опис підставляємо з медіатеки, але не затираємо вже написаний:
              // у блоці він може бути точнішим за загальний.
              alt: asString(img['alt']) || asset.alt,
            })}
            onClear={() => onChange({ ...img, url: '' })}
          />
          <div className="mt-2 flex flex-col gap-2">
            <input
              type="text" className={`${inputClass()} w-full`} placeholder="Опис для тих, хто не бачить картинку" aria-label="Опис для тих, хто не бачить картинку"
              value={asString(img['alt'])}
              onChange={(e) => onChange({ ...img, alt: e.target.value })}
            />
            <input
              type="text" className={`${inputClass()} w-full`} placeholder="Підпис під картинкою" aria-label="Підпис під картинкою"
              value={asString(img['caption'])}
              onChange={(e) => onChange({ ...img, caption: e.target.value })}
            />
          </div>
        </fieldset>
      );
    }

    case 'images': {
      const ops = listOps(value, onChange);
      return (
        <fieldset className="rounded-card border border-line p-3">
          <legend className="label-eyebrow">{field.label}</legend>
          <div className="flex flex-col gap-3">
            {ops.items.map((raw, i) => {
              const img = asRecord(raw);
              return (
                <div key={i} className="flex gap-2">
                  <div className="flex flex-1 flex-col gap-2">
                    <ImageDropTarget
                      url={asString(img['url'])}
                      alt={asString(img['alt'])}
                      compact
                      onPick={(asset) => ops.set(i, {
                        ...img, url: asset.url, alt: asString(img['alt']) || asset.alt,
                      })}
                      onClear={() => ops.set(i, { ...img, url: '' })}
                    />
                    <input
                      type="text" className={`${inputClass()} w-full`} placeholder="Опис картинки" aria-label="Опис картинки"
                      value={asString(img['alt'])}
                      onChange={(e) => ops.set(i, { ...img, alt: e.target.value })}
                    />
                    <input
                      type="text" className={`${inputClass()} w-full`} placeholder="Підпис" aria-label="Підпис"
                      value={asString(img['caption'])}
                      onChange={(e) => ops.set(i, { ...img, caption: e.target.value })}
                    />
                  </div>
                  <RowControls index={i} total={ops.items.length} onMove={ops.move} onRemove={ops.remove} label="Фото" />
                </div>
              );
            })}
          </div>
          {ops.items.length < field.max && (
            <button
              type="button" onClick={() => ops.add({ url: '', alt: '', caption: '' })}
              className="mt-3 rounded-card border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-ink hover:text-ink"
            >Додати фото</button>
          )}
        </fieldset>
      );
    }

    case 'links': {
      const ops = listOps(value, onChange);
      return (
        <fieldset className="rounded-card border border-line p-3">
          <legend className="label-eyebrow">{field.label}</legend>
          <div className="flex flex-col gap-2">
            {ops.items.map((raw, i) => {
              const link = asRecord(raw);
              return (
                <div key={i} className="flex gap-2">
                  <input
                    type="text" className={`${inputClass()} w-full`} placeholder="Напис на кнопці" aria-label="Напис на кнопці"
                    value={asString(link['label'])}
                    onChange={(e) => ops.set(i, { ...link, label: e.target.value })}
                  />
                  <input
                    type="text" className={`${inputClass()} w-full`} placeholder="/адреса" aria-label="/адреса"
                    value={asString(link['href'])}
                    onChange={(e) => ops.set(i, { ...link, href: e.target.value })}
                  />
                  <RowControls index={i} total={ops.items.length} onMove={ops.move} onRemove={ops.remove} label="Кнопка" />
                </div>
              );
            })}
          </div>
          {ops.items.length < field.max && (
            <button
              type="button" onClick={() => ops.add({ label: '', href: '/', secondary: false })}
              className="mt-3 rounded-card border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-ink hover:text-ink"
            >Додати кнопку</button>
          )}
          <p className="mt-2 text-xs text-ink-subtle">
            Перша кнопка малюється заливкою, решта — контуром. Адреса має починатися з «/» або з «https://».
          </p>
        </fieldset>
      );
    }

    case 'strings': {
      const ops = listOps(value, onChange);
      return (
        <fieldset className="rounded-card border border-line p-3">
          <legend className="label-eyebrow">{field.label}</legend>
          <div className="flex flex-col gap-2">
            {ops.items.map((raw, i) => (
              <div key={i} className="flex gap-2">
                <textarea
                  rows={2} className={`${inputClass()} w-full leading-relaxed`} value={asString(raw)}
                  aria-label={`${field.itemLabel} ${i + 1}`}
                  onChange={(e) => ops.set(i, e.target.value)}
                />
                <RowControls index={i} total={ops.items.length} onMove={ops.move} onRemove={ops.remove} label={field.itemLabel} />
              </div>
            ))}
          </div>
          {ops.items.length < field.max && (
            <button
              type="button" onClick={() => ops.add('')}
              className="mt-3 rounded-card border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-ink hover:text-ink"
            >Додати {field.itemLabel.toLowerCase()}</button>
          )}
          {field.rich && <p className="mt-2 text-xs text-ink-subtle">{'Можна: [текст](/адреса), **жирний**, {{email}}.'}</p>}
        </fieldset>
      );
    }

    case 'list': {
      const ops = listOps(value, onChange);
      return (
        <fieldset className="rounded-card border border-line p-3">
          <legend className="label-eyebrow">{field.label}</legend>
          <div className="flex flex-col gap-3">
            {ops.items.map((raw, i) => {
              const item = asRecord(raw);
              return (
                <div key={i} className="rounded-card bg-surface-sunken p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-subtle">{field.itemLabel} {i + 1}</span>
                    <RowControls index={i} total={ops.items.length} onMove={ops.move} onRemove={ops.remove} label={field.itemLabel} />
                  </div>
                  <div className="flex flex-col gap-3">
                    {field.fields.map((sub) => (
                      <FieldInput
                        key={sub.name} field={sub} value={item[sub.name]}
                        onChange={(next) => ops.set(i, { ...item, [sub.name]: next })}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {ops.items.length < field.max && (
            <button
              type="button" onClick={() => ops.add(emptyItem(field.fields))}
              className="mt-3 rounded-card border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-ink hover:text-ink"
            >Додати {field.itemLabel.toLowerCase()}</button>
          )}
        </fieldset>
      );
    }

    default: {
      const exhaustive: never = field;
      void exhaustive;
      return null;
    }
  }
}
