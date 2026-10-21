import { describe, expect, it } from 'vitest';
import {
  GLUE_WINDOW_MS, QUESTION_MARK, REPLY, classify, composeBody, glueCandidates, isAck, isQuestionComment,
  isReleasePhrase, issueTitle, mediaOf, readTgBlock, releasePrompt, tgBlock, yesNo, type EditsConfig, type TgMessage,
} from './parse';

const config: EditsConfig = { chatId: -100, threadId: 7, editors: [1, 2], botId: 999 };

function msg(over: Partial<TgMessage> = {}): TgMessage {
  return { message_id: 10, message_thread_id: 7, chat: { id: -100 }, from: { id: 2, first_name: 'Даша' }, text: '', ...over };
}

const photo = [{ file_id: 'small', width: 10, height: 10 }, { file_id: 'big', width: 100, height: 100 }];

describe('classify: хто і де', () => {
  it('інша тема (зокрема «Реклама») — тиша', () => {
    expect(classify(msg({ message_thread_id: 88, text: 'зміни заголовок' }), config)).toEqual({ kind: 'ignore' });
    expect(classify(msg({ message_thread_id: undefined, text: 'зміни заголовок' }), config)).toEqual({ kind: 'ignore' });
  });

  it('інший чат — тиша', () => {
    expect(classify(msg({ chat: { id: -200 }, text: 'зміни заголовок' }), config)).toEqual({ kind: 'ignore' });
  });

  it('/id відповідає будь-кому в темі', () => {
    expect(classify(msg({ from: { id: 555 }, text: '/id' }), config)).toEqual({ kind: 'id' });
    expect(classify(msg({ from: { id: 555 }, text: '/id@babaka_bot' }), config)).toEqual({ kind: 'id' });
  });

  it('не редактор — тиша, з префіксом і без', () => {
    expect(classify(msg({ from: { id: 555 }, text: 'правка: зміни заголовок' }), config)).toEqual({ kind: 'ignore' });
    expect(classify(msg({ from: { id: 555 }, text: 'зміни заголовок' }), config)).toEqual({ kind: 'ignore' });
    expect(classify(msg({ from: { id: 555 }, voice: { file_id: 'v' } }), config)).toEqual({ kind: 'ignore' });
  });

  it('повідомлення ботів не обробляємо', () => {
    expect(classify(msg({ from: { id: 1, is_bot: true }, text: 'зміни заголовок' }), config)).toEqual({ kind: 'ignore' });
  });
});

describe('classify: звернення без префікса', () => {
  it('просто текст редактора — звернення', () => {
    expect(classify(msg({ text: 'кнопку зробити зеленою' }), config)).toEqual({
      kind: 'message', text: 'кнопку зробити зеленою', media: null, replyIssue: null, forceNew: false, ack: false, group: null,
    });
  });

  it('«правка:» і «/правка» — сумісність: та сама правка, але завжди нова', () => {
    expect(classify(msg({ text: 'Правка: зміни заголовок' }), config)).toMatchObject({ kind: 'message', text: 'зміни заголовок', forceNew: true });
    expect(classify(msg({ text: '/правка зміни заголовок' }), config)).toMatchObject({ kind: 'message', text: 'зміни заголовок', forceNew: true });
  });

  it('фото без підпису і з підписом', () => {
    expect(classify(msg({ text: undefined, photo }), config))
      .toMatchObject({ kind: 'message', text: '', media: { kind: 'photo', fileId: 'big', ext: 'jpg' } });
    expect(classify(msg({ text: undefined, caption: 'ось так', photo }), config)).toMatchObject({ kind: 'message', text: 'ось так' });
  });

  it('голосове, аудіо, кружечок', () => {
    expect(classify(msg({ text: undefined, voice: { file_id: 'v' } }), config))
      .toMatchObject({ kind: 'message', text: '', media: { kind: 'voice', fileId: 'v', ext: 'ogg' }, ack: false });
    expect(classify(msg({ text: undefined, video_note: { file_id: 'c' } }), config))
      .toMatchObject({ media: { kind: 'video_note', ext: 'mp4' } });
    expect(classify(msg({ text: undefined, audio: { file_id: 'a', mime_type: 'audio/mpeg' } }), config))
      .toMatchObject({ media: { kind: 'audio', ext: 'mp3' } });
  });

  it('скрін файлом — як фото; інші файли без тексту — тиша', () => {
    expect(mediaOf(msg({ document: { file_id: 'd', mime_type: 'image/png' } }))).toEqual({ kind: 'photo', fileId: 'd', ext: 'png' });
    expect(classify(msg({ text: undefined, document: { file_id: 'd', mime_type: 'application/pdf' } }), config)).toEqual({ kind: 'ignore' });
  });

  it('альбом — media_group_id', () => {
    expect(classify(msg({ text: undefined, photo, media_group_id: 'g1' }), config)).toMatchObject({ kind: 'message', group: 'g1' });
  });

  it('стікер / службове без тексту — тиша; голе «правка:» — підказка', () => {
    expect(classify(msg({ text: undefined }), config)).toEqual({ kind: 'ignore' });
    expect(classify(msg({ text: 'правка:' }), config)).toEqual({ kind: 'empty-edit' });
  });

  it('чужі команди — тиша', () => {
    expect(classify(msg({ text: '/start' }), config)).toEqual({ kind: 'ignore' });
  });

  it('коротке «ок», «так», «👍» — ack', () => {
    expect(classify(msg({ text: 'ок' }), config)).toMatchObject({ kind: 'message', ack: true });
    expect(classify(msg({ text: '👍' }), config)).toMatchObject({ kind: 'message', ack: true });
    expect(classify(msg({ text: 'Так!' }), config)).toMatchObject({ kind: 'message', ack: true });
    expect(classify(msg({ text: 'так, і кнопку теж' }), config)).toMatchObject({ kind: 'message', ack: false });
  });

  it('реплай на повідомлення бота з #N — у #N', () => {
    const replyTo = msg({ message_id: 5, from: { id: 999, is_bot: true }, text: 'Прийняв, #42 👌' });
    expect(classify(msg({ text: 'і ще кнопку зеленою', reply_to_message: replyTo }), config))
      .toMatchObject({ kind: 'message', replyIssue: 42, text: 'і ще кнопку зеленою', forceNew: false });
    expect(classify(msg({ text: 'правка: і ще кнопку', reply_to_message: replyTo }), config))
      .toMatchObject({ replyIssue: 42, forceNew: false });
  });

  it('реплай на чуже повідомлення з #N — звичайне звернення, не в #N', () => {
    const replyTo = msg({ message_id: 5, from: { id: 1 }, text: 'дивись #42' });
    expect(classify(msg({ text: 'зміни шрифт', reply_to_message: replyTo }), config)).toMatchObject({ kind: 'message', replyIssue: null });
  });
});

describe('classify: відкат і випуск', () => {
  it('/відкат — будь-який редактор', () => {
    expect(classify(msg({ text: '/відкат' }), config)).toEqual({ kind: 'revert' });
    expect(classify(msg({ from: { id: 555 }, text: '/відкат' }), config)).toEqual({ kind: 'ignore' });
  });

  it('/випуск і природні фрази — будь-який редактор', () => {
    expect(classify(msg({ from: { id: 1 }, text: '/випуск' }), config)).toEqual({ kind: 'release' });
    expect(classify(msg({ from: { id: 2 }, text: '/випуск' }), config)).toEqual({ kind: 'release' });
    expect(classify(msg({ text: 'Викладай на сайт!' }), config)).toEqual({ kind: 'release' });
    expect(classify(msg({ text: 'випускай' }), config)).toEqual({ kind: 'release' });
    expect(classify(msg({ text: 'заливай в прод' }), config)).toEqual({ kind: 'release' });
    expect(classify(msg({ from: { id: 555 }, text: '/випуск' }), config)).toEqual({ kind: 'ignore' });
    expect(classify(msg({ from: { id: 555 }, text: 'випускай' }), config)).toEqual({ kind: 'ignore' });
  });

  it('фрази, схожі на випуск, але про правку — не випуск', () => {
    expect(isReleasePhrase('випускай нову кнопку на головній')).toBe(false);
    expect(isReleasePhrase('заливай банер')).toBe(false);
    expect(isReleasePhrase('давай випускаємо на сайт')).toBe(true);
  });

  const prompt = msg({ message_id: 50, from: { id: 999, is_bot: true }, text: '🚀 На сайт піде:\n- #3 Заголовок\n\nОлексій, випускаємо? Відповідай «так» або «ні» (PR #77, версія abc1234)' });
  const promptText = '🚀 Випускаємо? (PR #77, версія abc1234)';

  it('розпізнає повідомлення «Випускаємо?»', () => {
    expect(releasePrompt(promptText)).toEqual({ pr: 77, sha: 'abc1234' });
    expect(releasePrompt(prompt.text!)).toEqual({ pr: 77, sha: 'abc1234' });
    expect(releasePrompt('Прийняв, #42 👌')).toBeNull();
  });

  it('лише Олексій підтверджує або скасовує', () => {
    const p = msg({ ...prompt, text: promptText });
    expect(classify(msg({ from: { id: 1 }, text: 'так', reply_to_message: p }), config)).toEqual({ kind: 'release-confirm', pr: 77, sha: 'abc1234' });
    expect(classify(msg({ from: { id: 1 }, text: '✅', reply_to_message: p }), config)).toEqual({ kind: 'release-confirm', pr: 77, sha: 'abc1234' });
    expect(classify(msg({ from: { id: 1 }, text: 'ні', reply_to_message: p }), config)).toEqual({ kind: 'release-cancel', pr: 77 });
    expect(classify(msg({ from: { id: 1 }, text: 'хм, а що там', reply_to_message: p }), config)).toEqual({ kind: 'release-hint' });
    expect(classify(msg({ from: { id: 2 }, text: 'так', reply_to_message: p }), config)).toEqual({ kind: 'release-wait' });
    expect(classify(msg({ from: { id: 555 }, text: 'так', reply_to_message: p }), config)).toEqual({ kind: 'ignore' });
  });

  it('«так» як реплай на чуже повідомлення з тим самим текстом — не випуск', () => {
    const fake = msg({ message_id: 51, from: { id: 2 }, text: promptText });
    expect(classify(msg({ from: { id: 1 }, text: 'так', reply_to_message: fake }), config)).toMatchObject({ kind: 'message' });
  });
});

describe('дрібниці', () => {
  it('yesNo', () => {
    expect(yesNo('Ок')).toBe('yes');
    expect(yesNo('👍👍')).toBe('yes');
    expect(yesNo('ні!')).toBe('no');
    expect(yesNo('❌')).toBe('no');
    expect(yesNo('може завтра')).toBeNull();
  });

  it('isAck', () => {
    expect(isAck('дякую')).toBe(true);
    expect(isAck('🙏')).toBe(true);
    expect(isAck('зміни ціну')).toBe(false);
    expect(isAck('')).toBe(false);
  });

  it('склейка: свіжа правка цього ж автора — recent; чужі й без автора — ні', () => {
    const now = Date.parse('2026-10-21T12:00:00Z');
    const fresh = new Date(now - 5 * 60 * 1000).toISOString();
    const old = new Date(now - GLUE_WINDOW_MS - 1000).toISOString();
    expect(glueCandidates([
      { number: 1, updatedAt: old, author: 2 },
      { number: 2, updatedAt: fresh, author: 2 },
      { number: 3, updatedAt: fresh, author: 1 },
      { number: 4, updatedAt: fresh, author: null },
    ], 2, now)).toEqual([{ number: 2, recent: true }, { number: 1, recent: false }]);
  });

  it('маркер питання', () => {
    expect(isQuestionComment(`Яку кнопку?\n\n${QUESTION_MARK}\n<!-- claude-bot -->`)).toBe(true);
    expect(isQuestionComment('просто коментар')).toBe(false);
    expect(isQuestionComment(null)).toBe(false);
  });

  it('відповідь «прийняв» — коротка і без пояснень процесу', () => {
    expect(REPLY.accepted(42)).toBe('Прийняв, #42 👌');
    expect(REPLY.listening(42)).toBe('Слухаю 🎧, #42');
    expect(Object.values(REPLY).map((r) => (typeof r === 'function' ? r(1) : r)).join(' ')).not.toMatch(/реклам/iu);
  });
});

describe('issueTitle', () => {
  it('перший рядок, до 70 символів', () => {
    expect(issueTitle('коротко\nдовгий опис')).toBe('коротко');
    expect(Array.from(issueTitle('а'.repeat(100)))).toHaveLength(70);
    expect(issueTitle('', 'Голосове з Telegram')).toBe('Голосове з Telegram');
  });
});

describe('тіло issue', () => {
  it('містить текст, вкладення, автора й прихований tg-блок з автором', () => {
    const block = tgBlock(msg({ message_id: 77 }), 123, 1);
    expect(block).toBe('<!-- tg:{"chat":-100,"thread":7,"msg":77,"update":123,"from":2,"owner":1} -->');
    expect(readTgBlock(`текст\n\n${block}`)).toMatchObject({ from: 2, msg: 77 });
    const body = composeBody({
      text: 'зміни',
      attachments: [{ kind: 'photo', url: 'https://x/1.jpg' }, { kind: 'voice', url: 'https://x/2.ogg' }],
      author: 'Даша',
      block,
    });
    expect(body).toContain('![](https://x/1.jpg)');
    expect(body).toContain('🎙 Голосове: https://x/2.ogg');
    expect(body).toContain('— Даша, з Telegram');
    expect(body.endsWith(block)).toBe(true);
  });
});
