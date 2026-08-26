import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public-shell';

export const metadata: Metadata = {
  title: 'Сторінку не знайдено',
  robots: { index: false, follow: true },
};

/**
 * 404.
 *
 * До цього її не було, і Next малював свою типову — чорний екран із
 * англійським написом. Для покупця це виглядає як зламаний сайт, а не як
 * «ви перейшли за старим посиланням».
 *
 * `follow: true` при `noindex` навмисно: сторінку в індекс не пускаємо, але
 * посиланням із неї дозволяємо вести далі — інакше людина, яка сюди
 * потрапила, для пошуку опиняється в глухому куті.
 */
export default function NotFound() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="font-display text-sm font-bold uppercase tracking-wide text-ink-subtle">404</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink">Такої сторінки немає</h1>
        <p className="mt-4 text-ink-muted">
          Можливо, посилання застаріло. Ось звідки точно можна почати.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/prints" className="flex min-h-12 items-center rounded-card bg-accent px-6 text-sm font-semibold text-white">
            Усі принти
          </Link>
          <Link href="/svoya-ideya" className="flex min-h-12 items-center rounded-card border border-ink px-6 text-sm font-medium text-ink">
            Свій принт із фото
          </Link>
          <Link href="/" className="flex min-h-12 items-center rounded-card border border-line px-6 text-sm font-medium text-ink-muted">
            На головну
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
