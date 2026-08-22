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
