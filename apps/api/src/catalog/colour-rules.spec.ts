import { describe, expect, it } from 'vitest';
import { effectiveExcludedColours } from './colour-rules';

const ids = (s: Set<string>) => [...s].sort();

describe('кольори принта з урахуванням колекції', () => {
  it('без жодних правил принт друкується на всіх кольорах', () => {
    expect(ids(effectiveExcludedColours({ collectionExcluded: [], printExcluded: [], printAllowed: [] }))).toEqual([]);
  });

  it('заборона колекції доходить до кожного принта — навіть без його власних налаштувань', () => {
    const s = effectiveExcludedColours({ collectionExcluded: [['red', 'pink']], printExcluded: [], printAllowed: [] });
    expect(ids(s)).toEqual(['pink', 'red']);
  });

  it('принт може повернути колір, заборонений колекцією', () => {
    const s = effectiveExcludedColours({ collectionExcluded: [['red', 'pink']], printExcluded: [], printAllowed: ['red'] });
    expect(ids(s)).toEqual(['pink']);
  });

  it('принт може заборонити більше, ніж колекція', () => {
    const s = effectiveExcludedColours({ collectionExcluded: [['red']], printExcluded: ['khaki'], printAllowed: [] });
    expect(ids(s)).toEqual(['khaki', 'red']);
  });

  it('дві колекції — заборони складаються', () => {
    const s = effectiveExcludedColours({ collectionExcluded: [['red'], ['pink']], printExcluded: [], printAllowed: [] });
    expect(ids(s)).toEqual(['pink', 'red']);
  });

  it('власна заборона сильніша за власний дозвіл', () => {
    const s = effectiveExcludedColours({ collectionExcluded: [['red']], printExcluded: ['red'], printAllowed: ['red'] });
    expect(ids(s)).toEqual(['red']);
  });
});
