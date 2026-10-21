import { NextResponse } from 'next/server';
import { isProductionDeploy } from '@/lib/deploy-env';
import { readConfig, type RuntimeConfig } from '@/features/telegram-edits/config';
import {
  REPLY, authorName, classify, composeBody, glueCandidates, isAudio, isQuestionComment, issueTitle, readTgBlock,
  tgBlock, titleFallback, type Action, type Attachment, type Incoming, type TgMessage, type TgUpdate,
} from '@/features/telegram-edits/parse';
import { downloadFile, reply } from '@/features/telegram-edits/telegram';
import {
  commentIssue, createIssue, dispatchWorkflow, finishIssue, issueOpen, lastCommentBody, listOpenEditIssues,
} from '@/features/telegram-edits/github';
import {
  albumTiming, claimAlbum, claimUpdate, saveMedia, setAlbumIssue, sleep, waitAlbumIssue,
} from '@/features/telegram-edits/storage';

/**
 * Вебхук бота для правок сайту з Telegram (docs/telegram-edits.md).
 *
 * Правило, на якому все тримається: усе, що не з теми правок, — 200 і
 * тиша. Бот сидить у робочому чаті, де є й тема «Реклама» зі щоденними
 * звітами, і відповідати на будь-що поза своєю темою він не має права.
 *
 * Живе лише в Production: превʼю дивиться в продовий API й не має
 * секретів Telegram, а другий робочий вебхук на ту саму тему означав би
 * подвійні issue.
 */

export const dynamic = 'force-dynamic';
// Альбом: решта фото чекають, поки перше створить issue (див. albumTiming).
export const maxDuration = 60;

const OK = () => NextResponse.json({ ok: true });

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: Request) {
  if (!isProductionDeploy()) return new NextResponse(null, { status: 404 });

  const config = readConfig();
  // Без налаштувань — закрито, а не відкрито.
  if (config === null) {
    console.warn('telegram.webhook.not_configured');
    return new NextResponse(null, { status: 503 });
  }

  const provided = request.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!safeEqual(provided, config.webhookSecret)) {
    console.warn('telegram.webhook.bad_secret');
    return new NextResponse(null, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return OK();
  }
  if (typeof update.update_id !== 'number') return OK();

  const action = classify(update.message, config);
  // Один рядок на оновлення: лише id і рішення — без тексту й токенів.
  // Без цього «бот мовчить» не відрізнити від «бот вирішив, що це не його тема».
  console.info('telegram.webhook.update', JSON.stringify({
    update: update.update_id,
    chat: update.message?.chat.id,
    thread: update.message?.message_thread_id ?? null,
    from: update.message?.from?.id,
    action: action.kind,
  }));
  if (action.kind === 'ignore') return OK();
  const message = update.message as TgMessage;

  if (!(await claimUpdate(update.update_id))) return OK();

  // Відповідаємо Telegram 200 за будь-якої помилки: інакше він повторює
  // доставку, і одна збійна правка перетворюється на зливу повторів.
  try {
    await handle(action, message, update.update_id, config);
  } catch (error) {
    console.error('telegram.webhook.failed', error instanceof Error ? error.message : String(error));
    await say(config, message, REPLY.failed)
      .catch(() => undefined);
  }
  return OK();
}

function say(config: RuntimeConfig, message: TgMessage, text: string): Promise<void> {
  return reply(config.botToken, { chatId: config.chatId, threadId: config.threadId, replyTo: message.message_id }, text);
}

type GitHub = { token: string; repo: string };

/** Фото чи голосове — у Blob. Збій вкладення — не причина губити текст правки. */
async function upload(config: RuntimeConfig, issue: number, message: TgMessage, media: Incoming['media']): Promise<Attachment[]> {
  if (media === null) return [];
  try {
    const bytes = await downloadFile(config.botToken, media.fileId);
    return [{ kind: media.kind, url: await saveMedia(issue, message.message_id, media.ext, bytes) }];
  } catch (error) {
    console.error('telegram.media.failed', error instanceof Error ? error.message : String(error));
    return [];
  }
}

type Target = { kind: 'comment'; issue: number } | { kind: 'new' } | { kind: 'skip' };

/** Чи бот у цій issue спитав і чекає відповіді. */
async function waitsForAnswer(github: GitHub, issue: number, comments?: number): Promise<boolean> {
  try {
    return isQuestionComment(await lastCommentBody(github, issue, comments));
  } catch {
    return false;
  }
}

/**
 * Куди йде повідомлення: реплай на бота з #N → у #N; інакше в відкриту
 * правку цієї ж людини, якщо бот там чекає відповіді або вона жива (< 20 хв);
 * інакше — нова правка. Коротке «ок» без питання бота — нікуди.
 */
async function resolveTarget(github: GitHub, a: Incoming, authorId: number): Promise<Target> {
  if (a.replyIssue !== null && (await issueOpen(github, a.replyIssue))) {
    if (a.ack && !(await waitsForAnswer(github, a.replyIssue))) return { kind: 'skip' };
    return { kind: 'comment', issue: a.replyIssue };
  }
  if (a.forceNew) return { kind: 'new' };

  let open: Awaited<ReturnType<typeof listOpenEditIssues>> = [];
  try {
    open = await listOpenEditIssues(github);
  } catch (error) {
    console.error('telegram.glue.list_failed', error instanceof Error ? error.message : String(error));
  }
  const byNumber = new Map(open.map((i) => [i.number, i]));
  const candidates = glueCandidates(
    open.map((i) => ({ number: i.number, updatedAt: i.updated_at, author: readTgBlock(i.body)?.from ?? null })),
    authorId,
    Date.now(),
  );
  let checks = 0;
  for (const c of candidates) {
    if (c.recent && !a.ack) return { kind: 'comment', issue: c.number };
    if (checks >= 3) break;
    checks += 1;
    if (await waitsForAnswer(github, c.number, byNumber.get(c.number)?.comments)) return { kind: 'comment', issue: c.number };
  }
  return a.ack ? { kind: 'skip' } : { kind: 'new' };
}

async function handleMessage(a: Incoming, message: TgMessage, updateId: number, config: RuntimeConfig): Promise<void> {
  const github = { token: config.githubToken, repo: config.githubRepo };
  const author = authorName(message.from!);
  const block = tgBlock(message, updateId, config.editors[0]);
  const audio = isAudio(a.media);

  // Альбом: лише перше фото вирішує, куди йде весь альбом, і відповідає в тему.
  let albumOwner = false;
  if (a.group !== null) {
    albumOwner = await claimAlbum(a.group);
    if (!albumOwner) {
      const issue = await waitAlbumIssue(a.group);
      if (issue !== null) {
        const attachments = await upload(config, issue, message, a.media);
        await commentIssue(github, issue, composeBody({ text: a.text, attachments, author, block }));
        return;
      }
      // Не дочекались — обробляємо як окреме повідомлення.
    }
  }

  const target = await resolveTarget(github, a, message.from!.id);

  if (target.kind === 'skip') return;

  if (target.kind === 'comment') {
    if (albumOwner) await setAlbumIssue(a.group!, target.issue);
    const attachments = await upload(config, target.issue, message, a.media);
    await commentIssue(github, target.issue, composeBody({ text: a.text, attachments, author, block }));
    await say(config, message, audio ? REPLY.listening(target.issue) : REPLY.added(target.issue));
    return;
  }

  const title = issueTitle(a.text, titleFallback(a.media));
  const issue = await createIssue(github, title, composeBody({ text: a.text, attachments: [], author, block }));
  if (albumOwner) {
    await setAlbumIssue(a.group!, issue);
    // Решта фото альбому тим часом допишуться коментарями — ще без мітки,
    // тож агент стартує один раз і побачить увесь альбом.
    await sleep(albumTiming.settleMs);
  }
  const attachments = await upload(config, issue, message, a.media);
  await finishIssue(github, issue, composeBody({ text: a.text, attachments, author, block }));
  await say(config, message, audio ? REPLY.listening(issue) : REPLY.accepted(issue));
}

async function handle(action: Action, message: TgMessage, updateId: number, config: RuntimeConfig): Promise<void> {
  const github = { token: config.githubToken, repo: config.githubRepo };
  const replyTo = String(message.message_id);

  switch (action.kind) {
    case 'id':
      await say(config, message, `твій user_id: ${message.from!.id}`);
      return;

    case 'empty-edit':
      await say(config, message, REPLY.empty);
      return;

    case 'message':
      await handleMessage(action, message, updateId, config);
      return;

    case 'revert':
      await dispatchWorkflow(github, 'telegram-revert.yml', { reply_to: replyTo, requested_by: authorName(message.from!) });
      await say(config, message, REPLY.revert);
      return;

    case 'release':
      await dispatchWorkflow(github, 'telegram-release.yml', {
        action: 'prepare',
        reply_to: replyTo,
        owner_id: String(config.editors[0] ?? ''),
        requested_by: authorName(message.from!),
      });
      await say(config, message, REPLY.release);
      return;

    case 'release-confirm':
      await dispatchWorkflow(github, 'telegram-release.yml', { action: 'merge', reply_to: replyTo, pr: String(action.pr), sha: action.sha });
      await say(config, message, REPLY.releaseConfirm);
      return;

    case 'release-cancel':
      await dispatchWorkflow(github, 'telegram-release.yml', { action: 'cancel', reply_to: replyTo, pr: String(action.pr) });
      return;

    case 'release-hint':
      await say(config, message, REPLY.releaseHint);
      return;

    case 'release-wait':
      await say(config, message, REPLY.releaseWait);
      return;

    case 'ignore':
      return;
  }
}
