import { Fragment, type ReactNode } from 'react';
import { isSafeHref, type ContentToken } from '@dt/contracts';

/**
 * Розбір тексту з мінімальною розміткою.
 *
 * Дозволено рівно два прийоми — `[текст](адреса)` і `**виділення**`. Усе
 * інше лишається звичайним текстом.
 *
 * Підстановок `{{email}}` тут більше немає: їх робить API, коли віддає
 * сторінку. Доти таблиця значень жила тут — і була другою копією реквізитів
 * поруч із базою, тобто рівно тим механізмом, який рано чи пізно показує
 * покупцеві старий телефон.
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

const PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;

function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href);
}

export function Inline({ text }: { text: string }): ReactNode {
  const source = text;
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
