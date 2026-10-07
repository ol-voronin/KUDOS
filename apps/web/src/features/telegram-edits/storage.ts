import { put } from '@vercel/blob';

/**
 * Позначка «цей update уже оброблено».
 *
 * Telegram повторює доставку, якщо не дочекався відповіді, — і без цього
 * одна правка ставала б двома issue. Позначка — порожній файл у Blob,
 * записаний без права перезапису: другий запис з тим самим update_id
 * падає, і це і є відповідь «уже було».
 *
 * Якщо Blob недоступний з іншої причини — обробляємо: ризик дубля менший
 * зло, ніж загублена правка.
 */
export async function claimUpdate(updateId: number): Promise<boolean> {
  try {
    await put(`telegram/updates/${updateId}.txt`, '1', {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: 'text/plain',
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already exists/iu.test(message)) return false;
    console.error('telegram.claim.failed', message);
    return true;
  }
}

export async function savePhoto(issue: number, n: number, bytes: Uint8Array): Promise<string> {
  const blob = await put(`edits/${issue}/${n}.jpg`, Buffer.from(bytes), {
    access: 'public',
    contentType: 'image/jpeg',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}
