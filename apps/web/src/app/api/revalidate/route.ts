import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

/**
 * Скидання кешу сторінок. Кличе API після публікації.
 *
 * Три речі, які тут неочевидні.
 *
 * Секрет обовʼязковий, і якщо його не налаштували — ендпоінт закритий, а не
 * відкритий. Ендпоінт, який скидає кеш будь-кому, це безкоштовний спосіб
 * покласти сайт: досить смикати його по колу, і кожен запит перебудовує
 * сторінку заново.
 *
 * Порівняння секретів — посимвольне по всій довжині, без раннього виходу.
 * Різниця в часі відповіді на «перший символ не той» і «останній не той»
 * достатня, щоб підбирати секрет по одному символу.
 *
 * Шляхи перевіряються: приймаємо тільки те, що починається зі слеша й не
 * містить `..`. Інакше формально можна попросити перебудувати що завгодно.
 *
 * Окремий випадок — `*`: скинути весь сайт. Він потрібен рівно для одного —
 * зміни налаштувань: телефон стоїть у футері кожної сторінки й у текстах
 * половини з них, і перелічити «які саме сторінки залежать від телефону»
 * неможливо. Просити скидання по одній сторінці тут означало б гарантовано
 * забути якусь.
 */

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: Request) {
  const secret = process.env['REVALIDATE_SECRET'];
  if (!secret) {
    return NextResponse.json({ error: 'REVALIDATE_SECRET не налаштовано' }, { status: 503 });
  }

  const provided = request.headers.get('x-revalidate-secret') ?? '';
  if (!safeEqual(provided, secret)) {
    return NextResponse.json({ error: 'Невірний секрет' }, { status: 401 });
  }

  let paths: unknown;
  try {
    paths = ((await request.json()) as { paths?: unknown }).paths;
  } catch {
    return NextResponse.json({ error: 'Тіло не є JSON' }, { status: 400 });
  }

  if (!Array.isArray(paths) || paths.length === 0 || paths.length > 50) {
    return NextResponse.json({ error: 'Очікується paths: масив від 1 до 50 шляхів' }, { status: 400 });
  }

  if (paths.includes('*')) {
    revalidatePath('/', 'layout');
    return NextResponse.json({ ok: true, revalidated: ['*'] });
  }

  const clean = paths.filter(
    (p): p is string => typeof p === 'string' && p.startsWith('/') && !p.includes('..') && p.length < 300,
  );
  if (clean.length === 0) {
    return NextResponse.json({ error: 'Жоден шлях не пройшов перевірку' }, { status: 400 });
  }

  for (const path of clean) revalidatePath(path);
  return NextResponse.json({ ok: true, revalidated: clean });
}
