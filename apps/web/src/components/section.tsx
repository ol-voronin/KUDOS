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

/*
 * Ключі тонів ті самі (їх зберігає редактор блоків), а кольори — з палітри
 * бренду (аудит 17.10, U5). М'ятна, рожева, пісочна й персикова підкладки
 * сайт колись підібрав сам, у бренді їх немає. Тепер:
 *   teal / sun   → жовтий бренду (фінальні заклики «Лишилось питання?»,
 *                  цифри на «Про нас»), текст на ньому чорний;
 *   plum / accent → кремовий, як `cream` (майже білий).
 */
const TONES: Record<Tone, string> = {
  plain: 'bg-surface',
  cream: 'bg-surface-sunken',
  accent: 'bg-surface-sunken',
  teal: 'tone-yellow',
  sun: 'tone-yellow',
  plum: 'bg-surface-sunken',
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
