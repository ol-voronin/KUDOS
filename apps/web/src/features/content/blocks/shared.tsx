import { isSafeHref, type BlockLink } from '@dt/contracts';
import { Button, ButtonLink } from '@/components/ui';
import { Inline } from '../inline';

/**
 * Кнопки блока. Перша — заливкою, решта контуром, якщо не сказано інакше.
 *
 * Рецепт кнопки більше не живе тут: він один на весь застосунок і лежить у
 * `components/ui/button`. Цей файл вирішує лише те, що вирішувати саме йому —
 * яка з кнопок блока головна і чи взагалі можна довіряти адресі.
 */
export function BlockLinks({
  links, className = '', onDark = false,
}: { links: readonly BlockLink[]; className?: string; onDark?: boolean }) {
  if (links.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {links.map((l, i) => {
        // Адреса перевіряється ще раз, уже підставленим значенням: у схемі
        // могла лежати підстановка `{{telegramUrl}}`, а що саме в неї
        // підставилося — вирішують налаштування. Небезпечна адреса лишається
        // написом, а не стає робочою кнопкою.
        if (!isSafeHref(l.href)) {
          return (
            <Button key={`${l.href}-${i}`} variant="ghost" disabled>{l.label}</Button>
          );
        }
        const secondary = l.secondary || i > 0;
        // На фотографії чорна кнопка тоне в затемненні, а обведена чорним
        // не читається зовсім. Тому там своя пара: біла заливка і біле
        // обведення.
        const variant = onDark
          ? (secondary ? 'onDarkOutline' : 'onDark')
          : (secondary ? 'outline' : 'primary');
        return (
          <ButtonLink key={`${l.href}-${i}`} href={l.href} variant={variant} size="lg">
            {l.label}
          </ButtonLink>
        );
      })}
    </div>
  );
}

/**
 * Набір класів для блока залежно від того, на чому він стоїть.
 *
 * Тон `ink` (чорна секція) існував у типах ще до цього файлу, і його можна
 * було вибрати в адмінці — але жоден блок про нього не знав. Результат був
 * передбачуваний: чорний текст на чорному тлі й чорна кнопка, якої не видно.
 * Тепер тон їде від секції до блока, а звідси — до конкретних класів.
 *
 * Прозорість, а не окремі кольори: `text-surface/75` на чорному дає рівно ту
 * саму градацію «заголовок / текст / підпис», що `ink → ink-muted →
 * ink-subtle` на білому, і не потребує другої палітри, яку довелося б
 * тримати в актуальному стані.
 */
export interface BlockPalette {
  readonly head: string;
  readonly body: string;
  readonly faint: string;
  readonly rule: string;
  readonly ruleStrong: string;
  readonly plate: string;
}

export function palette(onDark = false): BlockPalette {
  return onDark
    ? {
      head: 'text-surface',
      body: 'text-surface/75',
      faint: 'text-surface/55',
      rule: 'border-surface/20',
      ruleStrong: 'border-surface/45',
      plate: 'bg-surface/10',
    }
    : {
      head: 'text-ink',
      body: 'text-ink-muted',
      faint: 'text-ink-subtle',
      rule: 'border-line',
      ruleStrong: 'border-ink',
      plate: 'bg-surface-sunken',
    };
}

/**
 * Заголовок секції. Порожній рядок не малює нічого — і не лишає відступу.
 *
 * Заголовок набирається капсом вузьким шрифтом: у цьому напрямку розмір і є
 * єдиною окрасою, тому решта тексту навколо може лишатися дрібною й тихою.
 */
export function BlockHeading({
  text, lead, onDark = false,
}: { text: string; lead?: string; onDark?: boolean }) {
  if (text.trim() === '' && (lead ?? '').trim() === '') return null;
  const c = palette(onDark);
  return (
    <div className="mb-6">
      {text.trim() !== '' && (
        <h2 className={`text-section font-display font-bold uppercase ${c.head}`}>{text}</h2>
      )}
      {(lead ?? '').trim() !== '' && (
        <p className={`mt-3 max-w-prose leading-relaxed ${c.body}`}>
          <Inline text={lead as string} />
        </p>
      )}
    </div>
  );
}
