import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public-shell';
import { ButtonLink } from '@/components/ui';

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
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-24 text-center">
        <p className="font-display text-sm font-bold uppercase tracking-wide text-ink-subtle">404</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink">Такої сторінки немає</h1>
        <p className="mt-4 text-ink-muted">
          Можливо, посилання застаріло. Ось звідки точно можна почати.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/prints" size="lg">
            Усі принти
          </ButtonLink>
          <ButtonLink href="/svoya-ideya" variant="outline" size="lg">
            Свій принт із фото
          </ButtonLink>
          <ButtonLink href="/" variant="quiet" size="lg">
            На головну
          </ButtonLink>
        </div>
      </div>
    </PublicShell>
  );
}
