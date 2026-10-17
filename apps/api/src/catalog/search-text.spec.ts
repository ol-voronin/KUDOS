import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { searchText } from '@dt/contracts';

const { normalize, parseQuery, searchCatalog, stem, wordMatches } = searchText;
type SearchableBreed = searchText.SearchableBreed;
type SearchableCollection = searchText.SearchableCollection;
type SearchablePrint = searchText.SearchablePrint;

/*
 * Знімок каталогу з продакшну на 17.10.2026 (лише назви, синоніми, звʼязки;
 * id = slug). Тести на справжніх назвах, бо саме на них пошук і ламався:
 * «Стафордширський тер’єр» з апострофом, «Шпіц» через «і», «Амстаф» у назві
 * принта при «Стафорд» у породі.
 */
const catalog = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'catalog-2026-10-17.json'), 'utf8'),
) as {
  breeds: SearchableBreed[];
  collections: SearchableCollection[];
  prints: SearchablePrint[];
};
const ALL = catalog.prints.length;

const search = (q: string) => searchCatalog(q, catalog);

describe('normalize', () => {
  it('нижній регістр, і/ї/и/ы → и, є/е/э → е, без апострофів і мʼякого знака', () => {
    expect(normalize('Стафордширський тер’єр')).toBe(normalize('стафордширский терьер'));
    expect(normalize('Шпіц')).toBe(normalize('шпиц'));
    expect(normalize('ХУДІ')).toBe(normalize('худи'));
    expect(normalize('Світшот')).toBe(normalize('свитшот'));
    expect(normalize("Бультер'єр")).toBe(normalize('Бультерʼєр'));
  });

  it('подвоєні літери рахуються однією: стаффорд = стафорд', () => {
    expect(normalize('стаффорд')).toBe(normalize('стафорд'));
    expect(normalize('амстафф')).toBe('амстаф');
  });

  it('дефіси й розділові знаки ділять слова', () => {
    expect(normalize('Вест-хайленд-тер’єр!')).toBe('вест хайленд терер');
  });
});

describe('stem / wordMatches', () => {
  it('відмінки однієї породи мають спільну основу', () => {
    for (const form of ['такса', 'таксою', 'такси', 'таксу', 'таксой']) {
      expect(stem(normalize(form))).toBe('такс');
    }
    expect(stem(normalize('мопса'))).toBe('мопс');
    expect(stem(normalize('доберманом'))).toBe('доберман');
  });

  it('початок слова — для набору наживо, але не середина', () => {
    expect(wordMatches('так', 'такса')).toBe(true);
    expect(wordMatches('дог', 'бульдог')).toBe(false);
  });

  it('укр. і рос. форми одного слова', () => {
    expect(wordMatches(normalize('французским'), normalize('французький'))).toBe(true);
    expect(wordMatches(normalize('шпицем'), normalize('шпіц'))).toBe(true);
  });
});

describe('parseQuery', () => {
  it('вироби стають фільтром, а не словом пошуку', () => {
    expect(parseQuery('футболка з таксою')).toEqual({ terms: ['таксою'], garmentTypes: ['TSHIRT'] });
    expect(parseQuery('Худі').garmentTypes).toEqual(['HOODIE']);
    expect(parseQuery('худи').garmentTypes).toEqual(['HOODIE']);
    expect(parseQuery('свитшот').garmentTypes).toEqual(['SWEATSHIRT']);
    expect(parseQuery('світшоти').garmentTypes).toEqual(['SWEATSHIRT']);
    expect(parseQuery('футболки').garmentTypes).toEqual(['TSHIRT']);
    expect(parseQuery('кофта').garmentTypes).toEqual(['HOODIE', 'SWEATSHIRT']);
  });

  it('«собака», «пес» і службові слова нічого не звужують', () => {
    expect(parseQuery('худі з собакою')).toEqual({ terms: [], garmentTypes: ['HOODIE'] });
    expect(parseQuery('футболка с собакой купить').terms).toEqual([]);
  });

  it('запит лише зі службових слів не перетворюється на «весь каталог»', () => {
    expect(parseQuery('та').terms).toEqual(['та']);
  });
});

/**
 * Запити з аудиту 17.10.2026 (IA-2) і з реклами (category-demand-2026-10-17):
 * до цієї зміни кожен із них давав нуль.
 */
describe('searchCatalog: запити з аудиту й реклами', () => {
  const cases: Array<[string, { minPrints: number; breed?: string; garment?: string }]> = [
    ['футболка', { minPrints: ALL, garment: 'TSHIRT' }],
    ['худі', { minPrints: ALL, garment: 'HOODIE' }],
    ['худи', { minPrints: ALL, garment: 'HOODIE' }],
    ['світшот', { minPrints: ALL, garment: 'SWEATSHIRT' }],
    ['свитшот', { minPrints: ALL, garment: 'SWEATSHIRT' }],
    ['собака', { minPrints: ALL }],
    ['худі з собакою', { minPrints: ALL, garment: 'HOODIE' }],
    ['футболка с собакой', { minPrints: ALL, garment: 'TSHIRT' }],
    ['мопс футболка', { minPrints: 2, breed: 'mops', garment: 'TSHIRT' }],
    ['худи с мопсом', { minPrints: 2, breed: 'mops', garment: 'HOODIE' }],
    ['мопса', { minPrints: 2, breed: 'mops' }],
    ['такси', { minPrints: 2, breed: 'taksa' }],
    ['таксою', { minPrints: 2, breed: 'taksa' }],
    ['футболка з таксою', { minPrints: 2, breed: 'taksa', garment: 'TSHIRT' }],
    ['футболка с таксой', { minPrints: 2, breed: 'taksa', garment: 'TSHIRT' }],
    ['доберман', { minPrints: 3, breed: 'doberman' }],
    ['футболка с доберманом', { minPrints: 3, breed: 'doberman', garment: 'TSHIRT' }],
    ['стаффорд', { minPrints: 2, breed: 'staford' }],
    ['амстаф', { minPrints: 2, breed: 'staford' }],
    ['шпиц', { minPrints: 3, breed: 'shpits' }],
    ['футболка со шпицем', { minPrints: 3, breed: 'shpits', garment: 'TSHIRT' }],
    ['французский бульдог', { minPrints: 3, breed: 'frantsuzkyi-buldog' }],
    ['корги', { minPrints: 3, breed: 'korgi' }],
    ['вест хайленд', { minPrints: 3, breed: 'vestik' }],
    ['dachshund', { minPrints: 2, breed: 'taksa' }],
  ];

  it.each(cases)('«%s»', (q, want) => {
    const hit = search(q);
    expect(hit.printIds.length).toBeGreaterThanOrEqual(want.minPrints);
    if (want.breed) expect(hit.breedIds[0]).toBe(want.breed);
    if (want.garment) expect(hit.garmentTypes).toContain(want.garment);
  });

  it('кілька слів — AND: «мопс футболка» дає лише мопсів, а не весь каталог', () => {
    const hit = search('мопс футболка');
    expect(hit.printIds.length).toBeLessThan(10);
    for (const id of hit.printIds) {
      const p = catalog.prints.find((x) => x.id === id)!;
      expect(p.breedIds).toContain('mops');
    }
  });

  it('порода + колекція: «доберман поло» → лише polo-doberman', () => {
    expect(search('доберман поло').printIds).toEqual(['polo-doberman']);
  });

  it('принт знаходиться за другою породою в назві: «йорк» → «Такса і йорк»', () => {
    expect(search('йорк').printIds).toContain('pab-taksa-i-york');
  });

  it('«зима» веде в F*ck winter', () => {
    const hit = search('зима');
    expect(hit.collectionIds).toContain('fck-winter');
    expect(hit.printIds.length).toBeGreaterThan(5);
  });

  it('схожі породи не змішуються: «мальтіпу» без «мальтезе»', () => {
    expect(search('мальтипу').breedIds).toEqual(['maltipu']);
  });

  it('«дог» не знаходить бульдогів', () => {
    expect(search('дог').breedIds).not.toContain('frantsuzkyi-buldog');
  });

  it('нісенітниця дає нуль, а не весь каталог', () => {
    const hit = search('ывапролдж');
    expect(hit.printIds).toEqual([]);
    expect(hit.breedIds).toEqual([]);
  });

  it('порожній запит — порожньо', () => {
    expect(search('  ').printIds).toEqual([]);
  });
});
