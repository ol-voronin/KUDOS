import { NextResponse } from 'next/server';
import { del, put } from '@vercel/blob';
import { MAX_UPLOAD_BYTES, MEDIA_CONTENT_TYPES } from '@dt/contracts';
import { getServerSession } from '@/features/auth/session';

/**
 * Сховище медіатеки.
 *
 * Живе у вебзастосунку з тієї самої причини, що й фото принтів: токен
 * `BLOB_READ_WRITE_TOKEN` Vercel видав лише проєкту `kudos-web`. API
 * лишається власником даних, сюди приходять байти — звідси йде адреса.
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

  const contentType = request.headers.get('content-type') ?? '';
  if (!MEDIA_CONTENT_TYPES.includes(contentType as never)) {
    return NextResponse.json({ message: `Формат ${contentType || 'невідомий'} не приймаємо` }, { status: 400 });
  }

  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length === 0) return NextResponse.json({ message: 'Порожній файл' }, { status: 400 });
  if (bytes.length > MAX_UPLOAD_BYTES) return NextResponse.json({ message: 'Файл завеликий' }, { status: 413 });

  const filename = safeName(new URL(request.url).searchParams.get('filename'));

  try {
    const blob = await put(`media/${filename}`, bytes, {
      access: 'public',
      contentType,
      // Дві людини можуть залити «photo.webp» — без суфікса друга перезаписала б першу.
      addRandomSuffix: true,
      token,
    });
    return NextResponse.json({
      url: blob.url, pathname: blob.pathname, filename, mimeType: contentType, bytes: bytes.length,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('media.put.failed', detail);
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
    // Рядок у базі вже зник. Файл-сирота коштує копійки й нікому не заважає —
    // валити через нього інтерфейс безглуздо.
    console.error('media.del.failed', pathname, error);
    return NextResponse.json({ ok: true, orphaned: true });
  }
}

function safeName(raw: string | null): string {
  const cleaned = (raw ?? 'image').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, MAX_FILENAME);
  return cleaned || 'image';
}
