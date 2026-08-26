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
 * Заголовок секції. Порожній рядок не малює нічого — і не лишає відступу.
 *
 * Заголовок набирається капсом вузьким шрифтом: у цьому напрямку розмір і є
 * єдиною окрасою, тому решта тексту навколо може лишатися дрібною й тихою.
 */
export function BlockHeading({ text, lead }: { text: string; lead?: string }) {
  if (text.trim() === '' && (lead ?? '').trim() === '') return null;
  return (
    <div className="mb-6">
      {text.trim() !== '' && (
        <h2 className="text-section font-display font-bold uppercase text-ink">{text}</h2>
      )}
      {(lead ?? '').trim() !== '' && (
        <p className="mt-3 max-w-prose leading-relaxed text-ink-muted">
          <Inline text={lead as string} />
        </p>
      )}
    </div>
  );
}
