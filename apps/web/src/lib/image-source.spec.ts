import { describe, expect, it } from 'vitest';
import config, { BLOB_HOST as CONFIG_HOST, BLOB_PATHS as CONFIG_PATHS } from '../../next.config.mjs';
import { BLOB_HOST, BLOB_PATHS, canOptimizeImage } from './image-source';

describe('canOptimizeImage', () => {
  it('приймає обкладинки принтів, іконки порід і фото сторінок у нашому Blob', () => {
    expect(canOptimizeImage(`https://${BLOB_HOST}/prints/winter-shpits/cover-abc.webp`)).toBe(true);
    expect(canOptimizeImage(`https://${BLOB_HOST}/breeds/vestik-abc.webp`)).toBe(true);
    expect(canOptimizeImage(`https://${BLOB_HOST}/media/main-page-cover-abc.webp`)).toBe(true);
  });

  it('не чіпає чужі хости, інші теки і відносні адреси', () => {
    expect(canOptimizeImage('https://placehold.co/600x600/f0ece3/1a1714?text=x')).toBe(false);
    expect(canOptimizeImage(`https://${BLOB_HOST}/private/page-abc.webp`)).toBe(false);
    expect(canOptimizeImage(`https://${BLOB_HOST}/mediafake/a.webp`)).toBe(false);
    expect(canOptimizeImage(`https://evil.example/https://${BLOB_HOST}/prints/a.webp`)).toBe(false);
    expect(canOptimizeImage('/mock/print.webp')).toBe(false);
  });

  it('хост і теки збігаються з next.config.mjs (remotePatterns)', () => {
    expect(BLOB_HOST).toBe(CONFIG_HOST);
    expect([...BLOB_PATHS]).toEqual(CONFIG_PATHS);
    const patterns = (config as { images?: { remotePatterns?: { hostname: string; pathname?: string }[] } })
      .images?.remotePatterns ?? [];
    for (const dir of BLOB_PATHS) {
      expect(patterns).toContainEqual(expect.objectContaining({ hostname: BLOB_HOST, pathname: `/${dir}/**` }));
    }
  });
});
