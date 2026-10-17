import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public-shell';
import { ButtonLink } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Сторінку не знайдено — БАБАКА',
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
      {/*
        Пес-дудл із лого замість сірої коробки, і дві дії замість трьох
        рівнозначних (аудит 17.10, U11; текст — C-26 з аудиту текстів).
      */}
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-dog.svg" alt="" aria-hidden draggable={false} className="h-24 w-auto" />
        <p className="sticker mt-6">404</p>
        <h1 className="mt-5 font-display text-3xl font-bold text-ink">
          Такої сторінки <span className="wave-underline">немає</span>
        </h1>
        <p className="mt-4 text-ink-muted">
          Схоже, хтось погриз посилання. Почни звідси:
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/prints" size="lg">
            Усі принти
          </ButtonLink>
          <ButtonLink href="/" variant="outline" size="lg">
            На головну
          </ButtonLink>
        </div>
        <Link href="/svoya-ideya" className="link-brand mt-6 text-sm">Свій принт із фото →</Link>
      </div>
    </PublicShell>
  );
}
