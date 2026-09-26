'use client';

import type { Ga4Item } from './ga4';

/**
 * Склад замовлення — від каси до сторінки статусу.
 *
 * Подія покупки має нести перелік товарів: без нього GA4 порахує дохід, але
 * не скаже, які принти його принесли, — а це і є питання, заради якого
 * аналітику ставили. Сторінка статусу перелік не знає: публічний ендпоінт
 * віддає лише номер, статус і суму.
 *
 * Розширити той ендпоінт було б найпростіше й найгірше: ключем до нього є
 * самий лише ідентифікатор замовлення, тож будь-хто з посиланням бачив би,
 * що людина купила. Тому склад лишається в браузері того, хто замовляв, і
 * тільки на час одного візиту — `sessionStorage` зникає разом із вкладкою.
 *
 * Якщо знімка немає (інший пристрій, інша вкладка, приватний режим) —
 * покупка все одно надішлеться, просто без переліку. Дохід у звіті лишиться
 * правильним; це свідомий обмін повноти на приватність.
 */

const KEY = (orderId: string): string => `dt.order.${orderId}`;

export interface OrderSnapshot {
  readonly items: readonly Ga4Item[];
  readonly valueMinor: number;
  readonly shippingMinor: number;
  readonly discountMinor: number;
}

export function rememberOrder(orderId: string, snapshot: OrderSnapshot): void {
  try {
    window.sessionStorage.setItem(KEY(orderId), JSON.stringify(snapshot));
  } catch { /* сховище недоступне — покупка піде без переліку товарів */ }
}

export function readOrder(orderId: string): OrderSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(KEY(orderId));
    return raw === null ? null : (JSON.parse(raw) as OrderSnapshot);
  } catch { return null; }
}
