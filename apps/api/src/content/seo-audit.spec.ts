import type { BlockList } from '@dt/contracts';
import { describe, expect, it } from 'vitest';
import { auditSeo, linksOf, resolvesInternally, type AuditPage, type AuditWorld } from './seo-audit';

function hero(heading = 'Заголовок'): BlockList[number] {
  return {
    type: 'hero', id: 'h', tone: 'plain',
    eyebrow: '', heading, lead: '', footnote: '', links: [],
    image: { url: '', alt: '', caption: '' },
  } as BlockList[number];
}

function page(over: Partial<AuditPage> = {}): AuditPage {
  return {
    id: 'p1', slug: 'storinka', kind: 'PAGE', isPublished: true,
    title: 'Звичайна сторінка про принти',
    seoTitle: '', seoDescription: 'Опис, який має довжину десь у сімдесят із чимось символів, щоб пройти перевірку.',
    excerpt: '', noindex: false,
    blocks: [hero()] as BlockList,
    ...over,
  };
}

function world(over: Partial<AuditWorld> = {}): AuditWorld {
  return {
    pages: [page()],
    allowIndexing: true,
    brand: 'Бренд',
    printSlugs: new Set(['korhi']),
    breedSlugs: new Set(['korhi']),
    collectionSlugs: new Set(['portrety']),
    ...over,
  };
}

const codes = (w: AuditWorld): string[] => auditSeo(w).map((f) => f.code);

describe('auditSeo', () => {
  it('на чистій сторінці не знаходить дефектів', () => {
    expect(codes(world())).toEqual([]);
  });

  it('вимкнена індексація — окремий рядок, і не помилка', () => {
    const found = auditSeo(world({ allowIndexing: false }));
    expect(found).toHaveLength(1);
    expect(found[0]?.level).toBe('info');
    expect(found[0]?.code).toBe('INDEXING_OFF');
  });

  it('однакові заголовки позначає на обох сторінках', () => {
    const a = page({ id: 'a', slug: 'a' });
    const b = page({ id: 'b', slug: 'b' });
    const found = auditSeo(world({ pages: [a, b] })).filter((f) => f.code === 'DUPLICATE_TITLE');

    expect(found).toHaveLength(2);
    // У підказці має бути видно, з чим саме збіг — інакше шукати доводиться руками.
    expect(found[0]?.fix).toContain('/b');
  });

  it('чернетки не рахуються за дублікати', () => {
    const a = page({ id: 'a', slug: 'a' });
    const b = page({ id: 'b', slug: 'b', isPublished: false });
    expect(codes(world({ pages: [a, b] }))).not.toContain('DUPLICATE_TITLE');
  });

  it('порожній опис — помилка, задовгий — попередження', () => {
    expect(codes(world({ pages: [page({ seoDescription: '', excerpt: '' })] }))).toContain('NO_DESCRIPTION');
    expect(codes(world({ pages: [page({ seoDescription: 'о'.repeat(200) })] }))).toContain('DESCRIPTION_TOO_LONG');
  });

  it('бере опис зі сторінки, коли SEO-поле порожнє', () => {
    const found = codes(world({
      pages: [page({ seoDescription: '', excerpt: 'Достатньо довгий короткий опис сторінки, якого вистачає для видачі й трохи більше.' })],
    }));
    expect(found).not.toContain('NO_DESCRIPTION');
  });

  it('задовгий заголовок ловиться разом із доданим брендом', () => {
    // 55 символів у назві + « — Бренд» дає більше за межу: рахувати треба те,
    // що побачить пошук, а не те, що набрали у формі.
    const found = codes(world({ pages: [page({ title: 'т'.repeat(55) })] }));
    expect(found).toContain('TITLE_TOO_LONG');
  });

  it('сторінка без героя — без H1', () => {
    expect(codes(world({ pages: [page({ blocks: [] as unknown as BlockList })] }))).toContain('NO_H1');
  });

  it('матеріал без героя — не дефект: заголовок малює маршрут', () => {
    const article = page({ kind: 'ARTICLE', blocks: [] as unknown as BlockList });
    expect(codes(world({ pages: [article] }))).not.toContain('NO_H1');
  });

  it('знаходить посилання в нікуди й не чіпає зовнішні', () => {
    const withLinks = page({
      blocks: [{
        type: 'cta', id: 'c', tone: 'plain', heading: 'Заклик', text: 'Дивіться [тут](/nemaye) і [там](https://example.com)',
        links: [{ label: 'Каталог', href: '/prints', secondary: false }],
      }] as unknown as BlockList,
      seoDescription: 'Опис, який має довжину десь у сімдесят із чимось символів, щоб пройти перевірку.',
    });
    const found = auditSeo(world({ pages: [withLinks] })).filter((f) => f.code === 'BROKEN_LINK');

    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain('/nemaye');
  });

  it('картинка без опису — одне попередження на сторінку, а не десять', () => {
    const gallery = page({
      blocks: [{
        type: 'gallery', id: 'g', tone: 'plain', heading: '',
        items: [{ url: '/a.webp', alt: '', caption: '' }, { url: '/b.webp', alt: '', caption: '' }],
      }] as unknown as BlockList,
    });
    expect(auditSeo(world({ pages: [gallery] })).filter((f) => f.code === 'IMAGE_NO_ALT')).toHaveLength(1);
  });

  it('спершу помилки, потім попередження, потім решта', () => {
    const bad = page({ seoDescription: '', excerpt: '', noindex: true });
    const levels = auditSeo(world({ pages: [bad], allowIndexing: false })).map((f) => f.level);
    expect(levels).toEqual([...levels].sort((a, b) => (a === b ? 0 : a === 'error' ? -1 : b === 'error' ? 1 : a === 'warning' ? -1 : 1)));
    expect(levels[0]).toBe('error');
  });
});

describe('resolvesInternally', () => {
  const w = world();

  it('статичні маршрути завжди дійсні', () => {
    expect(resolvesInternally('/prints', w)).toBe(true);
    expect(resolvesInternally('/', w)).toBe(true);
  });

  it('перевіряє каталог за справжніми адресами', () => {
    expect(resolvesInternally('/prints/korhi', w)).toBe(true);
    expect(resolvesInternally('/prints/nemaye', w)).toBe(false);
    expect(resolvesInternally('/collections/portrety', w)).toBe(true);
  });

  it('зовнішні, пошту й телефони не перевіряє', () => {
    expect(resolvesInternally('https://t.me/x', w)).toBeNull();
    expect(resolvesInternally('mailto:a@b.c', w)).toBeNull();
  });

  it('якір і параметри не заважають', () => {
    expect(resolvesInternally('/prints?page=2', w)).toBe(true);
    expect(resolvesInternally('/storinka#блок', w)).toBe(true);
  });
});

describe('linksOf', () => {
  it('збирає і кнопки, і посилання з тексту', () => {
    const blocks = [{
      type: 'cta', id: 'c', tone: 'plain', heading: 'З', text: 'ось [тут](/a)',
      links: [{ label: 'Б', href: '/b', secondary: false }],
    }] as unknown as BlockList;

    expect(linksOf(blocks).sort()).toEqual(['/a', '/b']);
  });
});
