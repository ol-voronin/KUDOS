/** Telegram HTML mode falls over on these three. Ім'я «Аня <3» ламає повідомлення. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

export async function sendToTelegram(text: string): Promise<void> {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  const chatId = process.env['TELEGRAM_CHAT_ID'];
  if (!token || !chatId) throw new Error('TELEGRAM_BOT_TOKEN або TELEGRAM_CHAT_ID не задані');

  // chat_id — це або число (група, особисті), або "@channelname" для
  // публічного каналу, де бот адміністратор. Обидва варіанти лишаємо рядком:
  // Telegram приймає і те, і те.

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });

  if (!res.ok) {
    // Не логуємо URL — у ньому токен.
    throw new Error(`Telegram HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}
