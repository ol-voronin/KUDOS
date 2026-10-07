/**
 * Розбір повідомлень із теми правок — без жодного вводу-виводу, щоб усе
 * рішення «що робити з цим повідомленням» перевірялось тестами.
 */

export interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TgPhotoSize {
  file_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TgMessage {
  message_id: number;
  message_thread_id?: number;
  chat: { id: number };
  from?: TgUser;
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
  reply_to_message?: TgMessage;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

export interface EditsConfig {
  chatId: number;
  threadId: number;
  /** Перший — Олексій: лише він може запускати випуск. */
  editors: number[];
  /** Ідентифікатор бота — числова частина токена до двокрапки. */
  botId: number;
}

export type Action =
  | { kind: 'ignore' }
  | { kind: 'id' }
  | { kind: 'edit'; text: string }
  | { kind: 'empty-edit' }
  | { kind: 'comment'; issue: number; text: string }
  | { kind: 'revert' }
  | { kind: 'release' }
  | { kind: 'release-denied' };

const EDIT_PREFIX = /^(?:правка\s*:|\/правка(?:@\w+)?(?=\s|:|$):?)/iu;

/** Перше слово, якщо це команда: `/id@babaka_bot` → `/id`. */
function command(text: string): string | null {
  const first = text.trim().split(/\s+/u)[0] ?? '';
  if (!first.startsWith('/')) return null;
  return first.replace(/@\w+$/u, '').toLowerCase();
}

export function messageText(message: TgMessage): string {
  return (message.text ?? message.caption ?? '').trim();
}

export function classify(message: TgMessage | undefined, config: EditsConfig): Action {
  if (message === undefined || message.from === undefined) return { kind: 'ignore' };
  if (message.chat.id !== config.chatId) return { kind: 'ignore' };
  if (message.message_thread_id !== config.threadId) return { kind: 'ignore' };
  if (message.from.is_bot === true) return { kind: 'ignore' };

  const text = messageText(message);
  const cmd = command(text);

  if (cmd === '/id') return { kind: 'id' };

  if (!config.editors.includes(message.from.id)) return { kind: 'ignore' };

  if (cmd === '/відкат') return { kind: 'revert' };
  if (cmd === '/випуск') {
    return message.from.id === config.editors[0] ? { kind: 'release' } : { kind: 'release-denied' };
  }

  const prefix = EDIT_PREFIX.exec(text);
  if (prefix !== null) {
    const body = text.slice(prefix[0].length).trim();
    if (body === '' && (message.photo?.length ?? 0) === 0) return { kind: 'empty-edit' };
    return { kind: 'edit', text: body };
  }

  const replied = message.reply_to_message;
  if (replied?.from?.id === config.botId) {
    const issue = /#(\d+)/u.exec(messageText(replied));
    if (issue?.[1] !== undefined && (text !== '' || (message.photo?.length ?? 0) > 0)) {
      return { kind: 'comment', issue: Number(issue[1]), text };
    }
  }

  return { kind: 'ignore' };
}

/** Заголовок issue: перший рядок, не довше 70 символів. */
export function issueTitle(text: string): string {
  const line = text.split('\n').find((l) => l.trim() !== '')?.trim() ?? 'Правка з фото';
  const chars = Array.from(line);
  return chars.length <= 70 ? line : `${chars.slice(0, 69).join('').trimEnd()}…`;
}

export function authorName(user: TgUser): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Без імені';
  return user.username ? `${name} (@${user.username})` : name;
}

/**
 * Прихований блок у issue чи коментарі: куди відповідати в Telegram.
 * Його читають воркфлоу сповіщень, тому формат — стабільний JSON в одному рядку.
 */
export function tgBlock(message: TgMessage, updateId: number): string {
  return `<!-- tg:${JSON.stringify({
    chat: message.chat.id,
    thread: message.message_thread_id,
    msg: message.message_id,
    update: updateId,
  })} -->`;
}

/** Найбільший варіант фото — Telegram присилає кілька розмірів. */
export function largestPhoto(photos: TgPhotoSize[] | undefined): TgPhotoSize | undefined {
  if (photos === undefined || photos.length === 0) return undefined;
  return photos.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
}

export function composeBody(parts: { text: string; images: string[]; author: string; block: string }): string {
  const sections = [
    parts.text,
    parts.images.map((url) => `![](${url})`).join('\n'),
    `— ${parts.author}, з Telegram`,
    parts.block,
  ];
  return sections.filter((s) => s !== '').join('\n\n');
}

export const ACCEPTED_REPLY = (issue: number): string =>
  `Прийняв, #${issue} 👌 Зараз налаштовуємо рекламні кампанії, тому правки спочатку збираються на тесті й виходять на сайт пізніше. Нічого не загубиться`;
