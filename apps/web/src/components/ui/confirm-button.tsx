'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './button';

/**
 * Незворотна дія на два кроки.
 *
 * В адмінці не було жодного підтвердження: один клік назавжди видаляв
 * надбавку, пункт меню, зображення з медіатеки (можливо, вже вставлене на
 * живу сторінку) або цілий принт. Скасування немає — отже, підтвердження
 * обовʼязкове.
 *
 * Не `window.confirm`: системне вікно блокує сторінку, виглядає чужим і не
 * каже, що саме зникне. Тут кнопка на місці перетворюється на питання, а
 * через кілька секунд бездіяльності повертається у звичайний стан — щоб
 * випадково відкрите питання не лишалося як міна.
 */
const REVERT_MS = 5000;

export function ConfirmButton({
  onConfirm, label = 'Видалити', question = 'Точно?', size = 'sm', disabled = false,
}: {
  onConfirm: () => void;
  label?: string;
  question?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);

  function arm(): void {
    setArmed(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setArmed(false), REVERT_MS);
  }

  if (!armed) {
    return (
      <Button variant="ghost" size={size} onClick={arm} disabled={disabled} className="hover:text-danger">
        {label}
      </Button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-xs text-ink-muted">{question}</span>
      <Button
        variant="danger"
        size={size}
        onClick={() => { setArmed(false); onConfirm(); }}
      >
        Так
      </Button>
      <Button variant="ghost" size={size} onClick={() => setArmed(false)}>Ні</Button>
    </span>
  );
}
