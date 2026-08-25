import { Fragment, type ReactNode } from 'react';
import { isSafeHref, type ContentToken } from '@dt/contracts';
import { site } from '@/config/site';

/**
 * Розбір тексту з мінімальною розміткою.
 *
 * Дозволено рівно два прийоми — `[текст](адреса)` і `**виділення**` — плюс
 * підстановки `{{email}}`. Усе інше лишається звичайним текстом.
 *
 * Чому не Markdown і не HTML. Поле, у яке можна написати HTML, рано чи пізно
 * приймає `<script>`, і редактор вмісту стає точкою входу в сайт. Поле з
 * повним Markdown приймає HTML теж — майже всі парсери дозволяють його за
 * замовчуванням. Тут результат — масив React-елементів, зібраний вручну;
 * `dangerouslySetInnerHTML` не використовується ніде, тож XSS через вміст
 * структурно неможливий, а не «малоймовірний».
 *
 * Ціна: автор не зробить таблицю чи заголовок усередині абзацу. Для цього є
 * окремі типи блоків — і це правильний обмін.
 */

/**
 * Значення, які не можна дублювати в тексті.
 *
 * Реквізити ФОП і контакти в офері мусять бути тими самими, що у футері.
 * Якщо їх набирати руками, вони розійдуться — не одразу, а тоді, коли
 * зміниться телефон і хтось згадає про футер, але не про пункт 1.2.
 */
const TOKENS: Readonly<Record<ContentToken, string>> = {
  brand: site.brand,
  email: site.email,
  phone: site.phoneDisplay ?? site.phone,
  telegram: site.telegram,
  telegramUrl: site.telegramUrl,
  city: site.city,
  cityIn: site.cityIn,
  legalEntity: site.legalEntityName,
  legalEntityShort: site.legalEntityShort,
  taxNumber: site.taxNumber,
  returnDays: String(site.returnDays),
  freeShippingFrom: String(Math.round(site.freeShippingFromMinor / 100)),
};

/** Невідома підстановка лишається як є — щоб помилку було видно, а не з'їдено. */
export function substitute(text: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => {
    const value = (TOKENS as Readonly<Record<string, string | undefined>>)[key];
    return value ?? whole;
  });
}

const PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;

function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href);
}

export function Inline({ text }: { text: string }): ReactNode {
  const source = substitute(text);
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const m of source.matchAll(PATTERN)) {
    const at = m.index;
    if (at > last) out.push(source.slice(last, at));

    const [, label, href, bold] = m;
    if (label !== undefined && href !== undefined && !isSafeHref(href)) {
      // Небезпечна адреса — лишаємо підпис звичайним текстом. Не викидаємо
      // й не показуємо помилку: покупцеві однаково нічим зарадити, а текст
      // речення має лишитися читабельним.
      out.push(label);
    } else if (label !== undefined && href !== undefined) {
      const external = isExternal(href);
      out.push(
        <a
          key={`l${key}`}
          href={href}
          {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
          className="font-medium text-ink underline underline-offset-2 hover:text-accent"
        >
          {label}
        </a>,
      );
    } else if (bold !== undefined) {
      out.push(<strong key={`b${key}`} className="font-semibold text-ink">{bold}</strong>);
    }
    key += 1;
    last = at + m[0].length;
  }

  if (last < source.length) out.push(source.slice(last));

  return <>{out.map((node, i) => <Fragment key={i}>{node}</Fragment>)}</>;
}

/** Абзац із розміткою. Порожній рядок нічого не малює, а не порожній `<p>`. */
export function InlineParagraph({ text, className = '' }: { text: string; className?: string }) {
  if (text.trim() === '') return null;
  return <p className={className}><Inline text={text} /></p>;
}
