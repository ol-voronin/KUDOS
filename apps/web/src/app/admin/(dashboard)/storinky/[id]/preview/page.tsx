import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPreviewDto } from '@dt/contracts';
import { BlockRenderer } from '@/features/content/block-renderer';
import { adminServerFetch } from '@/lib/admin-server-api';

export const metadata: Metadata = { title: 'Перегляд · адмін', robots: { index: false, follow: false } };

/**
 * Перегляд чернетки.
 *
 * Малюється тим самим `BlockRenderer`, що й публічна сторінка — інакше
 * перегляд показував би схоже, а не те саме, і довіряти йому було б не
 * можна. Саме тому він живе всередині адмінки: динамічні блоки тут —
 * серверні компоненти, і зібрати їх на клієнті неможливо.
 *
 * Шапки й футера сайту тут немає навмисно: у перегляді дивляться на вміст,
 * а меню на всіх сторінках однакове.
 *
 * Дані беруться окремим ендпоінтом, а не з форми редактора: у перегляді
 * підстановки вже зроблені — там, де в редакторі стоїть `{{phone}}`, тут
 * справжній номер. Це і є різниця між «джерелом» і «тим, що надрукується».
 */
export default async function PreviewPage({ params }: { params: { id: string } }) {
  const preview = await adminServerFetch(`/admin/content/pages/${params.id}/preview`, AdminPreviewDto);
  if (!preview) notFound();

  return (
    <div className="-mx-8 -my-10">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-ink px-8 py-3 text-surface">
        <span className="font-display text-sm font-bold">
          {preview.isDraft ? 'Чернетка' : 'Опублікована версія'}
        </span>
        <span className="text-sm opacity-80">{preview.title}</span>
        <Link
          href={`/admin/storinky/${params.id}`}
          className="ml-auto rounded-card border border-surface/40 px-3 py-1 text-sm font-medium hover:bg-surface/10"
        >
          ← До редагування
        </Link>
      </div>

      {preview.blocks.length === 0 ? (
        <p className="px-8 py-12 text-ink-muted">Сторінка порожня — додайте блоки.</p>
      ) : (
        <BlockRenderer blocks={preview.blocks} />
      )}
    </div>
  );
}
