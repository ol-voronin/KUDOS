import { MAX_UPLOAD_BYTES } from '@dt/contracts';

/** Довша сторона після стиснення. 2000 px вистачає навіть для екранів 4K. */
const MAX_EDGE = 2000;

/**
 * Стискає фото в браузері перед відправкою.
 *
 * Дві причини, і обидві реальні:
 *
 *  1. Ліміт тіла запиту у Vercel — 4.5 МБ. Фото з телефона легко важить 6–8.
 *     Перша версія обходила це, вантажачи файл із браузера прямо у сховище,
 *     але туди браузер не пускають (CORS), тож файл іде через наш сервер —
 *     і мусить у ліміт влізти.
 *  2. Фото товару віддається як є, без оптимізації на льоту. Знімок на 8 МБ
 *     на мобільному інтернеті — це кілька секунд білого екрана в каталозі.
 *
 * WebP замість JPEG там, де браузер уміє: приблизно вдвічі менший файл при
 * тій самій якості, і головне — зберігає прозорість. Логотип із прозорим
 * фоном, збережений у JPEG, отримав би чорний прямокутник замість неї.
 */
export async function compressImage(file: File): Promise<{ blob: Blob; filename: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Браузер не дав намалювати зображення');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const type = supportsWebp() ? 'image/webp' : 'image/jpeg';
  // Знижуємо якість, поки не влізе. На практиці вистачає першого кроку —
  // цикл тут заради знімків з дуже високою деталізацією.
  for (const quality of [0.82, 0.7, 0.6, 0.5]) {
    const blob = await toBlob(canvas, type, quality);
    if (blob.size <= MAX_UPLOAD_BYTES) {
      return { blob, filename: renameTo(file.name, type) };
    }
  }
  throw new Error('Не вдалося стиснути фото до потрібного розміру. Спробуйте менший знімок.');
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Не вдалося перекодувати зображення'))),
      type,
      quality,
    );
  });
}

let webpSupport: boolean | null = null;
function supportsWebp(): boolean {
  if (webpSupport === null) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    webpSupport = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpSupport;
}

function renameTo(name: string, type: string): string {
  const ext = type === 'image/webp' ? 'webp' : 'jpg';
  const base = name.replace(/\.[^.]+$/, '') || 'photo';
  return `${base}.${ext}`;
}
