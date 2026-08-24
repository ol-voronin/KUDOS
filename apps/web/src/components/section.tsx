import type { ReactNode } from 'react';

/**
 * Секція з фоном на всю ширину і вмістом у сітці.
 *
 * До цього кожна секція головної була просто `max-w-6xl` на білому — сторінка
 * читалась як один довгий документ без пауз. Зона кольору робить видимою
 * зміну теми: тут ми продаємо, тут пояснюємо, тут доводимо, що нам можна
 * довіряти. Колір несе зміст, а не прикрашає, тому тонів рівно стільки,
 * скільки в палітрі змістових акцентів.
 */
export type Tone = 'plain' | 'cream' | 'accent' | 'teal' | 'sun' | 'plum' | 'ink';

const TONES: Record<Tone, string> = {
  plain: 'bg-surface',
  cream: 'bg-surface-sunken',
  accent: 'bg-accent-soft',
  teal: 'bg-teal-soft',
  sun: 'bg-sun-soft',
  plum: 'bg-plum-soft',
  ink: 'bg-ink text-surface',
};

export function Section({
  children, tone = 'plain', id, className = '',
}: { children: ReactNode; tone?: Tone; id?: string; className?: string }) {
  return (
    <section id={id} className={`${TONES[tone]} ${className}`}>
      <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">{children}</div>
    </section>
  );
}
