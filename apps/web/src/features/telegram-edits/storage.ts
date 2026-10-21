import { list, put } from '@vercel/blob';

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

const CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  ogg: 'audio/ogg', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', webm: 'audio/webm', mp4: 'video/mp4',
};

/** Фото чи голосове з правки: `edits/<issue>/<msg>.<ext>`. */
export async function saveMedia(issue: number, n: number, ext: string, bytes: Uint8Array): Promise<string> {
  const blob = await put(`edits/${issue}/${n}.${ext}`, Buffer.from(bytes), {
    access: 'public',
    contentType: CONTENT_TYPE[ext] ?? 'application/octet-stream',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}

/**
 * Альбом: Telegram шле кожне фото окремим оновленням, часто майже
 * одночасно. Перше, хто записав замок, вирішує, куди йде альбом (нова issue
 * чи наявна), і записує номер; решта чекають номер і дописують туди ж.
 */
export const albumTiming = { settleMs: 4000, pollMs: 700, pollTries: 25 };

export function sleep(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));
}

export async function claimAlbum(group: string): Promise<boolean> {
  try {
    await put(`telegram/groups/${group}/lock.txt`, '1', {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: 'text/plain',
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already exists/iu.test(message)) return false;
    // Blob недоступний — краще друга issue, ніж загублене фото.
    console.error('telegram.album.claim_failed', message);
    return true;
  }
}

export async function setAlbumIssue(group: string, issue: number): Promise<void> {
  await put(`telegram/groups/${group}/issue-${issue}.txt`, '1', {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'text/plain',
  });
}

/** Номер issue альбому; null — так і не дочекались. */
export async function waitAlbumIssue(group: string): Promise<number | null> {
  for (let i = 0; i < albumTiming.pollTries; i += 1) {
    try {
      const { blobs } = await list({ prefix: `telegram/groups/${group}/issue-` });
      for (const blob of blobs) {
        const n = /issue-(\d+)\.txt$/u.exec(blob.pathname)?.[1];
        if (n !== undefined) return Number(n);
      }
    } catch (error) {
      console.error('telegram.album.list_failed', error instanceof Error ? error.message : String(error));
    }
    await sleep(albumTiming.pollMs);
  }
  return null;
}
