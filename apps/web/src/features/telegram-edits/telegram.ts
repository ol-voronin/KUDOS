/**
 * Виклики Bot API. Токен живе лише в URL запиту — ні в повідомленнях про
 * помилки, ні в логах його немає: помилки переписуються без адреси.
 */

async function call<T>(token: string, method: string, payload: unknown): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
  if (!res.ok || body?.ok !== true) {
    throw new Error(`Telegram ${method}: HTTP ${res.status} ${body?.description ?? ''}`.trim());
  }
  return body.result as T;
}

export async function reply(
  token: string,
  target: { chatId: number; threadId: number; replyTo: number },
  text: string,
): Promise<void> {
  await call(token, 'sendMessage', {
    chat_id: target.chatId,
    message_thread_id: target.threadId,
    text,
    reply_parameters: { message_id: target.replyTo, allow_sending_without_reply: true },
    link_preview_options: { is_disabled: true },
  });
}

/** Завантажити файл, який людина надіслала боту. */
export async function downloadFile(token: string, fileId: string): Promise<Uint8Array> {
  const file = await call<{ file_path?: string }>(token, 'getFile', { file_id: fileId });
  if (!file.file_path) throw new Error('Telegram getFile: немає file_path');
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
  if (!res.ok) throw new Error(`Telegram file: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
