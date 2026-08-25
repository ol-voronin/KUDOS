import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import {
  MAX_PRINT_IMAGE_BYTES, MAX_PRINT_IMAGES, PRINT_IMAGE_CONTENT_TYPES,
} from '@dt/contracts';
import { getServerSession } from '@/features/auth/session';

/**
 * Видача токена на завантаження фото у сховище.
 *
 * Чому файл не йде через наш API. У Vercel тіло запиту до функції обмежене
 * 4.5 МБ — фото з телефона регулярно більше. Тому браузер вантажить файл
 * прямо у Vercel Blob, а цей маршрут лише каже сховищу «цій людині можна»:
 * перевіряє сесію адміна, дозволені типи й розмір.
 *
 * Токен короткоживучий і виданий під конкретний файл — навіть якщо він
 * витече, ним не можна залити щось стороннє.
 *
 * `onUploadCompleted` тут свідомо порожній: він вимагає публічної адреси й не
 * працює локально. Прив'язку фото до принта робить сама адмінка, викликаючи
 * `POST /admin/prints/:id/images` після того, як завантаження завершилось.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ message: 'Потрібен вхід в адмінку' }, { status: 401 });
  }

  // `handleUpload` підписує клієнтський токен read-write токеном сховища і
  // на OIDC не переходить — на відміну від решти SDK. Тому цей токен має
  // лишатись живим; кнопка «Revoke Token» у Vercel зламає завантаження.
  if (!process.env['BLOB_READ_WRITE_TOKEN']) {
    return NextResponse.json(
      {
        message: 'Сховище фото не налаштоване: немає BLOB_READ_WRITE_TOKEN. '
          + 'Vercel -> Storage -> Blob -> Connect to Project.',
      },
      { status: 503 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [...PRINT_IMAGE_CONTENT_TYPES],
        maximumSizeInBytes: MAX_PRINT_IMAGE_BYTES,
        // Двоє людей можуть завантажити «photo.jpg» — без суфікса другий
        // перезаписав би перший.
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ admin: session.email, maxPerPrint: MAX_PRINT_IMAGES }),
      }),
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Не вдалося завантажити файл' },
      { status: 400 },
    );
  }
}
