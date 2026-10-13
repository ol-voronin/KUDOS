import { describe, expect, it } from 'vitest';
import config, { BLOB_HOST as CONFIG_HOST } from '../../next.config.mjs';
import { BLOB_HOST, canOptimizeImage } from './image-source';

describe('canOptimizeImage', () => {
  it('приймає обкладинки принтів у нашому Blob', () => {
    expect(canOptimizeImage(`https://${BLOB_HOST}/prints/winter-shpits/cover-abc.webp`)).toBe(true);
  });

  it('не чіпає чужі хости, media/ і відносні адреси', () => {
    expect(canOptimizeImage('https://placehold.co/600x600/f0ece3/1a1714?text=x')).toBe(false);
    expect(canOptimizeImage(`https://${BLOB_HOST}/media/page-abc.webp`)).toBe(false);
    expect(canOptimizeImage(`https://evil.example/https://${BLOB_HOST}/prints/a.webp`)).toBe(false);
    expect(canOptimizeImage('/mock/print.webp')).toBe(false);
  });

  it('хост збігається з next.config.mjs (remotePatterns)', () => {
    expect(BLOB_HOST).toBe(CONFIG_HOST);
    const patterns = (config as { images?: { remotePatterns?: { hostname: string; pathname?: string }[] } })
      .images?.remotePatterns ?? [];
    expect(patterns).toContainEqual(expect.objectContaining({ hostname: BLOB_HOST, pathname: '/prints/**' }));
  });
});
