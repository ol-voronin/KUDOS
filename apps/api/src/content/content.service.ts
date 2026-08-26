import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AnyBlock, ErrorCode, type PageDto, type PageKind, type PageListDto, type RedirectDto } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';

/** Рядок версії так, як його віддає Prisma. Виноситься, щоб не повторювати select. */
const VERSION_SELECT = {
  title: true, excerpt: true, coverUrl: true,
  seoTitle: true, seoDescription: true, noindex: true,
  blocks: true,
} as const;

@Injectable()
export class ContentService {
  private readonly log = new Logger(ContentService.name);

  constructor(private readonly prisma: PrismaService) {}

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
        slug: true, kind: true, locale: true, publishedAt: true,
        versions: { where: { status: 'PUBLISHED' }, take: 1, select: VERSION_SELECT },
      },
    });

    const version = page?.versions[0];
    if (!page || !version) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Сторінку не знайдено' });
    }

    return {
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
      blocks: this.parseBlocks(version.blocks, page.slug),
    };
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

  /** Список опублікованих сторінок: стрічка матеріалів і карта сайту. */
  async listPages(kind?: PageKind): Promise<PageListDto> {
    const rows = await this.prisma.db.page.findMany({
      where: {
        locale: 'UK',
        ...(kind ? { kind } : {}),
        versions: { some: { status: 'PUBLISHED' } },
      },
      orderBy: [{ publishedAt: 'desc' }, { position: 'asc' }],
      select: {
        slug: true, kind: true, publishedAt: true, updatedAt: true,
        versions: {
          where: { status: 'PUBLISHED' }, take: 1,
          select: { title: true, excerpt: true, coverUrl: true },
        },
      },
    });

    return {
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
        }];
      }),
    };
  }
}
