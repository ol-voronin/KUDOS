import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AnyBlock, ErrorCode, substituteTokens,
  type LinkedTerm, type PageDto, type PageKind, type PageListDto, type RedirectDto,
} from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { readingMinutes } from './reading-time';
import { SettingsService } from './settings.service';

/**
 * Підстановка `{{токенів}}` у всьому, що поїде на сайт.
 *
 * Робиться тут, на сервері, а не в браузері — і це рішення, а не деталь.
 * Поки таблиця значень жила у вебі, вона була другою копією реквізитів:
 * телефон у базі один, у `config/site.ts` інший, і розходяться вони тихо.
 * Тепер сторінка приїжджає вже з реальним телефоном, а у вебі немає ані
 * таблиці токенів, ані самих реквізитів.
 *
 * Ходимо по всіх рядках, включно з адресами: `{{telegramUrl}}` у посиланні —
 * законний і найкорисніший випадок.
 */
function substituteDeep<T>(value: T, tokens: Readonly<Record<string, string>>): T {
  if (typeof value === 'string') return substituteTokens(value, tokens) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => substituteDeep(v, tokens)) as unknown as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = substituteDeep(v, tokens);
    return out as T;
  }
  return value;
}

/** Рядок версії так, як його віддає Prisma. Виноситься, щоб не повторювати select. */
const VERSION_SELECT = {
  title: true, excerpt: true, coverUrl: true,
  seoTitle: true, seoDescription: true, noindex: true,
  blocks: true,
} as const;

/** Породи й колекції матеріалу. Виноситься, щоб список і сторінка збиралися однаково. */
const TERMS_SELECT = {
  breeds: { select: { breed: { select: { slug: true, name: true } } } },
  collections: { select: { collection: { select: { slug: true, title: true } } } },
} as const;

interface TermRows {
  breeds: Array<{ breed: { slug: string; name: string } }>;
  collections: Array<{ collection: { slug: string; title: string } }>;
}

function terms(row: TermRows): { breeds: LinkedTerm[]; collections: LinkedTerm[] } {
  return {
    breeds: row.breeds.map((b) => ({ slug: b.breed.slug, name: b.breed.name })),
    collections: row.collections.map((c) => ({ slug: c.collection.slug, name: c.collection.title })),
  };
}

@Injectable()
export class ContentService {
  private readonly log = new Logger(ContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Розбір блоків, збережених у JSONB.
   *
   * Валідуємо не лише на запису, а й на читанні — і поблочно, а не масивом
   * цілком. Причина конкретна: колись у блоці перейменується поле, і в базі
   * лишиться десяток записів старого покоління. Якщо перевіряти масив
   * цілком, один такий блок обвалить `safeParse` і сторінка стане порожньою —
   * тобто дрібна невідповідність у даних вимкне цілий документ. Поблочний
   * розбір вимикає рівно зіпсований блок, лишає решту сторінки живою й
   * пише в лог, який саме блок випав.
   *
   * Мовчати про це не можна: невидимий випалий блок — це текст, який автор
   * написав, а покупець не побачив.
   */
  private parseBlocks(raw: unknown, slug: string): PageDto['blocks'] {
    if (!Array.isArray(raw)) {
      this.log.error(`Сторінка ${slug}: blocks не масив — показую порожню сторінку`);
      return [];
    }
    const good: PageDto['blocks'] = [];
    for (const [index, item] of raw.entries()) {
      const parsed = AnyBlock.safeParse(item);
      if (parsed.success) { good.push(parsed.data); continue; }
      const type = typeof item === 'object' && item !== null && 'type' in item ? String(item.type) : '?';
      this.log.error(`Сторінка ${slug}: блок ${index} (${type}) не проходить схему — пропущено. ${parsed.error.message}`);
    }
    return good;
  }

  async getPage(slug: string): Promise<PageDto> {
    const page = await this.prisma.db.page.findFirst({
      where: { slug, locale: 'UK', versions: { some: { status: 'PUBLISHED' } } },
      select: {
        slug: true, kind: true, locale: true, publishedAt: true, updatedAt: true,
        versions: { where: { status: 'PUBLISHED' }, take: 1, select: VERSION_SELECT },
        ...TERMS_SELECT,
      },
    });

    const version = page?.versions[0];
    if (!page || !version) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Сторінку не знайдено' });
    }

    const blocks = this.parseBlocks(version.blocks, page.slug);
    const tokens = await this.settings.tokens();

    return substituteDeep({
      slug: page.slug,
      kind: page.kind,
      locale: page.locale,
      title: version.title,
      excerpt: version.excerpt,
      coverUrl: version.coverUrl,
      seo: {
        title: version.seoTitle,
        description: version.seoDescription,
        noindex: version.noindex,
      },
      publishedAt: page.publishedAt?.toISOString() ?? null,
      updatedAt: page.updatedAt.toISOString(),
      readingMinutes: readingMinutes(blocks),
      ...terms(page),
      blocks,
    }, tokens);
  }

  /**
   * Куди вести зі старої адреси.
   *
   * Окремий запит, і робиться він лише тоді, коли сторінки не знайшлося —
   * тобто на щасливому шляху не коштує нічого. Ланцюжків тут не буває за
   * побудовою: при перейменуванні всі редіректи на стару адресу одразу
   * переписуються на нову.
   */
  async resolveRedirect(slug: string): Promise<RedirectDto> {
    const row = await this.prisma.db.redirect.findFirst({
      where: { locale: 'UK', fromSlug: slug },
      select: { toSlug: true },
    });
    if (!row) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Редіректу немає' });
    return { toSlug: row.toSlug };
  }

  /**
   * Список опублікованих сторінок: стрічка матеріалів, карта сайту, блок
   * «останні статті».
   *
   * Фільтри за породою й колекцією тут же, а не окремим методом: «усі
   * матеріали» й «матеріали про коргі» відрізняються одним `where`, і два
   * методи розійшлися б на першій же зміні полів картки.
   */
  async listPages(options: {
    kind?: PageKind;
    breedSlug?: string;
    collectionSlug?: string;
    limit?: number;
  } = {}): Promise<PageListDto> {
    const rows = await this.prisma.db.page.findMany({
      where: {
        locale: 'UK',
        ...(options.kind ? { kind: options.kind } : {}),
        ...(options.breedSlug ? { breeds: { some: { breed: { slug: options.breedSlug } } } } : {}),
        ...(options.collectionSlug
          ? { collections: { some: { collection: { slug: options.collectionSlug } } } }
          : {}),
        versions: { some: { status: 'PUBLISHED' } },
      },
      orderBy: [{ publishedAt: 'desc' }, { position: 'asc' }],
      ...(options.limit === undefined ? {} : { take: options.limit }),
      select: {
        slug: true, kind: true, publishedAt: true, updatedAt: true,
        versions: {
          where: { status: 'PUBLISHED' }, take: 1,
          select: { title: true, excerpt: true, coverUrl: true, blocks: true },
        },
        ...TERMS_SELECT,
      },
    });

    const tokens = await this.settings.tokens();

    return substituteDeep({
      items: rows.flatMap((p) => {
        const v = p.versions[0];
        return v === undefined ? [] : [{
          slug: p.slug,
          kind: p.kind,
          title: v.title,
          excerpt: v.excerpt,
          coverUrl: v.coverUrl,
          publishedAt: p.publishedAt?.toISOString() ?? null,
          updatedAt: p.updatedAt.toISOString(),
          readingMinutes: readingMinutes(this.parseBlocks(v.blocks, p.slug)),
          ...terms(p),
        }];
      }),
    }, tokens);
  }
}
