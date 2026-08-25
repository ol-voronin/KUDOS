import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BlockList, ErrorCode,
  type AdminDraftSaveDto, type AdminPageCreateDto, type AdminPageDto,
  type AdminPageListDto, type AdminPageSummaryDto, type AdminPageUpdateDto,
  type AdminVersionDto,
} from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { RevalidateService } from './revalidate.service';

/** Версія з автором — рівно те, що читають усі методи нижче. */
const VERSION_SELECT = {
  id: true, number: true, status: true, note: true, createdAt: true,
  title: true, excerpt: true, coverUrl: true,
  seoTitle: true, seoDescription: true, noindex: true, blocks: true,
  author: { select: { email: true } },
} as const;

interface VersionRow {
  id: string; number: number; status: string; note: string; createdAt: Date;
  title: string; excerpt: string; coverUrl: string;
  seoTitle: string; seoDescription: string; noindex: boolean; blocks: unknown;
  author: { email: string } | null;
}

@Injectable()
export class ContentAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidate: RevalidateService,
  ) {}

  // ── читання ───────────────────────────────────────────────────────────────

  private toVersion(row: VersionRow): AdminVersionDto {
    // Блоки з бази проходять схему й тут: у чернетці може лежати запис
    // старого покоління, і редактор має отримати те, що зможе показати.
    const parsed = BlockList.safeParse(row.blocks);
    return {
      id: row.id,
      number: row.number,
      status: row.status as AdminVersionDto['status'],
      note: row.note,
      authorEmail: row.author?.email ?? null,
      createdAt: row.createdAt.toISOString(),
      title: row.title,
      excerpt: row.excerpt,
      coverUrl: row.coverUrl,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      noindex: row.noindex,
      blocks: parsed.success ? parsed.data : [],
    };
  }

  async list(): Promise<AdminPageListDto> {
    const rows = await this.prisma.page.findMany({
      orderBy: [{ kind: 'asc' }, { position: 'asc' }, { slug: 'asc' }],
      select: {
        id: true, slug: true, kind: true, isSystem: true, publishedAt: true,
        updatedAt: true, revalidatedAt: true, revalidateError: true,
        versions: {
          where: { status: { in: ['DRAFT', 'PUBLISHED'] } },
          select: { status: true, title: true },
        },
      },
    });

    return {
      items: rows.map((p): AdminPageSummaryDto => {
        const draft = p.versions.find((v: { status: string }) => v.status === 'DRAFT');
        const published = p.versions.find((v: { status: string }) => v.status === 'PUBLISHED');
        return {
          id: p.id,
          slug: p.slug,
          kind: p.kind,
          isSystem: p.isSystem,
          // Назву показуємо з чернетки: в списку має бути видно те, над чим
          // працюють зараз, а не те, що застигло в публікації місяць тому.
          title: draft?.title ?? published?.title ?? p.slug,
          hasDraft: draft !== undefined,
          isPublished: published !== undefined,
          publishedAt: p.publishedAt?.toISOString() ?? null,
          updatedAt: p.updatedAt.toISOString(),
          revalidatedAt: p.revalidatedAt?.toISOString() ?? null,
          revalidateError: p.revalidateError,
        };
      }),
    };
  }

  async get(id: string): Promise<AdminPageDto> {
    const page = await this.prisma.page.findUnique({
      where: { id },
      select: {
        id: true, slug: true, kind: true, isSystem: true, publishedAt: true,
        updatedAt: true, revalidatedAt: true, revalidateError: true,
        versions: { orderBy: { number: 'desc' }, select: VERSION_SELECT },
      },
    });
    if (!page) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Сторінку не знайдено' });

    const versions = page.versions as VersionRow[];
    const draftRow = versions.find((v) => v.status === 'DRAFT');
    const publishedRow = versions.find((v) => v.status === 'PUBLISHED');
    const draft = draftRow ? this.toVersion(draftRow) : null;
    const published = publishedRow ? this.toVersion(publishedRow) : null;

    return {
      id: page.id,
      slug: page.slug,
      kind: page.kind,
      isSystem: page.isSystem,
      title: draft?.title ?? published?.title ?? page.slug,
      hasDraft: draft !== null,
      isPublished: published !== null,
      publishedAt: page.publishedAt?.toISOString() ?? null,
      updatedAt: page.updatedAt.toISOString(),
      revalidatedAt: page.revalidatedAt?.toISOString() ?? null,
      revalidateError: page.revalidateError,
      draft,
      published,
      history: versions.map((v) => ({
        id: v.id,
        number: v.number,
        status: v.status as AdminVersionDto['status'],
        note: v.note,
        authorEmail: v.author?.email ?? null,
        createdAt: v.createdAt.toISOString(),
      })),
    };
  }

  // ── зміна ─────────────────────────────────────────────────────────────────

  async create(dto: AdminPageCreateDto, authorId: string): Promise<AdminPageDto> {
    const taken = await this.prisma.page.findUnique({
      where: { locale_slug: { locale: 'UK', slug: dto.slug } },
      select: { id: true },
    });
    if (taken) throw new ConflictException({ code: ErrorCode.CONFLICT, message: 'Сторінка з такою адресою вже є' });

    const page = await this.prisma.page.create({
      data: {
        slug: dto.slug, kind: dto.kind, locale: 'UK', isSystem: false,
        versions: {
          create: {
            number: 1, status: 'DRAFT', title: dto.title, blocks: [],
            authorId, note: 'створено',
          },
        },
      },
      select: { id: true },
    });
    return this.get(page.id);
  }

  /**
   * Зміна адреси.
   *
   * Тут два неочевидні кроки. Перший — стара адреса лишається жити редіректом,
   * інакше перейменування стирає позиції в пошуку й ламає всі чужі посилання.
   * Другий — редіректи, які вели на стару адресу, переписуються на нову
   * одразу. Без цього виникає ланцюжок `a → b → c`: браузер його пройде, а
   * пошуковик на другому переході вже втрачає вагу посилання.
   */
  async update(id: string, dto: AdminPageUpdateDto): Promise<AdminPageDto> {
    const page = await this.prisma.page.findUnique({
      where: { id }, select: { id: true, slug: true, isSystem: true },
    });
    if (!page) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Сторінку не знайдено' });

    if (dto.slug !== undefined && dto.slug !== page.slug) {
      if (page.isSystem) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Це системна сторінка: на її адресу посилаються код і документи, змінювати не можна',
        });
      }
      const taken = await this.prisma.page.findUnique({
        where: { locale_slug: { locale: 'UK', slug: dto.slug } }, select: { id: true },
      });
      if (taken) throw new ConflictException({ code: ErrorCode.CONFLICT, message: 'Сторінка з такою адресою вже є' });

      await this.prisma.$transaction([
        this.prisma.redirect.updateMany({ where: { toSlug: page.slug }, data: { toSlug: dto.slug } }),
        this.prisma.redirect.deleteMany({ where: { locale: 'UK', fromSlug: dto.slug } }),
        this.prisma.redirect.create({ data: { locale: 'UK', fromSlug: page.slug, toSlug: dto.slug } }),
        this.prisma.page.update({ where: { id }, data: { slug: dto.slug } }),
      ]);
    }

    if (dto.position !== undefined) {
      await this.prisma.page.update({ where: { id }, data: { position: dto.position } });
    }
    return this.get(id);
  }

  /**
   * Збереження чернетки.
   *
   * Чернетка на сторінку одна — це стереже частковий унікальний індекс. Якщо
   * її ще немає, створюємо з наступним номером; якщо є — перезаписуємо. Нову
   * версію на кожне натискання «зберегти» не робимо навмисно: історія з
   * сорока записами «зберіг через хвилину» непридатна для відкату.
   */
  async saveDraft(id: string, dto: AdminDraftSaveDto, authorId: string): Promise<AdminPageDto> {
    const page = await this.prisma.page.findUnique({
      where: { id },
      select: { id: true, versions: { select: { id: true, number: true, status: true } } },
    });
    if (!page) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Сторінку не знайдено' });

    const draft = page.versions.find((v: { status: string }) => v.status === 'DRAFT');
    const data = {
      title: dto.title, excerpt: dto.excerpt, coverUrl: dto.coverUrl,
      seoTitle: dto.seoTitle, seoDescription: dto.seoDescription, noindex: dto.noindex,
      blocks: dto.blocks, note: dto.note, authorId,
    };

    if (draft) {
      await this.prisma.pageVersion.update({ where: { id: draft.id }, data });
    } else {
      const next = Math.max(0, ...page.versions.map((v: { number: number }) => v.number)) + 1;
      await this.prisma.pageVersion.create({ data: { ...data, pageId: id, number: next, status: 'DRAFT' } });
    }
    return this.get(id);
  }

  /**
   * Публікація.
   *
   * Одна транзакція: чинна опублікована версія йде в архів, чернетка стає
   * опублікованою. Проміжного стану, у якому опублікованих дві або жодної,
   * не існує — і це не домовленість у коді, а частковий унікальний індекс.
   */
  async publish(id: string): Promise<AdminPageDto> {
    const page = await this.prisma.page.findUnique({
      where: { id },
      select: { id: true, slug: true, publishedAt: true, versions: { select: { id: true, status: true } } },
    });
    if (!page) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Сторінку не знайдено' });

    const draft = page.versions.find((v: { status: string }) => v.status === 'DRAFT');
    if (!draft) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Публікувати нема чого: змін після останньої публікації немає',
      });
    }

    await this.prisma.$transaction([
      this.prisma.pageVersion.updateMany({
        where: { pageId: id, status: 'PUBLISHED' }, data: { status: 'ARCHIVED' },
      }),
      this.prisma.pageVersion.update({ where: { id: draft.id }, data: { status: 'PUBLISHED' } }),
      this.prisma.page.update({
        where: { id },
        data: { publishedAt: page.publishedAt ?? new Date() },
      }),
    ]);

    await this.refreshCache(id, page.slug);
    return this.get(id);
  }

  /** Зняти з публікації. Системну сторінку — ніколи. */
  async unpublish(id: string): Promise<AdminPageDto> {
    const page = await this.prisma.page.findUnique({
      where: { id }, select: { id: true, slug: true, isSystem: true },
    });
    if (!page) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Сторінку не знайдено' });
    if (page.isSystem) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Системну сторінку не можна прибрати з сайту',
      });
    }
    await this.prisma.pageVersion.updateMany({
      where: { pageId: id, status: 'PUBLISHED' }, data: { status: 'ARCHIVED' },
    });
    await this.refreshCache(id, page.slug);
    return this.get(id);
  }

  /**
   * Відкат: вміст старої версії лягає в чернетку.
   *
   * Саме в чернетку, а не одразу на сайт. Відкат наосліп — це друга помилка
   * поверх першої; людина має побачити, що саме повертає, і натиснути
   * «Опублікувати» окремо.
   */
  async restore(id: string, versionId: string, authorId: string): Promise<AdminPageDto> {
    const version = await this.prisma.pageVersion.findFirst({
      where: { id: versionId, pageId: id }, select: VERSION_SELECT,
    });
    if (!version) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Версію не знайдено' });

    const parsed = BlockList.safeParse((version as VersionRow).blocks);
    return this.saveDraft(id, {
      title: version.title,
      excerpt: version.excerpt,
      coverUrl: version.coverUrl,
      seoTitle: version.seoTitle,
      seoDescription: version.seoDescription,
      noindex: version.noindex,
      blocks: parsed.success ? parsed.data : [],
      note: `відкат до версії ${version.number}`,
    }, authorId);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const page = await this.prisma.page.findUnique({
      where: { id }, select: { slug: true, isSystem: true },
    });
    if (!page) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Сторінку не знайдено' });
    if (page.isSystem) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Системну сторінку видалити не можна',
      });
    }
    await this.prisma.page.delete({ where: { id } });
    await this.revalidate.revalidate([`/${page.slug}`, '/sitemap.xml']);
    return { ok: true };
  }

  /** Скидання кешу разом із записом результату — щоб мовчазної невдачі не було. */
  private async refreshCache(id: string, slug: string): Promise<void> {
    const error = await this.revalidate.revalidate([`/${slug}`, '/sitemap.xml']);
    await this.prisma.page.update({
      where: { id },
      data: {
        revalidateError: error,
        ...(error === '' ? { revalidatedAt: new Date() } : {}),
      },
    });
  }
}
