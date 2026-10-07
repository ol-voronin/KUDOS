import { NextResponse } from 'next/server';
import { isProductionDeploy } from '@/lib/deploy-env';
import { readConfig, type RuntimeConfig } from '@/features/telegram-edits/config';
import {
  ACCEPTED_REPLY, authorName, classify, composeBody, issueTitle, largestPhoto, tgBlock,
  type TgMessage, type TgUpdate,
} from '@/features/telegram-edits/parse';
import { downloadFile, reply } from '@/features/telegram-edits/telegram';
import { commentIssue, createIssue, dispatchWorkflow, finishIssue, issueExists } from '@/features/telegram-edits/github';
import { claimUpdate, savePhoto } from '@/features/telegram-edits/storage';

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
export const maxDuration = 30;

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
  if (config === null) return new NextResponse(null, { status: 503 });

  const provided = request.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!safeEqual(provided, config.webhookSecret)) return new NextResponse(null, { status: 401 });

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return OK();
  }
  if (typeof update.update_id !== 'number') return OK();

  const action = classify(update.message, config);
  if (action.kind === 'ignore') return OK();
  const message = update.message as TgMessage;

  if (!(await claimUpdate(update.update_id))) return OK();

  // Відповідаємо Telegram 200 за будь-якої помилки: інакше він повторює
  // доставку, і одна збійна правка перетворюється на зливу повторів.
  try {
    await handle(action, message, update.update_id, config);
  } catch (error) {
    console.error('telegram.webhook.failed', error instanceof Error ? error.message : String(error));
    await say(config, message, 'Ой, не вийшло прийняти 🙈 Спробуй ще раз за хвилинку, а якщо знову — гукни Олексія.')
      .catch(() => undefined);
  }
  return OK();
}

function say(config: RuntimeConfig, message: TgMessage, text: string): Promise<void> {
  return reply(config.botToken, { chatId: config.chatId, threadId: config.threadId, replyTo: message.message_id }, text);
}

async function photoUrls(config: RuntimeConfig, issue: number, message: TgMessage): Promise<string[]> {
  const photo = largestPhoto(message.photo);
  if (photo === undefined) return [];
  // Фото — не причина губити правку: без картинки агент принаймні прочитає текст.
  try {
    const bytes = await downloadFile(config.botToken, photo.file_id);
    return [await savePhoto(issue, message.message_id, bytes)];
  } catch (error) {
    console.error('telegram.photo.failed', error instanceof Error ? error.message : String(error));
    return [];
  }
}

async function handle(
  action: ReturnType<typeof classify>,
  message: TgMessage,
  updateId: number,
  config: RuntimeConfig,
): Promise<void> {
  const github = { token: config.githubToken, repo: config.githubRepo };
  const author = authorName(message.from!);
  const block = tgBlock(message, updateId);

  switch (action.kind) {
    case 'id':
      await say(config, message, `твій user_id: ${message.from!.id}`);
      return;

    case 'empty-edit':
      await say(config, message, 'Напиши, що саме змінити: «правка: …» — і, якщо треба, додай скрін 🐾');
      return;

    case 'edit': {
      const draft = composeBody({ text: action.text, images: [], author, block });
      const issue = await createIssue(github, issueTitle(action.text), draft);
      const images = await photoUrls(config, issue, message);
      await finishIssue(github, issue, composeBody({ text: action.text, images, author, block }));
      await say(config, message, ACCEPTED_REPLY(issue));
      return;
    }

    case 'comment': {
      if (!(await issueExists(github, action.issue))) {
        await say(config, message, `Не знайшов правку #${action.issue} 🤔 Напиши нову: «правка: …»`);
        return;
      }
      const images = await photoUrls(config, action.issue, message);
      await commentIssue(github, action.issue, composeBody({ text: action.text, images, author, block }));
      await say(config, message, `Додав до #${action.issue} 👌`);
      return;
    }

    case 'revert':
      await dispatchWorkflow(github, 'telegram-revert.yml', { reply_to: String(message.message_id), requested_by: author });
      await say(config, message, 'Відкочую останню правку на тесті… ⏪');
      return;

    case 'release':
      await dispatchWorkflow(github, 'telegram-release.yml', { reply_to: String(message.message_id) });
      await say(config, message, 'Збираю випуск, зараз буде посилання 📦');
      return;

    case 'release-denied':
      await say(config, message, 'Випуск на сайт запускає Олексій 🙂');
      return;

    case 'ignore':
      return;
  }
}
