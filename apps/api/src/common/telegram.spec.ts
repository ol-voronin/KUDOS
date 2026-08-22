import { describe, expect, it } from 'vitest';
import { escapeHtml } from './telegram';

describe('escapeHtml', () => {
  it('escape по порядку: & перед <', () => {
    expect(escapeHtml('<')).toBe('&lt;');
  });

  it('escape всі три символи', () => {
    expect(escapeHtml('<a & b>')).toBe('&lt;a &amp; b&gt;');
  });
});
