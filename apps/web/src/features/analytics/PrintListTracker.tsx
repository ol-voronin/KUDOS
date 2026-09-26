'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { ga4SelectItem, ga4ViewItemList, hryvnia, type Ga4Item } from './ga4';
import type { ListName } from './lists';

/**
 * Сітка принтів як список у звіті GA4.
 *
 * Дає дві речі, яких інакше нема звідки взяти: `view_item_list` — скільки
 * разів вітрину взагалі показали, і `select_item` — з якої саме вітрини
 * прийшов клік. Без них усі переходи в картку принта зливаються в одну
 * купу, і питання «що продає краще — породна сторінка чи колекція»
 * лишається без відповіді назавжди: історію не перепишеш.
 *
 * ── Чому клік ловиться делегуванням ───────────────────────────────────
 *
 * Плитка принта — серверний компонент, і вона такою й лишається: зробити
 * її клієнтською заради одного обробника означає відправити в браузер весь
 * її код на кожній із чотирьох сіток. Один слухач на обгортці коштує
 * дешевше й ловить те саме.
 *
 * Слухач висить на обгортці, а не на документі, — саме тому обгортка тут і
 * є. На породній сторінці сіток дві, на головній три; слухач на документі
 * порахував би клік у кожній із них, хоча клікнули в одну.
 */
export interface ListedPrint {
  readonly slug: string;
  readonly title: string;
  readonly fromPriceMinor: number | null;
}

export function PrintListTracker({
  list, listId, prints, children,
}: {
  list: ListName;
  /** Слаг конкретної вітрини: `taksa`, `pab`. Вид списку без нього німий. */
  listId?: string;
  prints: readonly ListedPrint[];
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const sent = useRef<string | null>(null);

  const key = `${list}:${listId ?? ''}:${prints.map((p) => p.slug).join(',')}`;

  useEffect(() => {
    if (prints.length === 0 || sent.current === key) return;
    sent.current = key;
    ga4ViewItemList(list, prints.map(toItem), listId);
  }, [key, list, listId, prints]);

  useEffect(() => {
    const node = box.current;
    if (node === null) return;

    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest?.('a[href^="/prints/"]');
      if (link === null || link === undefined) return;
      const slug = link.getAttribute('href')?.slice('/prints/'.length) ?? '';
      const index = prints.findIndex((p) => p.slug === slug);
      if (index === -1) return;
      ga4SelectItem(list, toItem(prints[index] as ListedPrint), index, listId);
    };

    node.addEventListener('click', onClick, { capture: true });
    return () => node.removeEventListener('click', onClick, { capture: true });
  }, [list, listId, prints]);

  return <div ref={box}>{children}</div>;
}

function toItem(print: ListedPrint): Ga4Item {
  return {
    item_id: print.slug,
    item_name: print.title,
    item_category: 'Принт',
    ...(print.fromPriceMinor === null ? {} : { price: hryvnia(print.fromPriceMinor) }),
  };
}
