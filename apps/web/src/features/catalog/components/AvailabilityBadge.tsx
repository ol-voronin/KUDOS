import type { Selectability } from '../variant-selection';

/**
 * Без строків і дат — навмисно.
 *
 * Раніше тут стояло «Виготовимо за N дн.», а поруч — дата відправки, яку
 * рахував калькулятор: строк пошиття з бази плюс 4–7 днів друку. Строки в
 * базі заведені із запасом, тож на картці виходило «Відправимо 29 жовтня»
 * для замовлення 16-го — майже три тижні, хоча насправді відправляємо
 * значно швидше. Така дата не допомагала, а відлякувала, тому покупцеві
 * показуємо просту обіцянку, а конкретну дату називаємо, коли підтверджуємо
 * замовлення.
 */
export function AvailabilityBadge({ state }: { state: Selectability }) {
  if (state === 'AVAILABLE' || state === 'MADE_TO_ORDER') {
    return (
      /* Жовта наліпка з палітри бренду замість бірюзової (аудит 17.10, U5). */
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-yellow px-3 py-1 text-xs font-semibold text-ink">
        <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden="true" />
        {state === 'AVAILABLE' ? 'Є в наявності' : 'Друкуємо й відправляємо швидко'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-sunken px-3 py-1 text-xs font-semibold text-ink-subtle">
      <span className="h-1.5 w-1.5 rounded-full bg-ink-subtle" aria-hidden="true" />
      Немає
    </span>
  );
}
