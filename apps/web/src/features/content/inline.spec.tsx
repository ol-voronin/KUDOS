import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Inline } from './inline';

/**
 * Розбір тексту блоків.
 *
 * Головне, що тут перевіряється, — не форматування, а безпека: у результаті
 * не повинно зʼявитися розмітки, якої не було в дозволеному синтаксисі.
 * Редактор вмісту не має бути способом виконати чужий код на сайті.
 */
const html = (text: string): string => renderToStaticMarkup(<Inline text={text} />);

describe('Inline', () => {
  it('робить посилання', () => {
    expect(html('[умови](/oferta)')).toContain('href="/oferta"');
    expect(html('[умови](/oferta)')).toContain('умови');
  });

  it('зовнішні посилання відкриває в новій вкладці й без referrer', () => {
    const out = html('[Telegram](https://t.me/x)');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noreferrer"');
  });

  it('внутрішні — у тій самій вкладці', () => {
    expect(html('[тут](/vyroby)')).not.toContain('target="_blank"');
  });

  it('виділяє жирним', () => {
    expect(html('це **важливо**')).toContain('<strong');
  });

  it('підстановку, яку не зробив сервер, не перетворює на посилання', () => {
    // Підстановки робить API. Якщо сюди все ж доїхав `{{token}}`, це помилка
    // даних — і краще показати її як текст, ніж зробити з неї адресу.
    const out = html('[пошта]({{telegramUrl}})');
    expect(out).not.toContain('href="{{telegramUrl}}"');
    expect(out).toContain('пошта');
  });

  it('не пропускає HTML із тексту', () => {
    const out = html('<script>alert(1)</script> і <b>жирний</b>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<b>');
    // Кутові дужки лишаються екранованим текстом — саме так і має бути.
    expect(out).toContain('&lt;script&gt;');
  });

  it('не пропускає javascript: у посиланні', () => {
    // Схема блока такий href не прийме взагалі, але рендер не має покладатися
    // на те, що перед ним хтось перевірив: у базі може лежати старий запис.
    const out = html('[клік](javascript:alert(1))');
    expect(out).not.toContain('javascript:');
  });

  it('лишає звичайний текст недоторканим', () => {
    expect(html('просто речення')).toBe('просто речення');
  });
});
