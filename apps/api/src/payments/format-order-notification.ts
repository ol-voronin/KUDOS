import { formatUAH, type Minor } from '@dt/contracts';
import { escapeHtml } from '../common/telegram';

export interface PaidOrderNotification {
  readonly orderNumber: number;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly printTitle: string;
  readonly garmentName: string;
  readonly colourName: string;
  readonly sizeLabel: string;
  readonly quantity: number;
  readonly totalMinor: Minor;
  readonly note?: string;
}

/**
 * Fires only once a Monobank webhook has confirmed `status=success` — never
 * on the customer's browser redirect, which they control. See
 * `PaymentsWebhookController`.
 */
export function formatOrderPaid(order: PaidOrderNotification): string {
  const rows = [
    `✅ <b>Оплачено — замовлення №${order.orderNumber}</b>`,
    '',
    `👤 ${escapeHtml(order.customerName)}`,
    `📞 <a href="tel:${escapeHtml(order.customerPhone)}">${escapeHtml(order.customerPhone)}</a>`,
    '',
    `${escapeHtml(order.printTitle)} на ${escapeHtml(order.garmentName)}, ${escapeHtml(order.colourName)}, ${escapeHtml(order.sizeLabel)} × ${order.quantity}`,
    `💰 ${formatUAH(order.totalMinor)}`,
  ];
  if (order.note) rows.push('', escapeHtml(order.note));
  return rows.join('\n').slice(0, 4096);
}


// ---------------------------------------------------------------------------
// Нове замовлення — ще НЕ оплачене
// ---------------------------------------------------------------------------

const DELIVERY_LABEL: Record<string, string> = {
  NP_BRANCH: 'Нова Пошта, відділення',
  NP_POSTOMAT: 'Нова Пошта, поштомат',
  NP_COURIER: 'Нова Пошта, курʼєр',
  PICKUP: 'Самовивіз',
};

export interface PlacedOrderNotification {
  readonly orderNumber: number;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly lines: ReadonlyArray<{
    readonly title: string;
    readonly garmentName: string;
    readonly colourName: string;
    readonly sizeLabel: string;
    readonly quantity: number;
  }>;
  readonly totalMinor: Minor;
  readonly delivery: {
    readonly method: string;
    readonly city: string;
    readonly branch: string;
    readonly recipientName: string;
    readonly recipientPhone: string;
  };
  readonly note?: string;
  /**
   * Рахунок Monobank (HOLD) виставився автоматично при оформленні. Без
   * цього рядка в адмінці його треба виставити вручну.
   */
  readonly invoiceSent?: boolean;
}

/**
 * Приходить у момент оформлення, коли грошей ще немає.
 *
 * Тому перший рядок каже саме це — «нове», а не «оплачено». Сплутати ці два
 * повідомлення означає зібрати й відправити замовлення, за яке ніхто не
 * платив; вони мусять читатися по-різному з першого символу.
 */
export function formatOrderPlaced(order: PlacedOrderNotification): string {
  const rows = [
    `🆕 <b>Нове замовлення №${order.orderNumber}</b> — не оплачене`,
    '',
    `👤 ${escapeHtml(order.customerName)}`,
    `📞 <a href="tel:${escapeHtml(order.customerPhone)}">${escapeHtml(order.customerPhone)}</a>`,
    '',
  ];

  for (const line of order.lines) {
    rows.push(
      `• ${escapeHtml(line.title)} — ${escapeHtml(line.garmentName)}, ${escapeHtml(line.colourName)}, ${escapeHtml(line.sizeLabel)} × ${line.quantity}`,
    );
  }

  rows.push('', `💰 ${formatUAH(order.totalMinor)}`);
  rows.push(order.invoiceSent === true
    ? '💳 Рахунок Monobank (HOLD) виставлено автоматично — коли гроші заблокуються, звір наявність і спиши їх в адмінці'
    : '💳 Рахунку немає — виставити вручну з адмінки');

  const place = order.delivery.method === 'PICKUP'
    ? DELIVERY_LABEL['PICKUP']
    : `${DELIVERY_LABEL[order.delivery.method] ?? order.delivery.method}: ${order.delivery.city}, ${order.delivery.branch}`;
  rows.push(`🚚 ${escapeHtml(place ?? '')}`);

  if (order.delivery.recipientName !== '') {
    rows.push(`📦 Одержувач: ${escapeHtml(order.delivery.recipientName)} ${escapeHtml(order.delivery.recipientPhone)}`);
  }
  if (order.note) rows.push('', escapeHtml(order.note));

  return rows.join('\n').slice(0, 4096);
}
