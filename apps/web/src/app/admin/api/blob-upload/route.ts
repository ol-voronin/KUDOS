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
 * прямо у Vercel Blob, а цей маршрут лише каже сховищу «цій людині можна».
 *
 * `handleUpload` обслуговує ДВІ різні події на одній адресі, і плутати їх не
 * можна:
 *
 *   blob.generate-client-token — приходить із браузера адміністратора.
 *     Ось тут потрібна перевірка сесії: інакше токен на запис у сховище
 *     видавався б будь-кому, хто знає адресу.
 *
 *   blob.upload-completed — приходить від самого сховища, сервер до сервера,
 *     коли файл долетів. У цього запиту немає й не може бути cookie адміна.
 *     Перевіряти тут сесію означає гарантовано відповісти 401 — а для сховища
 *     це «завантаження не підтверджене», і воно тримає запит браузера
 *     відкритим. Саме так виглядає нескінченне «Завантажуємо 1 з 1…».
 *     Автентичність цієї події перевіряє сам `handleUpload` за підписом
 *     токена, тому власна перевірка тут не потрібна й шкідлива.
 */
export async function POST(request: Request): Promise<NextResponse> {
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

  if (body.type === 'blob.generate-client-token') {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ message: 'Потрібен вхід в адмінку' }, { status: 401 });
    }
  }

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
        tokenPayload: JSON.stringify({ maxPerPrint: MAX_PRINT_IMAGES }),
      }),
      // Прив'язку фото до принта робить сама адмінка одразу після того, як
      // завантаження завершилось. Тут лишається порожньо навмисно — але сам
      // обробник має відповісти 200, інакше сховище вважатиме файл невдалим.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(result);
  } catch (error) {
    // Помилку видно і в браузері, і в логах Vercel — інакше причина зависання
    // лишається невідомою обом сторонам.
    console.error('blob-upload failed', { type: body.type, error });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Не вдалося завантажити файл' },
      { status: 400 },
    );
  }
}
