import { describe, expect, it } from 'vitest';
import { breedRuSnippet } from './breed-names-ru';

describe('breedRuSnippet', () => {
  it('будує фразу в орудному відмінку', () => {
    expect(breedRuSnippet('mops')).toBe('Футболка с мопсом — принт породы на футболке и худи.');
    expect(breedRuSnippet('dzhek-rassel')).toContain('с джек расселом');
  });

  it('невідома порода — без фрази', () => {
    expect(breedRuSnippet('nevidoma')).toBe('');
  });
});
