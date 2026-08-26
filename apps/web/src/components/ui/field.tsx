import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

/**
 * Поля адмінки.
 *
 * Публічний `features/forms/fields.tsx` лишається як є: там поля навмисно
 * великі, бо їх заповнюють із телефона один раз. В адмінці інша задача —
 * бачити багато полів одночасно, тож щільність вища, а висота менша.
 *
 * До цього рядок класів поля був оголошений трьома окремими константами
 * `inputCls` у трьох файлах. Вони збігалися символ у символ, що означає
 * лише одне: наступна правка збіглася б уже не в усіх трьох.
 */
const BASE =
  'rounded-card border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle ' +
  'focus:outline-none focus:ring-2 disabled:bg-surface-sunken disabled:text-ink-subtle';

/**
 * Колір рамки додається однією гілкою, а не другим класом поверх першого.
 *
 * `border-line` і `border-danger` — утиліти однакової ваги: яка з них
 * переможе, вирішує порядок у зібраному CSS, а не порядок у рядку. Склеїти
 * їх означало б покластися на випадковість — і саме там, де ціна помилки
 * найвища: поле з помилкою виглядало б справним.
 *
 * Ширини в базі теж немає: поля в таблицях мусять бути вузькими, а `w-full`
 * у базі так само мовчки перемагав би `w-auto` на місці виклику.
 */
export function inputClass(invalid = false): string {
  return invalid
    ? `${BASE} border-danger focus:border-danger focus:ring-danger/25`
    : `${BASE} border-line focus:border-ink focus:ring-ink/15`;
}

/**
 * Обгортка «мітка + поле + підказка».
 *
 * Мітка завжди справжня, а не placeholder: placeholder зникає, щойно людина
 * почала друкувати, і саме тоді, коли вона найбільше потрібна — під час
 * перечитування форми перед збереженням — його вже немає.
 */
export function FieldShell({
  label, hint, error, htmlFor, children, className = '',
}: {
  label: string; hint?: string; error?: string; htmlFor?: string;
  children: ReactNode; className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="label-eyebrow" htmlFor={htmlFor}>{label}</label>
      {children}
      {error !== undefined && error !== '' && <p className="text-xs text-danger">{error}</p>}
      {hint !== undefined && error === undefined && <p className="text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

type FieldProps = { label: string; hint?: string; error?: string; className?: string };

export function AdminField({
  label, hint, error, className, id, ...rest
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id} className={className}>
      <input id={id} className={`${inputClass(error !== undefined && error !== '')} w-full`} {...rest} />
    </FieldShell>
  );
}

export function AdminTextArea({
  label, hint, error, className, id, rows = 3, ...rest
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id} className={className}>
      <textarea id={id} rows={rows} className={`${inputClass(error !== undefined && error !== '')} w-full`} {...rest} />
    </FieldShell>
  );
}

export function AdminSelect({
  label, hint, error, className, id, children, ...rest
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id} className={className}>
      <select id={id} className={`${inputClass(error !== undefined && error !== '')} w-full`} {...rest}>{children}</select>
    </FieldShell>
  );
}
