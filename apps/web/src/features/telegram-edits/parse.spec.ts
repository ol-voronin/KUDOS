import { describe, expect, it } from 'vitest';
import { classify, composeBody, issueTitle, tgBlock, type EditsConfig, type TgMessage } from './parse';

const config: EditsConfig = { chatId: -100, threadId: 7, editors: [1, 2], botId: 999 };

function msg(over: Partial<TgMessage> = {}): TgMessage {
  return { message_id: 10, message_thread_id: 7, chat: { id: -100 }, from: { id: 2, first_name: 'Даша' }, text: '', ...over };
}

describe('classify', () => {
  it('інша тема (зокрема «Реклама») — тиша', () => {
    expect(classify(msg({ message_thread_id: 88, text: 'правка: щось' }), config)).toEqual({ kind: 'ignore' });
    expect(classify(msg({ message_thread_id: undefined, text: 'правка: щось' }), config)).toEqual({ kind: 'ignore' });
  });

  it('інший чат — тиша', () => {
    expect(classify(msg({ chat: { id: -200 }, text: 'правка: щось' }), config)).toEqual({ kind: 'ignore' });
  });

  it('/id відповідає будь-кому в темі', () => {
    expect(classify(msg({ from: { id: 555 }, text: '/id' }), config)).toEqual({ kind: 'id' });
    expect(classify(msg({ from: { id: 555 }, text: '/id@babaka_bot' }), config)).toEqual({ kind: 'id' });
  });

  it('правка не від редактора — тиша', () => {
    expect(classify(msg({ from: { id: 555 }, text: 'правка: зміни заголовок' }), config)).toEqual({ kind: 'ignore' });
  });

  it('«правка:» і «/правка» від редактора — нова правка', () => {
    expect(classify(msg({ text: 'Правка: зміни заголовок' }), config)).toEqual({ kind: 'edit', text: 'зміни заголовок' });
    expect(classify(msg({ text: '/правка зміни заголовок' }), config)).toEqual({ kind: 'edit', text: 'зміни заголовок' });
    expect(classify(msg({ text: undefined, caption: 'правка: ось так', photo: [{ file_id: 'f', width: 1, height: 1 }] }), config))
      .toEqual({ kind: 'edit', text: 'ось так' });
  });

  it('просто текст від редактора — тиша', () => {
    expect(classify(msg({ text: 'привіт, як справи' }), config)).toEqual({ kind: 'ignore' });
    expect(classify(msg({ text: 'виправка: ні' }), config)).toEqual({ kind: 'ignore' });
  });

  it('порожня правка — підказка', () => {
    expect(classify(msg({ text: 'правка:' }), config)).toEqual({ kind: 'empty-edit' });
  });

  it('реплай на повідомлення бота з #N — коментар', () => {
    const replyTo = msg({ message_id: 5, from: { id: 999, is_bot: true }, text: 'Прийняв, #42 👌' });
    expect(classify(msg({ text: 'і ще кнопку зеленою', reply_to_message: replyTo }), config))
      .toEqual({ kind: 'comment', issue: 42, text: 'і ще кнопку зеленою' });
  });

  it('реплай на чуже повідомлення з #N — тиша', () => {
    const replyTo = msg({ message_id: 5, from: { id: 1 }, text: 'дивись #42' });
    expect(classify(msg({ text: 'ок', reply_to_message: replyTo }), config)).toEqual({ kind: 'ignore' });
  });

  it('/випуск — лише перший редактор', () => {
    expect(classify(msg({ from: { id: 1 }, text: '/випуск' }), config)).toEqual({ kind: 'release' });
    expect(classify(msg({ from: { id: 2 }, text: '/випуск' }), config)).toEqual({ kind: 'release-denied' });
    expect(classify(msg({ from: { id: 555 }, text: '/випуск' }), config)).toEqual({ kind: 'ignore' });
  });

  it('/відкат — будь-який редактор', () => {
    expect(classify(msg({ text: '/відкат' }), config)).toEqual({ kind: 'revert' });
    expect(classify(msg({ from: { id: 555 }, text: '/відкат' }), config)).toEqual({ kind: 'ignore' });
  });

  it('повідомлення ботів не обробляємо', () => {
    expect(classify(msg({ from: { id: 1, is_bot: true }, text: 'правка: x' }), config)).toEqual({ kind: 'ignore' });
  });
});

describe('issueTitle', () => {
  it('перший рядок, до 70 символів', () => {
    expect(issueTitle('коротко\nдовгий опис')).toBe('коротко');
    const long = 'а'.repeat(100);
    expect(Array.from(issueTitle(long))).toHaveLength(70);
  });
});

describe('тіло issue', () => {
  it('містить текст, автора й прихований tg-блок', () => {
    const block = tgBlock(msg({ message_id: 77 }), 123);
    expect(block).toBe('<!-- tg:{"chat":-100,"thread":7,"msg":77,"update":123} -->');
    const body = composeBody({ text: 'зміни', images: ['https://x/1.jpg'], author: 'Даша', block });
    expect(body).toContain('![](https://x/1.jpg)');
    expect(body).toContain('— Даша, з Telegram');
    expect(body.endsWith(block)).toBe(true);
  });
});
