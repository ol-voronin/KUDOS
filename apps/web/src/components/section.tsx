import type { ReactNode } from 'react';

/**
 * Секція з фоном на всю ширину і вмістом у сітці.
 *
 * Тони лишилися ті самі — їх вибирають у редакторі блоків, і міняти набір
 * означало б переписувати вміст сторінок. Змінилася їхня сила: після появи
 * фотографій кольорові зони почали сперечатися з принтом, тому підкладки
 * приглушені до майже-паперових. Тон тепер каже «тут інша тема», а не
 * «дивись сюди».
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
    <section
      id={id}
      className={`${TONES[tone]} ${className}`}
      /*
       * Курсор на чорній секції має бути світлим — так само, як на
       * фотографії. Прапорець ставить сама секція, а не той, хто її
       * викликає: тон і колір курсора — це одне рішення, і рознесені по
       * двох місцях вони обовʼязково розійдуться.
       */
      {...(tone === 'ink' ? { 'data-cursor': 'light' } : {})}
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16">{children}</div>
    </section>
  );
}
