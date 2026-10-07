import { NextResponse, type NextRequest } from 'next/server';
import { isPreviewDeploy, PREVIEW_READ_ONLY_MESSAGE } from '@/lib/deploy-env';

/**
 * Превʼю — тільки на читання.
 *
 * Браузер ходить в API через переписування `/api/*` на продовий API, тож без
 * цього фільтра кнопка «Замовити» на превʼю створила б справжнє замовлення
 * й відкрила б справжню оплату Monobank, а форма заявки — справжній лід.
 * Відрізаємо все, що не GET, ще до переписування.
 *
 * Виняток один — розрахунок кошика: це POST лише за формою, він нічого не
 * записує, а без нього кошик на превʼю порожній і верстку не перевіриш.
 *
 * У проді middleware одразу пропускає запит далі.
 */
const READ_ONLY_POSTS = new Set(['/api/v1/cart/quote']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function middleware(request: NextRequest) {
  if (!isPreviewDeploy()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (SAFE_METHODS.has(request.method) || READ_ONLY_POSTS.has(pathname)) {
    return NextResponse.next();
  }

  // Форма ApiErrorDto — щоб форма на сторінці показала текст, а не «щось пішло не так».
  return NextResponse.json(
    { statusCode: 403, code: 'PREVIEW_READ_ONLY', message: PREVIEW_READ_ONLY_MESSAGE, correlationId: 'preview' },
    { status: 403 },
  );
}

export const config = { matcher: '/api/v1/:path*' };
