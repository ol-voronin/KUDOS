'use client';

import type { ReactNode } from 'react';

/**
 * Примітиви форм — одні на заявку й на бриф.
 *
 * Рішення, які тут зашиті й не мають перевідкриватися в кожній формі:
 *  • підпис видимий завжди, не плейсхолдер — плейсхолдер зникає, щойно почав
 *    писати, і людина забуває, що це за поле;
 *  • помилка привʼязана до поля через aria-describedby і має іконку, а не сам
 *    лише червоний колір;
 *  • поле 52px, кнопка 56px — щоб потрапляти пальцем;
 *  • aria-invalid, щоб скрінрідер сказав про помилку, а не лишив її візуальною.
 */

const FIELD_BASE =
  'block w-full rounded-card border bg-surface-raised px-4 text-base text-ink ' +
  'placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-surface';

function ErrorLine({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
           strokeLinecap="round" aria-hidden="true" className="mt-0.5 shrink-0">
        <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: string | undefined;
  type?: 'text' | 'tel' | 'email' | 'date';
  placeholder?: string | undefined;
  required?: boolean;
  autoComplete?: string;
}

export function Field({
  id, label, value, onChange, error, hint, type = 'text', placeholder, required, autoComplete,
}: FieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}{required && <span className="text-ink-subtle"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={[FIELD_BASE, 'h-13 py-3', error ? 'border-danger border-2' : 'border-line'].join(' ')}
       
      />
      {hint && !error && <p id={hintId} className="mt-1.5 text-sm text-ink-muted">{hint}</p>}
      {error && <ErrorLine id={errorId}>{error}</ErrorLine>}
    </div>
  );
}

interface TextAreaProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: string | undefined;
  placeholder?: string | undefined;
  rows?: number;
  required?: boolean;
}

export function TextArea({ id, label, value, onChange, error, hint, placeholder, rows = 4, required }: TextAreaProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}{required && <span className="text-ink-subtle"> *</span>}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={[FIELD_BASE, 'py-3 leading-relaxed', error ? 'border-danger border-2' : 'border-line'].join(' ')}
      />
      {hint && !error && <p id={hintId} className="mt-1.5 text-sm text-ink-muted">{hint}</p>}
      {error && <ErrorLine id={errorId}>{error}</ErrorLine>}
    </div>
  );
}

export function Select({
  id, label, value, onChange, options, required,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>; required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}{required && <span className="text-ink-subtle"> *</span>}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[FIELD_BASE, 'h-13', 'border-line'].join(' ')}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/**
 * Згода — окремою галочкою, з текстом навіщо. Заявка сама по собі є згодою
 * відповісти щодо неї; згода на розсилку — інша річ, і питається окремо.
 */
export function Consent({
  id, checked, onChange, error, children,
}: {
  id: string; checked: boolean; onChange: (v: boolean) => void;
  error?: string | undefined; children: ReactNode;
}) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 rounded-card border-line text-ink focus:ring-2 focus:ring-ink"
        />
        <span className="text-sm leading-relaxed text-ink-muted">{children}</span>
      </label>
      {error && <ErrorLine id={errorId}>{error}</ErrorLine>}
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="w-full rounded-pill bg-ink px-6 text-base font-semibold text-surface transition
                 hover:bg-ink/85 focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2
                 disabled:cursor-not-allowed disabled:opacity-60 h-15"
    >
      {pending ? 'Надсилаємо…' : children}
    </button>
  );
}

/** Успіх — не тост, який зникне: людина має встигнути прочитати номер. */
export function SuccessPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="status" className="rounded-card border-l-2 border-ok bg-ok-soft px-5 py-4">
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-muted">{children}</div>
    </div>
  );
}
