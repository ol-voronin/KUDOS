import type { BlockList } from '@dt/contracts';
import { describe, expect, it } from 'vitest';
import { countWords, readingMinutes } from './reading-time';

function text(body: string): BlockList[number] {
  return {
    type: 'text', id: 'b1', heading: '', tone: 'plain',
    paragraphs: [body], bullets: [],
  } as BlockList[number];
}

describe('countWords', () => {
  it('рахує слова з тексту блоків', () => {
    expect(countWords([text('одне два три')] as BlockList)).toBe(3);
  });

  it('не рахує адреси й службові поля', () => {
    const block = {
      type: 'cta',
      heading: 'Замовити зараз',
      href: '/zayavka',
      label: 'Пишіть',
    } as unknown as BlockList[number];

    // «Замовити зараз» + «Пишіть» = 3. Ані `/zayavka`, ані `cta` не читають.
    expect(countWords([block] as BlockList)).toBe(3);
  });

  it('заходить у вкладені масиви — питання FAQ теж читають', () => {
    const faq = {
      type: 'faq',
      items: [
        { q: 'Скільки чекати', a: 'Два дні' },
        { q: 'Чи є доставка', a: 'Так' },
      ],
    } as unknown as BlockList[number];

    expect(countWords([faq] as BlockList)).toBe(8);
  });

  it('порожні блоки дають нуль слів', () => {
    expect(countWords([] as unknown as BlockList)).toBe(0);
  });

  it('не рахує розділові знаки за слова', () => {
    expect(countWords([text('слово — слово')] as BlockList)).toBe(2);
  });
});

describe('readingMinutes', () => {
  it('ніколи не повертає нуль', () => {
    expect(readingMinutes([] as unknown as BlockList)).toBe(1);
    expect(readingMinutes([text('коротко')] as BlockList)).toBe(1);
  });

  it('округлює до найближчої хвилини', () => {
    const words = Array.from({ length: 540 }, () => 'слово').join(' ');
    expect(readingMinutes([text(words)] as BlockList)).toBe(3);
  });
});
