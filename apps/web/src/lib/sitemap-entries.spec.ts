import { describe, expect, it } from 'vitest';
import type { PageListDto, SitemapDto } from '@dt/contracts';
import { buildSitemap } from './sitemap-entries';

const BASE = 'https://babaka.shop';
const d = (iso: string) => new Date(iso);

const data: SitemapDto = {
  prints: [
    { slug: 'winter-shpits', updatedAt: d('2026-10-10T10:00:00Z') },
    { slug: 'polo-amstaf', updatedAt: d('2026-10-15T10:00:00Z') },
  ],
  breeds: [{ slug: 'taksa', updatedAt: d('2026-10-01T10:00:00Z') }],
  collections: [{ slug: 'babaky-v-pabi', updatedAt: d('2026-09-20T10:00:00Z') }],
  garments: [{ slug: 'hudi-klasychnyi', updatedAt: d('2026-08-01T10:00:00Z') }],
};

const card = (slug: string, kind: 'PAGE' | 'ARTICLE', updatedAt: string) => ({
  slug, kind, title: slug, excerpt: '', coverUrl: '', publishedAt: null, updatedAt,
  readingMinutes: 1, breeds: [], collections: [],
});

const pages: PageListDto = {
  items: [
    card('home', 'PAGE', '2026-10-01T00:00:00.000Z'),
    card('oferta', 'PAGE', '2026-09-01T00:00:00.000Z'),
    card('spivpratsia', 'PAGE', '2026-09-01T00:00:00.000Z'),
    card('yak-praty-odyah-z-pryntom', 'ARTICLE', '2026-08-26T10:45:35.428Z'),
  ],
};

describe('buildSitemap', () => {
  const map = buildSitemap(BASE, data, pages);
  const byUrl = new Map(map.map((e) => [e.url, e]));

  it('містить головні сторінки, посадкову й усі сутності каталогу', () => {
    for (const path of [
      '/', '/prints', '/odyag-z-sobakamy', '/breeds', '/collections',
      '/breeds/taksa', '/collections/babaky-v-pabi',
      '/prints/winter-shpits', '/prints/polo-amstaf', '/vyroby/hudi-klasychnyi',
      '/oferta', '/statti/yak-praty-odyah-z-pryntom',
    ]) {
      expect(byUrl.has(`${BASE}${path}`), path).toBe(true);
    }
  });

  it('усі адреси абсолютні, на одному домені, без query-параметрів і дублів', () => {
    for (const e of map) {
      expect(e.url.startsWith(`${BASE}/`)).toBe(true);
      expect(e.url).not.toContain('?');
    }
    expect(new Set(map.map((e) => e.url)).size).toBe(map.length);
  });

  it('не пускає в карту дубль головної, редирект і службові сторінки', () => {
    expect(byUrl.has(`${BASE}/home`)).toBe(false);
    expect(byUrl.has(`${BASE}/spivpratsia`)).toBe(false);
    for (const path of ['/search', '/koshyk', '/oformlennya', '/admin']) {
      expect(byUrl.has(`${BASE}${path}`)).toBe(false);
    }
  });

  it('lastmod добірок — найсвіжіша зміна того, що на них показано', () => {
    expect(byUrl.get(`${BASE}/prints`)?.lastModified).toEqual(d('2026-10-15T10:00:00Z'));
    expect(byUrl.get(`${BASE}/odyag-z-sobakamy`)?.lastModified).toEqual(d('2026-10-15T10:00:00Z'));
    expect(byUrl.get(`${BASE}/`)?.lastModified).toEqual(d('2026-10-15T10:00:00Z'));
    expect(byUrl.get(`${BASE}/breeds`)?.lastModified).toEqual(d('2026-10-01T10:00:00Z'));
    expect(byUrl.get(`${BASE}/collections`)?.lastModified).toEqual(d('2026-09-20T10:00:00Z'));
    expect(byUrl.get(`${BASE}/statti`)?.lastModified).toEqual(d('2026-08-26T10:45:35.428Z'));
  });

  it('довідкові сторінки без вигаданого lastmod', () => {
    expect(byUrl.get(`${BASE}/faq`)?.lastModified).toBeUndefined();
  });

  it('API мовчить — карта все одно віддає головні сторінки', () => {
    const fallback = buildSitemap(BASE, null, null).map((e) => e.url);
    expect(fallback).toEqual(expect.arrayContaining([
      `${BASE}/`, `${BASE}/prints`, `${BASE}/odyag-z-sobakamy`, `${BASE}/breeds`, `${BASE}/collections`,
    ]));
  });
});
