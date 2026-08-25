import { NextResponse } from 'next/server';
import { del, put } from '@vercel/blob';
import {
  MAX_UPLOAD_BYTES, PRINT_IMAGE_CONTENT_TYPES, SLUG_PATTERN,
} from '@dt/contracts';
import { getServerSession } from '@/features/auth/session';

/**
 * Робота зі сховищем фото.
 *
 * Чому саме тут, а не в API. Vercel видав `BLOB_READ_WRITE_TOKEN` лише
 * проєкту `kudos-web`; `kudos-api` підключений до сховища в режимі OIDC і
 * токена не має, тому `put()` звідти відмовляє. Токен існує в одному місці —
 * значить і робота з файлами живе в одному місці.
 *
 * Розподіл обовʼязків від цього не постраждав: сховище тримає файли, API
 * лишається власником даних. Сюди приходять байти, звідси йде адреса.
 *
 * І це серверний виклик, не браузерний: у Blob API немає CORS для браузера —
 * саме на цьому впала перша версія, яка вантажила файл напряму з клієнта.
 */

const MAX_FILENAME = 80;

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ message: 'Потрібен вхід в адмінку' }, { status: 401 });

  const token = process.env['BLOB_READ_WRITE_TOKEN'];
  if (!token) {
    return NextResponse.json(
      { message: 'Сховище не налаштоване: у проєкті немає BLOB_READ_WRITE_TOKEN' },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug') ?? '';
  if (!SLUG_PATTERN.test(slug)) {
    return NextResponse.json({ message: 'Некоректна адреса принта' }, { status: 400 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!PRINT_IMAGE_CONTENT_TYPES.includes(contentType as never)) {
    return NextResponse.json({ message: `Формат ${contentType} не приймаємо` }, { status: 400 });
  }

  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length === 0) {
    return NextResponse.json({ message: 'Порожній файл' }, { status: 400 });
  }
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ message: 'Файл завеликий' }, { status: 413 });
  }

  try {
    const blob = await put(`prints/${slug}/${safeName(searchParams.get('filename'))}`, bytes, {
      access: 'public',
      contentType,
      // Двоє фото можуть називатись «photo.jpg» — без суфікса друге
      // перезаписало б перше.
      addRandomSuffix: true,
      token,
    });
    return NextResponse.json({ url: blob.url, pathname: blob.pathname });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('blob.put.failed', detail);
    // Текст помилки віддаємо адміністраторові: маршрут закритий сесією, а
    // загальне «не вдалося» вже коштувало кількох кіл листування наосліп.
    return NextResponse.json({ message: `Сховище не прийняло файл: ${detail}` }, { status: 502 });
  }
}

/** Прибирає файл після того, як API видалив рядок. */
export async function DELETE(request: Request): Promise<NextResponse> {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ message: 'Потрібен вхід в адмінку' }, { status: 401 });

  const token = process.env['BLOB_READ_WRITE_TOKEN'];
  const pathname = new URL(request.url).searchParams.get('pathname');
  if (!pathname) return NextResponse.json({ message: 'Немає pathname' }, { status: 400 });
  if (!token) return NextResponse.json({ ok: true, skipped: true });

  try {
    await del(pathname, { token });
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Рядок у базі вже видалено, картка оновилась. Осиротілий файл коштує
    // копійки — валити через нього інтерфейс безглуздо.
    console.error('blob.del.failed', pathname, error);
    return NextResponse.json({ ok: true, orphaned: true });
  }
}

function safeName(raw: string | null): string {
  const cleaned = (raw ?? 'photo').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, MAX_FILENAME);
  return cleaned || 'photo';
}
