'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Підтвердження, що дія сталася.
 *
 * До цього мутації в адмінці завершувалися мовчки: ціна зберігалася на
 * `onBlur`, підсвітка «змінено» гасла — і все. Людина не могла відрізнити
 * «збережено» від «нічого не сталося», тому зберігала ще раз.
 *
 * Свідомо просто: рядок унизу екрана, який сам зникає. Ніяких дій усередині
 * тосту — якщо дію можна скасувати, це має бути видно на самому екрані, а не
 * ховатися в повідомленні, що зникає через чотири секунди.
 */
type Tone = 'ok' | 'error';
type Toast = { id: number; text: string; tone: Tone };

const Ctx = createContext<((text: string, tone?: Tone) => void) | null>(null);

const LIFETIME_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<readonly Toast[]>([]);
  const next = useRef(1);

  const push = useCallback((text: string, tone: Tone = 'ok') => {
    const id = next.current++;
    setItems((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), LIFETIME_MS);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {/*
        `polite`, а не `assertive`: успішне збереження не варте того, щоб
        перебивати те, що людина читає зараз.
      */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4"
      >
        {items.map((t) => (
          <p
            key={t.id}
            className={[
              'pointer-events-auto rounded-pill px-4 py-2 text-sm font-medium shadow-sm',
              t.tone === 'ok' ? 'bg-ink text-surface' : 'bg-danger text-white',
            ].join(' ')}
          >
            {t.text}
          </p>
        ))}
      </div>
    </Ctx.Provider>
  );
}

/**
 * Поза провайдером повертає функцію-пустушку, а не кидає.
 *
 * Тост — це підтвердження, а не сама дія. Якщо компонент випадково опинився
 * поза провайдером (наприклад, у тесті), правильна поведінка — зберегти дані
 * й промовчати, а не зламати збереження заради повідомлення про нього.
 */
export function useToast(): (text: string, tone?: Tone) => void {
  const ctx = useContext(Ctx);
  return ctx ?? noop;
}

function noop(): void { /* поза провайдером мовчимо */ }
