import type { Metadata } from 'next';
import Link from 'next/link';
import { PrintListDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { PrintGrid } from '@/features/home/print-card';
import { plural } from '@/features/home/blocks';
import { serverFetchOrNull } from '@/lib/server-api';
import { getSettings } from '@/lib/site-settings';
import { ButtonLink, EmptyState } from '@/components/ui';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  return {
    title: `Усі принти — ${site.brand}`,
    description: `Каталог принтів із собаками на футболках, худі та світшотах. Друкуємо ${site.cityIn}.`,
    alternates: { canonical: '/prints' },
  
  };
}

const PER_PAGE = 24;

interface Search { searchParams?: { page?: string } }

export default async function PrintsPage({ searchParams }: Search) {
  const page = Math.max(1, Number(searchParams?.page ?? 1) || 1);
  const data = await serverFetchOrNull(`/catalog/prints?page=${page}&perPage=${PER_PAGE}`, PrintListDto);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <nav aria-label="Хлібні крихти" className="text-sm text-ink-muted">
          <Link href="/" className="hover:underline">Головна</Link>
          <span className="px-1.5">·</span>
          <span className="text-ink">Усі принти</span>
        </nav>

        <h1 className="mt-3 font-display text-hero font-bold text-ink">Усі принти</h1>
        {data && data.total > 0 && (
          <p className="mt-3 text-lg text-ink-muted">
            {data.total} {plural(data.total, 'принт', 'принти', 'принтів')} у каталозі
          </p>
        )}

        <div className="mt-10">
          {data && data.items.length > 0 ? (
            <PrintGrid prints={data.items} />
          ) : (
            <EmptyState
              title="Каталог ще наповнюється"
              hint="Поки що працюємо під замовлення — намалюємо принт із фото вашої собаки."
              action={<ButtonLink href="/svoya-ideya">Замовити свій принт</ButtonLink>}
            />
          )}
        </div>

        {/* Пагінація посиланнями, а не кнопками: сторінки мають індексуватись. */}
        {pages > 1 && (
          <nav aria-label="Сторінки каталогу" className="mt-10 flex items-center justify-between text-sm">
            {page > 1 ? (
              <ButtonLink href={`/prints?page=${page - 1}`} variant="quiet">
                ← Назад
              </ButtonLink>
            ) : <span />}
            <span className="text-ink-muted">Сторінка {page} з {pages}</span>
            {page < pages ? (
              <ButtonLink href={`/prints?page=${page + 1}`} variant="quiet">
                Далі →
              </ButtonLink>
            ) : <span />}
          </nav>
        )}
      </div>
    </PublicShell>
  );
}
