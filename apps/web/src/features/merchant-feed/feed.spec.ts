import { describe, expect, it } from 'vitest';
import type { GarmentDto, PrintOfferDto, VariantDto } from '@dt/contracts';
import { resolvePreselect } from '@/features/catalog/offer-link';
import { BLOB_PRINTS_PREFIX } from '@/lib/image-source';
import {
  buildFeedItems, cleanForAds, escapeXml, feedId, FEED_SELECTION, formatPrice, renderFeedXml,
  type FeedContext,
} from './feed';

// ---------------------------------------------------------------------------
// Фікстура: принт із футболкою й худі, два кольори, кілька розмірів
// ---------------------------------------------------------------------------

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const COLOURS = [
  { id: uuid(901), name: 'Чорний', supplierCode: 'chornyi', hex: '#1A1A1A', imageUrl: null },
  { id: uuid(902), name: 'Білий', supplierCode: 'bilyi', hex: '#ECECF0', imageUrl: null },
];

function garment(n: number, slug: string, over: Partial<GarmentDto>, sizes: string[]): GarmentDto {
  return {
    id: uuid(n),
    slug,
    line: 'OWN_PRODUCTION',
    type: 'TSHIRT',
    fit: 'CLASSIC',
    name: 'Футболка класична унісекс',
    lengthAdjustable: false,
    basePriceMinor: 59_000,
    description: 'Ніжна та легка футболка класичного прямого крою.',
    fabrics: [{ id: uuid(n + 50), name: 'Бавовна 180', weightGsm: 180, composition: '100% органічна бавовна.', origin: null }],
    sizes: sizes.map((label, i) => ({ id: uuid(n * 100 + i), label, position: i, measurements: [] })),
    ...over,
  };
}

const TEE = garment(1, 'futbolka-klasychna', {}, ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL']);
const HOODIE = garment(2, 'hudi-klasychnyi', {
  type: 'HOODIE', name: 'Класичний худі унісекс', basePriceMinor: 170_000,
  description: 'Худі прямого крою з тонкого флісу.',
}, ['XS', 'S', 'M', 'L', 'XL', '2XL']);
const OVERSIZE = garment(3, 'futbolka-oversayz-cholovicha', { fit: 'OVERSIZE', basePriceMinor: 89_000 }, ['S', 'M']);

let nextVariant = 10_000;
function variantsFor(g: GarmentDto, colourIds: string[], price: number): VariantDto[] {
  return colourIds.flatMap((colourId) => g.sizes.map((s) => ({
    id: uuid(nextVariant++),
    sku: `${g.slug}--${COLOURS.find((c) => c.id === colourId)?.supplierCode}--${s.label}`,
    garmentId: g.id,
    fabricId: g.fabrics[0]!.id,
    colourId,
    sizeId: s.id,
    availability: 'MADE_TO_ORDER' as const,
    leadTimeDays: 5,
    priceOverrideMinor: null,
    priceMinor: price,
  })));
}

function offer(slug: string, title: string, over: Partial<PrintOfferDto['print']> = {}): PrintOfferDto {
  return {
    print: {
      id: uuid(500),
      slug,
      title,
      sizeTier: 'MEDIUM',
      collectionSlugs: ['polo-babaky'],
      breedSlugs: ['shpits'],
      previewUrl: `${BLOB_PRINTS_PREFIX}${slug}/cover.webp`,
      mockupUrl: '',
      isPublished: true,
      ...over,
    },
    images: [
      { url: `${BLOB_PRINTS_PREFIX}${slug}/cover.webp`, alt: `${title} — на моделі` },
      { url: `${BLOB_PRINTS_PREFIX}${slug}/art.webp`, alt: title },
    ],
    garments: [TEE, HOODIE, OVERSIZE],
    colours: COLOURS,
    variants: [
      ...variantsFor(TEE, [uuid(901), uuid(902)], 59_000),
      ...variantsFor(HOODIE, [uuid(901)], 170_000),
      ...variantsFor(OVERSIZE, [uuid(901)], 89_000),
    ],
    printPriceMinor: 60_000,
  };
}

const CTX: FeedContext = {
  baseUrl: 'https://babaka.shop',
  brand: 'БАБАКА',
  cityIn: 'у Харкові',
  collections: new Map([
    ['polo-babaky', 'Polo Бабаки'],
    ['babaky-v-pabi', 'Бабаки в пабі'],
    ['fck-winter', 'F*ck winter'],
  ]),
  breeds: new Map([['shpits', 'Шпіц'], ['vestik', 'Вест-хайленд-тер’єр'], ['akita-inu', 'Акіта-іну']]),
};

/**
 * Мінімальна перевірка well-formed XML без сторонніх бібліотек: теги
 * парні й правильно вкладені, а в тексті немає голих `<` чи `&`, що не
 * є сутністю. Цього досить, щоб зловити неекрановані дані з адмінки.
 */
function assertWellFormed(xml: string): void {
  const body = xml.replace(/^<\?xml[^>]*\?>\s*/, '');
  const stack: string[] = [];
  const re = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"<&]*")*)\s*(\/?)>|([^<]+)|(<)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m[6] !== undefined) throw new Error(`голий «<» на позиції ${m.index}`);
    if (m[5] !== undefined) {
      const bad = m[5].match(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/);
      if (bad) throw new Error(`неекранований «&» у «${m[5].slice(0, 60)}»`);
      continue;
    }
    const [, closing, name, , selfClosing] = m;
    if (selfClosing) continue;
    if (closing) {
      const open = stack.pop();
      if (open !== name) throw new Error(`</${name}> закриває <${open}>`);
    } else {
      stack.push(name!);
    }
  }
  if (stack.length > 0) throw new Error(`незакриті теги: ${stack.join(', ')}`);
}

const fieldsOf = (xml: string) => xml.split('<item>').slice(1).map((chunk) => {
  const fields = new Map<string, string[]>();
  for (const m of chunk.matchAll(/<([\w:]+)>([^<]*)<\/\1>/g)) {
    fields.set(m[1]!, [...(fields.get(m[1]!) ?? []), m[2]!]);
  }
  return fields;
});

// ---------------------------------------------------------------------------

describe('фід Google Merchant', () => {
  const offers = [offer('polo-shpits', 'Шпіц'), offer('pab-shpits', 'Шпіц', { id: uuid(501), collectionSlugs: ['babaky-v-pabi'] })];
  const items = buildFeedItems(offers, CTX);
  const xml = renderFeedXml(items, { title: 'Бабака', link: 'https://babaka.shop/', description: 'Тест' });

  it('бере лише відібрані вироби й колір, кожен розмір окремою позицією', () => {
    // 7 розмірів футболки + 6 худі, у чорному; білий колір і оверсайз не відібрані.
    expect(FEED_SELECTION.map((s) => s.garmentSlug)).toEqual(['futbolka-klasychna', 'hudi-klasychnyi']);
    expect(items).toHaveLength(2 * (7 + 6));
    expect(items.every((i) => i.color === 'Чорний')).toBe(true);
    expect(new Set(items.filter((i) => i.link.includes('polo-shpits')).map((i) => i.itemGroupId)).size).toBe(2);
  });

  it('видає well-formed RSS 2.0 з простором імен g:', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">');
    expect(() => assertWellFormed(xml)).not.toThrow();
  });

  it('у кожної позиції є обовʼязкові поля', () => {
    const required = [
      'g:id', 'title', 'description', 'link', 'g:image_link', 'g:availability', 'g:price',
      'g:brand', 'g:identifier_exists', 'g:condition', 'g:item_group_id', 'g:google_product_category',
      'g:gender', 'g:age_group', 'g:color', 'g:size',
    ];
    const parsed = fieldsOf(xml);
    expect(parsed).toHaveLength(items.length);
    for (const fields of parsed) {
      for (const name of required) expect(fields.get(name)?.[0], name).toBeTruthy();
      expect(fields.get('g:identifier_exists')?.[0]).toBe('no');
      expect(fields.get('g:condition')?.[0]).toBe('new');
      expect(fields.get('g:brand')?.[0]).toBe('БАБАКА');
      expect(fields.get('g:availability')?.[0]).toBe('in_stock');
      expect(fields.get('g:google_product_category')?.[0]).toBe('212');
      expect(fields.get('g:link')).toBeUndefined();
    }
  });

  it('id унікальні, не довші за 50 символів і стабільні', () => {
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.length <= 50)).toBe(true);
    expect(ids).toContain('polo-shpits--futbolka-klasychna--chornyi--M');
    expect(buildFeedItems(offers, CTX).map((i) => i.id)).toEqual(ids);
  });

  it('довгий id стискається хешем, а не обрізається до дубля', () => {
    const a = feedId('pab-maltipu-i-kavaler--futbolka-klasychna--chornyi--XXS');
    const b = feedId('pab-maltipu-i-kavaler--futbolka-klasychna--chornyi--XS');
    expect(a.length).toBe(50);
    expect(b.length).toBe(50);
    expect(a).not.toBe(b);
    expect(feedId('pab-maltipu-i-kavaler--futbolka-klasychna--chornyi--XXS')).toBe(a);
  });

  it('ціна — виріб плюс друк, у форматі «1190.00 UAH»', () => {
    expect(formatPrice(119_000)).toBe('1190.00 UAH');
    expect(formatPrice(5)).toBe('0.05 UAH');
    const tee = items.find((i) => i.id === 'polo-shpits--futbolka-klasychna--chornyi--M');
    const hoodie = items.find((i) => i.id === 'polo-shpits--hudi-klasychnyi--chornyi--M');
    expect(tee?.price).toBe('1190.00 UAH');
    expect(hoodie?.price).toBe('2300.00 UAH');
    for (const i of items) expect(i.price).toMatch(/^\d+\.\d{2} UAH$/);
  });

  it('назви унікальні між колекціями і з виробом', () => {
    const titles = new Set(items.map((i) => `${i.itemGroupId}|${i.title}`));
    const byTitle = new Set(items.map((i) => i.title));
    expect(byTitle.size).toBe(4); // 2 принти × 2 вироби
    expect(titles.size).toBe(4);
    expect(items[0]?.title).toBe('Футболка класична унісекс з принтом «Шпіц» (Polo Бабаки)');
  });

  it('додає породу, якщо її немає в назві принта', () => {
    const [item] = buildFeedItems([offer('polo-vestik', 'Вестік', { breedSlugs: ['vestik'] })], CTX);
    expect(item?.title).toBe('Футболка класична унісекс з принтом «Вестік» (Polo Бабаки) — Вест-хайленд-тер’єр');
    expect(item?.productTypes).toEqual(['Футболки > Вест-хайленд-тер’єр']);
  });

  it('прибирає лайку з назв і описів', () => {
    expect(cleanForAds('F*ck winter')).toBe('Winter');
    expect(cleanForAds('F*ck you, winter')).toBe('Winter');
    expect(cleanForAds('Fuck winter')).toBe('Winter');
    expect(cleanForAds('Polo Бабаки')).toBe('Polo Бабаки');
    const winter = buildFeedItems([offer('winter-akita', 'Акіта', { collectionSlugs: ['fck-winter'], breedSlugs: ['akita-inu'] })], CTX);
    expect(winter[0]?.title).toBe('Футболка класична унісекс з принтом «Акіта» (Winter)');
    for (const i of winter) {
      expect(`${i.title} ${i.description}`).not.toMatch(/f\W*u?\W*c\W*k/i);
    }
  });

  it('екранує &, <, > і лапки в даних', () => {
    expect(escapeXml('Tom & Jerry <3 "x" \'y\'')).toBe('Tom &amp; Jerry &lt;3 &quot;x&quot; &apos;y&apos;');
    expect(escapeXml('a\u0001b')).toBe('ab');
    const nasty = buildFeedItems([offer('polo-nasty', 'Пес & <Кіт>', { breedSlugs: [] })], CTX);
    const out = renderFeedXml(nasty, { title: 'A & B', link: 'https://babaka.shop/', description: '<x>' });
    expect(() => assertWellFormed(out)).not.toThrow();
    expect(out).toContain('«Пес &amp; &lt;Кіт&gt;»');
    expect(out).toContain('<title>A &amp; B</title>');
    // Посилання з кількома параметрами — `&` між ними теж екранується.
    expect(out).toMatch(/<link>https:\/\/babaka\.shop\/prints\/polo-nasty\?garment=futbolka-klasychna&amp;colour=chornyi&amp;size=XXS<\/link>/);
  });

  it('картинки — через оптимізатор сайту, а не прямо з Blob', () => {
    const item = items[0]!;
    expect(item.imageLink.startsWith('https://babaka.shop/_next/image?url=')).toBe(true);
    expect(item.imageLink).toContain('w=1200');
    expect(item.additionalImageLinks).toHaveLength(1);
    expect(item.additionalImageLinks[0]).toContain(encodeURIComponent('art.webp'));
  });

  it('посилання відкриває саме цей виріб, колір і розмір', () => {
    const o = offers[0]!;
    for (const item of items.filter((i) => i.link.includes('/prints/polo-shpits?'))) {
      const params = new URL(item.link).searchParams;
      const pick = resolvePreselect(o, params);
      const v = o.variants.find((x) => x.garmentId === pick?.garmentId && x.colourId === pick?.colourId && x.sizeId === pick?.sizeId);
      expect(v, item.link).toBeDefined();
      expect(formatPrice(v!.priceMinor + o.printPriceMinor)).toBe(item.price);
      expect(feedId(`polo-shpits--${v!.sku}`)).toBe(item.id);
    }
  });

  it('принт без чорного кольору не випадає: береться перший наявний колір', () => {
    const o = offer('zirky-light', 'Світлий', { breedSlugs: [] });
    o.variants = o.variants.filter((v) => v.colourId !== uuid(901) || v.garmentId === OVERSIZE.id);
    const out = buildFeedItems([o], CTX);
    expect(out).toHaveLength(7); // футболка в білому; худі є лише в чорному — немає й худі
    expect(out.every((i) => i.color === 'Білий' && i.link.includes('colour=bilyi'))).toBe(true);
  });

  it('недоступний варіант — out_of_stock, неопублікований принт — поза фідом', () => {
    const o = offer('polo-shpits', 'Шпіц');
    o.variants = o.variants.map((v) => (v.sku.endsWith('--2XL') ? { ...v, availability: 'UNAVAILABLE' as const, leadTimeDays: null } : v));
    const out = buildFeedItems([o], CTX);
    expect(out.filter((i) => i.availability === 'out_of_stock').map((i) => i.size)).toEqual(['2XL', '2XL']);
    expect(buildFeedItems([offer('x', 'X', { isPublished: false })], CTX)).toHaveLength(0);
  });

  it('опис узятий з даних товару і не обіцяє «шиємо»', () => {
    const d = items[0]!.description;
    expect(d).toContain('Ніжна та легка футболка класичного прямого крою.');
    expect(d).toContain('100% органічна бавовна');
    expect(d).toContain('Друкуємо у Харкові');
    expect(d).not.toMatch(/ши[єю]/i);
    expect(items[0]!.minHandlingTime).toBe(1);
    expect(items[0]!.maxHandlingTime).toBe(5);
    expect(d).toContain('до 5 робочих днів');
  });
});
