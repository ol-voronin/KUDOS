import type {
  ArticleListBlock, BreedStripBlock, CollectionStripBlock, LeadFormBlock, PrintGridBlock,
} from '@dt/contracts';
import {
  BreedListDto, BreedPageDto, CollectionListDto, CollectionPageDto, HomeDto, PageListDto, PrintListDto,
  type PrintCardDto,
} from '@dt/contracts';
import { ArticleGrid } from '@/features/articles/article-card';
import { PublicLeadForm } from '@/features/leads/public-lead-form';
import { BreedStrip, CollectionStrip } from '@/features/home/blocks';
import { PrintGrid, SectionHead } from '@/features/home/print-card';
import { serverFetchOrNull } from '@/lib/server-api';
import { InlineParagraph } from '../inline';

/**
 * Динамічні блоки: вміст беруть із каталогу в момент рендеру.
 *
 * Це серверні компоненти, і кожен ходить по свої дані сам. Виглядає як N+1,
 * але тут це навмисно: інакше сторінка мусила б заздалегідь знати, які блоки
 * на ній стоять, і збирати їхні дані одним запитом — тобто рендер сторінки
 * знову залежав би від переліку типів блоків, який ми щойно винесли в
 * реєстр. Блоків на сторінці одиниці, відповіді кешуються на хвилину,
 * ціна цієї свободи — кілька запитів на холодний рендер.
 *
 * Кожен блок падає тихо. Порожня сітка принтів гірша за відсутню, але обидва
 * варіанти незрівнянно кращі за 500 на всій сторінці через те, що каталог
 * на секунду відповів помилкою.
 */

async function loadPrints(block: PrintGridBlock): Promise<readonly PrintCardDto[]> {
  // «Готові до відправки» — не фільтр каталогу, а зріз, який уже рахує API
  // для головної: принти на виробах, що фізично є на складі.
  if (block.source === 'ready') {
    const data = await serverFetchOrNull('/catalog/home', HomeDto);
    return data?.readyToShip ?? [];
  }
  if (block.source === 'collection' && block.sourceSlug !== '') {
    const data = await serverFetchOrNull(`/catalog/collections/${block.sourceSlug}`, CollectionPageDto);
    return data?.prints ?? [];
  }
  if (block.source === 'breed' && block.sourceSlug !== '') {
    const data = await serverFetchOrNull(`/catalog/breeds/${block.sourceSlug}`, BreedPageDto);
    return data?.prints ?? [];
  }
  const data = await serverFetchOrNull(`/catalog/prints?page=1&perPage=${block.limit}`, PrintListDto);
  return data?.items ?? [];
}

export async function PrintGridBlockView({ block }: { block: PrintGridBlock }) {
  const prints = (await loadPrints(block)).slice(0, block.limit);
  if (prints.length === 0) return null;
  return (
    <>
      {(block.heading !== '' || block.moreHref !== '') && (
        <SectionHead
          title={block.heading}
          {...(block.moreHref !== '' ? { href: block.moreHref } : {})}
        />
      )}
      <PrintGrid prints={prints} />
    </>
  );
}

/**
 * Останні матеріали на будь-якій сторінці.
 *
 * Блок ядра: ходить лише в перелік сторінок і нічого не знає про каталог.
 * Порожня стрічка не малюється зовсім — заголовок «Статті» над порожнечею
 * читається як зламаний сайт.
 */
export async function ArticleListBlockView({ block }: { block: ArticleListBlock }) {
  const data = await serverFetchOrNull(`/content/pages?kind=ARTICLE&limit=${block.limit}`, PageListDto);
  const articles = (data?.items ?? []).slice(0, block.limit);
  if (articles.length === 0) return null;

  return (
    <>
      {(block.heading !== '' || block.moreHref !== '') && (
        <SectionHead
          title={block.heading}
          {...(block.moreHref !== '' ? { href: block.moreHref } : {})}
        />
      )}
      {block.lead !== '' && <InlineParagraph text={block.lead} className="mb-6 max-w-prose text-ink-muted" />}
      <ArticleGrid articles={articles} />
    </>
  );
}

export async function BreedStripBlockView({ block }: { block: BreedStripBlock }) {
  const data = await serverFetchOrNull('/catalog/breeds', BreedListDto);
  const breeds = (data?.items ?? []).slice(0, block.limit);
  if (breeds.length === 0) return null;
  return (
    <>
      {block.heading !== '' && <SectionHead title={block.heading} href="/breeds" />}
      <BreedStrip breeds={breeds} />
    </>
  );
}

export async function CollectionStripBlockView({ block }: { block: CollectionStripBlock }) {
  const data = await serverFetchOrNull('/catalog/collections', CollectionListDto);
  const collections = (data?.items ?? []).slice(0, block.limit);
  if (collections.length === 0) return null;
  return (
    <>
      {block.heading !== '' && <SectionHead title={block.heading} href="/collections" />}
      <CollectionStrip collections={collections} />
    </>
  );
}

/** Форма заявки. Клієнтський компонент усередині серверного — це нормально. */
export function LeadFormBlockView({ block }: { block: LeadFormBlock }) {
  return (
    <div className="grid gap-10 rounded-card border border-line bg-surface p-6 sm:p-10 lg:grid-cols-[1fr_minmax(0,24rem)]">
      <div>
        <h2 className="font-display text-2xl font-bold text-ink">{block.heading}</h2>
        <InlineParagraph text={block.text} className="mt-3 max-w-prose leading-relaxed text-ink-muted" />
      </div>
      <PublicLeadForm source={block.source} compact />
    </div>
  );
}
