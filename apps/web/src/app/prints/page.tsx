import type { Metadata } from 'next';
import Link from 'next/link';
import { PrintListDto } from '@dt/contracts';
import { PublicShell } from '@/components/public-shell';
import { PrintGrid } from '@/features/home/print-card';
import { plural } from '@/features/home/blocks';
import { serverFetchOrNull } from '@/lib/server-api';
import { site } from '@/config/site';

export const revalidate = 60;

export const metadata: Metadata = {
  title: `Усі принти — ${site.brand}`,
  description: `Каталог принтів із собаками на футболках, худі та світшотах. Друкуємо ${site.cityIn}.`,
  alternates: { canonical: '/prints' },
};

const PER_PAGE = 24;

interface Search { searchParams?: { page?: string } }

export default async function PrintsPage({ searchParams }: Search) {
  const page = Math.max(1, Number(searchParams?.page ?? 1) || 1);
  const data = await serverFetchOrNull(`/catalog/prints?page=${page}&perPage=${PER_PAGE}`, PrintListDto);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-6 py-12">
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
            <div className="rounded-card border border-dashed border-line-strong bg-surface-sunken p-8 text-center">
              <p className="font-medium text-ink">Каталог ще наповнюється</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
                Поки що працюємо під замовлення — намалюємо принт із фото вашої собаки.
              </p>
              <Link
                href="/svoya-ideya"
                className="mt-5 inline-flex min-h-11 items-center rounded-card bg-accent px-5 text-sm font-semibold text-white"
              >
                Замовити свій принт
              </Link>
            </div>
          )}
        </div>

        {/* Пагінація посиланнями, а не кнопками: сторінки мають індексуватись. */}
        {pages > 1 && (
          <nav aria-label="Сторінки каталогу" className="mt-10 flex items-center justify-between text-sm">
            {page > 1 ? (
              <Link href={`/prints?page=${page - 1}`} className="min-h-11 rounded-card border border-line px-4 py-2.5 text-ink hover:border-ink">
                ← Назад
              </Link>
            ) : <span />}
            <span className="text-ink-muted">Сторінка {page} з {pages}</span>
            {page < pages ? (
              <Link href={`/prints?page=${page + 1}`} className="min-h-11 rounded-card border border-line px-4 py-2.5 text-ink hover:border-ink">
                Далі →
              </Link>
            ) : <span />}
          </nav>
        )}
      </div>
    </PublicShell>
  );
}
