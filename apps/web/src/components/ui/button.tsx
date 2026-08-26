import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Одна кнопка на весь застосунок.
 *
 * До цього в коді жило чотирнадцять різних рецептів: три конкурентні заливки
 * для «головної» дії, пʼять розмірів обведеної й чотири способи написати
 * «видалити». Вони розʼїхалися не тому, що хтось помилявся, а тому що не було
 * куди подітися — спільної кнопки не існувало.
 *
 * Варіантів навмисно шість, і кожен відповідає на питання «що станеться»:
 *
 *   primary  — головна дія екрана. На екрані вона одна.
 *   accent   — подія, а не дія: єдиний акцентний колір лишається за знижкою,
 *              новинкою й персоналізацією. Кнопкою стає рідко й свідомо.
 *   outline  — рівнозначна альтернатива поруч із primary.
 *   quiet    — другорядне: «ще», «назад», пагінація.
 *   ghost    — дія без ваги: «скасувати».
 *   danger   — незворотне. Червоне обведення, заливка тільки під курсором,
 *              щоб випадкове влучання не виглядало як запрошення.
 */
type Variant = 'primary' | 'accent' | 'outline' | 'quiet' | 'ghost' | 'danger' | 'onDark' | 'onDarkOutline';
type Size = 'lg' | 'md' | 'sm';

const VARIANT: Record<Variant, string> = {
  primary: 'border-ink bg-ink text-surface hover:bg-ink/85',
  accent: 'border-accent bg-accent text-white hover:bg-accent-strong',
  outline: 'border-ink bg-transparent text-ink hover:bg-ink hover:text-surface',
  quiet: 'border-line bg-transparent text-ink hover:border-ink',
  ghost: 'border-transparent bg-transparent text-ink-muted hover:text-ink',
  danger: 'border-danger bg-transparent text-danger hover:bg-danger hover:text-surface',
  /* Пара для тексту поверх фотографії. */
  onDark: 'border-white bg-white text-ink hover:bg-white/85',
  onDarkOutline: 'border-white/70 bg-transparent text-white hover:bg-white hover:text-ink',
};

/**
 * Висота кнопок.
 *
 * Підняті проти першої версії, і причина в наборі: заголовки тут набрані
 * вузьким капсом у 5rem, і на їхньому тлі кнопка у 44px читалася як
 * службовий елемент, а не як головна дія сторінки. Поруч із великим
 * шрифтом кнопка мусить мати вагу.
 *
 * Ширина росте разом із висотою: кнопка, що виросла тільки вгору,
 * перетворюється на приплюснутий прямокутник.
 */
const SIZE: Record<Size, string> = {
  lg: 'min-h-15 px-9 text-base',
  md: 'min-h-13 px-7 text-[0.95rem]',
  /** Рядкова кнопка в таблиці: `tap-sm` знімає загальний поріг у 44px. */
  sm: 'tap-sm min-h-9 px-4 text-xs',
};

function classes(variant: Variant, size: Size, full: boolean, extra?: string): string {
  return [
    'inline-flex items-center justify-center gap-2 rounded-pill border font-semibold',
    // Кнопка ледь піднімається під курсором і сідає назад при натисканні —
    // рух на 1px, який відчувається, але не помічається.
    'transition-[background-color,color,border-color,transform] duration-200',
    'hover:-translate-y-px active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none',
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0',
    VARIANT[variant],
    SIZE[size],
    full ? 'w-full' : '',
    extra ?? '',
  ].filter(Boolean).join(' ');
}

type Shared = { variant?: Variant; size?: Size; full?: boolean; children: ReactNode };

export function Button({
  variant = 'primary', size = 'md', full = false, className, type = 'button', children, ...rest
}: Shared & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button type={type} className={classes(variant, size, full, className)} {...rest}>
      {children}
    </button>
  );
}

/**
 * Те саме, але посилання. Окремий компонент, а не проп `href`: кнопка й
 * посилання по-різному поводяться з клавіатурою, і підміна тегу «за пропом»
 * робить це непомітним у місці виклику.
 */
export function ButtonLink({
  href, variant = 'primary', size = 'md', full = false, className, children, ...rest
}: Shared & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'>) {
  const external = href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:');
  const cls = classes(variant, size, full, className);
  if (external) {
    return <a href={href} className={cls} rel="noopener noreferrer" target="_blank" {...rest}>{children}</a>;
  }
  return <Link href={href} className={cls} {...rest}>{children}</Link>;
}
