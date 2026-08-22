import { escapeHtml } from '../common/telegram';

export interface Lead {
  readonly name: string;
  readonly phone: string;
  readonly message?: string;
  readonly source?: string;
}

export function formatLead(lead: Lead): string {
  const rows = [
    '🔔 <b>Нова заявка</b>',
    '',
    `👤 ${escapeHtml(lead.name)}`,
    `📞 <a href="tel:${escapeHtml(lead.phone)}">${escapeHtml(lead.phone)}</a>`,
  ];
  if (lead.message) rows.push('', escapeHtml(lead.message));
  if (lead.source) rows.push('', `<i>${escapeHtml(lead.source)}</i>`);
  return rows.join('\n').slice(0, 4096);
}

