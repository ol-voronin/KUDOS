/**
 * Розбір повідомлень із теми правок — без жодного вводу-виводу, щоб усе
 * рішення «що робити з цим повідомленням» перевірялось тестами.
 *
 * Будь-яке повідомлення редактора в темі правок — звернення до бота:
 * текст, фото (з підписом чи без), скрін файлом, голосове, аудіо, кружечок.
 * Префікс «правка:» не потрібен; він лишився як «точно нова правка».
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

export interface TgFile {
  file_id: string;
  mime_type?: string;
  file_name?: string;
  file_size?: number;
  duration?: number;
}

export interface TgMessage {
  message_id: number;
  message_thread_id?: number;
  chat: { id: number };
  from?: TgUser;
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
  document?: TgFile;
  voice?: TgFile;
  audio?: TgFile;
  video_note?: TgFile;
  media_group_id?: string;
  reply_to_message?: TgMessage;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

export interface EditsConfig {
  chatId: number;
  threadId: number;
  /** Перший — Олексій: лише він підтверджує випуск на сайт. */
  editors: number[];
  /** Ідентифікатор бота — числова частина токена до двокрапки. */
  botId: number;
}

export type MediaKind = 'photo' | 'voice' | 'audio' | 'video_note';

export interface Media {
  kind: MediaKind;
  fileId: string;
  /** Розширення файлу в Blob: jpg/png/webp для картинок, ogg/mp3/m4a/mp4 для звуку. */
  ext: string;
}

/** Звернення редактора: що написано, що прикладено і на що це відповідь. */
export interface Incoming {
  text: string;
  media: Media | null;
  /** Реплай на повідомлення бота з `#N`. */
  replyIssue: number | null;
  /** Почалось з «правка:» — завжди нова правка, без склейки. */
  forceNew: boolean;
  /** Коротке «ок», «так», «👍» без вкладень. */
  ack: boolean;
  /** Альбом: Telegram шле кожне фото окремим оновленням з одним media_group_id. */
  group: string | null;
}

export type Action =
  | { kind: 'ignore' }
  | { kind: 'id' }
  | ({ kind: 'message' } & Incoming)
  | { kind: 'empty-edit' }
  | { kind: 'revert' }
  | { kind: 'release' }
  | { kind: 'release-confirm'; pr: number; sha: string }
  | { kind: 'release-cancel'; pr: number }
  | { kind: 'release-hint' }
  | { kind: 'release-wait' };

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

/** Нижній регістр, без розділових знаків і зайвих пробілів — для коротких фраз. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’'ʼ`]/gu, '')
    .replace(/[!?.,…:;()"«»-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

const RELEASE_PHRASES = [
  /^(?:давай(?:те)? )?(?:випуск|випускай(?:те)?|випускаємо)(?: (?:все|усе))?(?: (?:на сайт|в прод|у прод|на прод))?$/u,
  /^(?:давай(?:те)? )?(?:викладай(?:те)?|викладаємо|заливай(?:те)?|заливаємо|публікуй(?:те)?|публікуємо)(?: (?:все|усе))? (?:на сайт|в прод|у прод|на прод)$/u,
  /^(?:все|усе) на сайт$/u,
];

/** «викладай на сайт», «випускай», «заливай в прод» — запит на випуск. */
export function isReleasePhrase(text: string): boolean {
  const t = normalize(text);
  return t.length <= 40 && RELEASE_PHRASES.some((re) => re.test(t));
}

const YES = new Set(['так', 'ок', 'окей', 'ok', 'okay', 'yes', 'да', 'ага', 'угу', 'давай', 'го', 'зливай', 'випускай', 'погнали', 'так випускай', 'так давай']);
const NO = new Set(['ні', 'не', 'нє', 'нет', 'no', 'стоп', 'скасуй', 'скасувати', 'відміна', 'не треба', 'ні не треба', 'поки ні']);
const YES_EMOJI = /^(?:✅|👍|👌|🔥|💯|\+|☑️|✔️)+$/u;
const NO_EMOJI = /^(?:❌|👎|🚫|⛔|✋|-)+$/u;

export function yesNo(text: string): 'yes' | 'no' | null {
  const raw = text.replace(/\s+/gu, '');
  if (YES_EMOJI.test(raw)) return 'yes';
  if (NO_EMOJI.test(raw)) return 'no';
  const t = normalize(text.replace(/\p{Extended_Pictographic}/gu, ''));
  if (YES.has(t)) return 'yes';
  if (NO.has(t)) return 'no';
  return null;
}

const ACKS = new Set([
  'ок', 'окей', 'ok', 'okay', 'так', 'ага', 'угу', 'да', 'добре', 'гаразд', 'давай', 'супер', 'клас', 'дякую', 'дякс',
  'спасибі', 'спасибо', 'ні', 'не', 'нє', 'норм', 'так давай', 'ок дякую', 'так дякую', 'дякую ок', '+', 'yes', 'no',
]);

/** Коротка відповідь без змісту правки: «ок», «так», «👍». */
export function isAck(text: string): boolean {
  const raw = text.replace(/\s+/gu, '');
  if (raw === '') return false;
  if (/^[\p{Extended_Pictographic}‍️+]+$/u.test(raw)) return true;
  const t = normalize(text.replace(/\p{Extended_Pictographic}/gu, ''));
  return ACKS.has(t);
}

const IMAGE_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const AUDIO_EXT: Record<string, string> = {
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a', 'audio/aac': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/webm': 'webm',
};

/** Найбільший варіант фото — Telegram присилає кілька розмірів. */
export function largestPhoto(photos: TgPhotoSize[] | undefined): TgPhotoSize | undefined {
  if (photos === undefined || photos.length === 0) return undefined;
  return photos.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
}

/** Що прикладено до повідомлення, якщо бот уміє це прочитати. */
export function mediaOf(message: TgMessage): Media | null {
  const photo = largestPhoto(message.photo);
  if (photo !== undefined) return { kind: 'photo', fileId: photo.file_id, ext: 'jpg' };
  if (message.voice !== undefined) return { kind: 'voice', fileId: message.voice.file_id, ext: 'ogg' };
  if (message.video_note !== undefined) return { kind: 'video_note', fileId: message.video_note.file_id, ext: 'mp4' };
  if (message.audio !== undefined) {
    return { kind: 'audio', fileId: message.audio.file_id, ext: AUDIO_EXT[message.audio.mime_type ?? ''] ?? 'ogg' };
  }
  // Скрін «файлом», без стиснення — дизайнери так роблять часто.
  const doc = message.document;
  if (doc !== undefined) {
    const image = IMAGE_EXT[doc.mime_type ?? ''];
    if (image !== undefined) return { kind: 'photo', fileId: doc.file_id, ext: image };
    const audio = AUDIO_EXT[doc.mime_type ?? ''];
    if (audio !== undefined) return { kind: 'audio', fileId: doc.file_id, ext: audio };
  }
  return null;
}

export function isAudio(media: Media | null): boolean {
  return media !== null && media.kind !== 'photo';
}

/** Повідомлення бота «Випускаємо?» з номером PR і версією. */
export function releasePrompt(text: string): { pr: number; sha: string } | null {
  if (!/випускаємо\?/iu.test(text)) return null;
  const pr = /PR #(\d+)/u.exec(text)?.[1];
  const sha = /версія ([0-9a-f]{7,40})/u.exec(text)?.[1];
  if (pr === undefined || sha === undefined) return null;
  return { pr: Number(pr), sha };
}

export function classify(message: TgMessage | undefined, config: EditsConfig): Action {
  if (message === undefined || message.from === undefined) return { kind: 'ignore' };
  if (message.chat.id !== config.chatId) return { kind: 'ignore' };
  if (message.message_thread_id !== config.threadId) return { kind: 'ignore' };
  if (message.from.is_bot === true) return { kind: 'ignore' };

  const raw = messageText(message);
  const cmd = command(raw);

  if (cmd === '/id') return { kind: 'id' };

  if (!config.editors.includes(message.from.id)) return { kind: 'ignore' };
  const isOwner = message.from.id === config.editors[0];
  const media = mediaOf(message);

  if (cmd === '/відкат') return { kind: 'revert' };
  if (cmd === '/випуск') return { kind: 'release' };

  const replied = message.reply_to_message;
  const repliedToBot = replied?.from?.id === config.botId;

  // Відповідь на «Випускаємо?» — лише Олексій вирішує, решті: «чекаємо Олексія».
  if (repliedToBot) {
    const prompt = releasePrompt(messageText(replied!));
    if (prompt !== null) {
      if (!isOwner) return { kind: 'release-wait' };
      const answer = yesNo(raw);
      if (answer === 'yes') return { kind: 'release-confirm', pr: prompt.pr, sha: prompt.sha };
      if (answer === 'no') return { kind: 'release-cancel', pr: prompt.pr };
      return { kind: 'release-hint' };
    }
  }

  if (media === null && isReleasePhrase(raw)) return { kind: 'release' };

  // Інші команди (наприклад, чужого бота) — не нам.
  if (cmd !== null && !EDIT_PREFIX.test(raw)) return { kind: 'ignore' };

  const prefix = EDIT_PREFIX.exec(raw);
  const text = prefix === null ? raw : raw.slice(prefix[0].length).trim();

  if (text === '' && media === null) {
    // Голе «правка:» — підкажемо; порожнє повідомлення без вкладень (стікер,
    // службове) — не нам.
    return prefix !== null ? { kind: 'empty-edit' } : { kind: 'ignore' };
  }

  let replyIssue: number | null = null;
  if (repliedToBot) {
    const found = /#(\d+)/u.exec(messageText(replied!));
    if (found?.[1] !== undefined) replyIssue = Number(found[1]);
  }

  return {
    kind: 'message',
    text,
    media,
    replyIssue,
    forceNew: prefix !== null && replyIssue === null,
    ack: media === null && prefix === null && isAck(text),
    group: message.media_group_id ?? null,
  };
}

/** Скільки після останньої активності нове повідомлення вважаємо доповненням. */
export const GLUE_WINDOW_MS = 20 * 60 * 1000;

export interface OpenIssue {
  number: number;
  updatedAt: string;
  /** user_id автора з tg-блоку тіла; null — стара issue без цього поля. */
  author: number | null;
}

/**
 * Кандидати на склейку: відкриті issue цього ж автора, найсвіжіші першими.
 * `recent` — остання активність у межах вікна; решту варто брати, лише якщо
 * бот там поставив питання і чекає відповіді.
 */
export function glueCandidates(issues: OpenIssue[], author: number, now: number): { number: number; recent: boolean }[] {
  return issues
    .filter((i) => i.author === author)
    .map((i) => ({ i, at: Date.parse(i.updatedAt) }))
    .filter(({ at }) => Number.isFinite(at))
    .sort((a, b) => b.at - a.at)
    .map(({ i, at }) => ({ number: i.number, recent: now - at < GLUE_WINDOW_MS }));
}

/** Маркер у коментарі агента: «я спитав і чекаю відповіді». */
export const QUESTION_MARK = '<!-- claude-question -->';

export function isQuestionComment(body: string | null | undefined): boolean {
  return typeof body === 'string' && body.includes(QUESTION_MARK);
}

/** Заголовок issue: перший рядок, не довше 70 символів. */
export function issueTitle(text: string, fallback = 'Правка з фото'): string {
  const line = text.split('\n').find((l) => l.trim() !== '')?.trim() ?? fallback;
  const chars = Array.from(line);
  return chars.length <= 70 ? line : `${chars.slice(0, 69).join('').trimEnd()}…`;
}

export function titleFallback(media: Media | null): string {
  if (media?.kind === 'video_note') return 'Кружечок з Telegram';
  if (isAudio(media)) return 'Голосове з Telegram';
  return 'Правка з фото';
}

export function authorName(user: TgUser): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Без імені';
  return user.username ? `${name} (@${user.username})` : name;
}

/**
 * Прихований блок у issue чи коментарі: куди відповідати в Telegram і хто
 * писав (за `from` вебхук знаходить відкриту правку цієї ж людини), а
 * `owner` — user_id Олексія, щоб сповіщення з Actions могли його тегнути.
 * Його читають воркфлоу сповіщень, тому формат — стабільний JSON в одному рядку.
 */
export function tgBlock(message: TgMessage, updateId: number, owner?: number): string {
  return `<!-- tg:${JSON.stringify({
    chat: message.chat.id,
    thread: message.message_thread_id,
    msg: message.message_id,
    update: updateId,
    from: message.from?.id,
    owner,
  })} -->`;
}

/** Перший tg-блок у тексті — з тіла issue береться автор. */
export function readTgBlock(text: string | null | undefined): { from?: number; msg?: number } | null {
  const m = /<!--\s*tg:(\{.*?\})\s*-->/u.exec(text ?? '');
  if (m?.[1] === undefined) return null;
  try {
    return JSON.parse(m[1]) as { from?: number; msg?: number };
  } catch {
    return null;
  }
}

export interface Attachment {
  kind: MediaKind;
  url: string;
}

const ATTACHMENT_LABEL: Record<Exclude<MediaKind, 'photo'>, string> = {
  voice: '🎙 Голосове',
  audio: '🎙 Аудіо',
  video_note: '🎥 Кружечок',
};

export function composeBody(parts: { text: string; attachments: Attachment[]; author: string; block: string }): string {
  const lines = parts.attachments.map((a) => (a.kind === 'photo' ? `![](${a.url})` : `${ATTACHMENT_LABEL[a.kind]}: ${a.url}`));
  const sections = [parts.text, lines.join('\n'), `— ${parts.author}, з Telegram`, parts.block];
  return sections.filter((s) => s !== '').join('\n\n');
}

/** Відповіді бота — коротко й по-людськи. */
export const REPLY = {
  accepted: (issue: number) => `Прийняв, #${issue} 👌`,
  listening: (issue: number) => `Слухаю 🎧, #${issue}`,
  added: (issue: number) => `Додав до #${issue} 👌`,
  empty: 'Що змінити? Напиши або кинь скрін 🐾',
  failed: 'Ой, не вийшло прийняти 🙈 Спробуй ще раз за хвилинку, а якщо знову — гукни Олексія.',
  revert: 'Відкочую останню правку на тесті ⏪',
  release: 'Збираю випуск, зараз покажу, що піде на сайт 📦',
  releaseConfirm: 'Зливаю на сайт, щойно зелені перевірки 🚀',
  releaseCancel: 'Ок, випуск скасовано. Правки лишаються на тесті 👌',
  releaseHint: 'Відповідай «так» або «ні» 🙂',
  releaseWait: 'Чекаємо на відповідь Олексія 🙂',
} as const;
