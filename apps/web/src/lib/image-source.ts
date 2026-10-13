/**
 * Які картинки можна пускати через `next/image` (оптимізатор Vercel).
 *
 * Дозвіл у `next.config.mjs` (`images.remotePatterns`) стосується тільки
 * обкладинок принтів у нашому Blob. Усе інше (демо-дані з placehold.co,
 * чужі посилання з адмінки) оптимізатор відхилив би помилкою 400, і картка
 * лишилась би без фото. Тому перед `next/image` перевіряємо адресу тут, а
 * решту віддаємо звичайним `<img>`, як було раніше.
 *
 * `BLOB_HOST` дублює `next.config.mjs`: конфіг не вміє імпортувати TypeScript,
 * а тут не можна імпортувати конфіг у браузерний код. Збіг перевіряє
 * `image-source.spec.ts`.
 */
export const BLOB_HOST = '57fwtlsqujgnycet.public.blob.vercel-storage.com';
export const BLOB_PRINTS_PREFIX = `https://${BLOB_HOST}/prints/`;

export function canOptimizeImage(src: string): boolean {
  return src.startsWith(BLOB_PRINTS_PREFIX);
}
