import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BlockList, ErrorCode, substituteTokens,
  type AdminDraftSaveDto, type AdminPageCreateDto, type AdminPageDto,
  type AdminPageListDto, type AdminPageSummaryDto, type AdminPageTermsDto,
  type AdminPreviewDto,
  type AdminPageUpdateDto,
  type AdminVersionDto,
} from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { requireSiteId } from '../common/site-context';
import { RevalidateService } from './revalidate.service';
import { SettingsService } from './settings.service';

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
    private readonly settings: SettingsService,
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
    const rows = await this.prisma.db.page.findMany({
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
    const page = await this.prisma.db.page.findUnique({
      where: { id },
      select: {
        id: true, slug: true, kind: true, isSystem: true, publishedAt: true,
        updatedAt: true, revalidatedAt: true, revalidateError: true,
        versions: { orderBy: { number: 'desc' }, select: VERSION_SELECT },
        breeds: { select: { breedId: true } },
        collections: { select: { collectionId: true } },
      },
    });
    if (!page) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Сторінку не знайдено' });

    // Довідники їдуть разом зі сторінкою: форма привʼязок інакше зробила б
    // другий запит і встигла б показати порожні списки.
    const [breedOptions, collectionOptions] = await Promise.all([
      this.prisma.db.breed.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      this.prisma.db.collection.findMany({ orderBy: { title: 'asc' }, select: { id: true, title: true } }),
    ]);

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
      breedIds: page.breeds.map((b: { breedId: string }) => b.breedId),
      collectionIds: page.collections.map((c: { collectionId: string }) => c.collectionId),
      breedOptions: breedOptions.map((b) => ({ id: b.id, name: b.name })),
      collectionOptions: collectionOptions.map((c) => ({ id: c.id, name: c.title })),
    };
  }

  /**
   * Привʼязки матеріалу.
   *
   * Замінюємо цілком: прийшов список — він і є істина. Порівнювати «що
   * додалося, що зникло» тут нема сенсу, рядків одиниці, а помилок у такому
   * порівнянні буває більше, ніж користі.
   *
   * `siteId` пишеться явно: вкладене створення проходить повз розширення
   * ізоляції, тому колонка обовʼязкова й без значення за замовчуванням.
   */
  async setTerms(id: string, dto: AdminPageTermsDto): Promise<AdminPageDto> {
    const page = await this.prisma.db.page.findUnique({ where: { id }, select: { id: true } });
    if (!page) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Сторінку не знайдено' });

    const siteId = requireSiteId('привʼязок', 'збереження');

    await this.prisma.db.$transaction([
      this.prisma.db.pageBreed.deleteMany({ where: { pageId: id } }),
      this.prisma.db.pageCollection.deleteMany({ where: { pageId: id } }),
      ...(dto.breedIds.length === 0 ? [] : [
        this.prisma.db.pageBreed.createMany({
          data: dto.breedIds.map((breedId) => ({ siteId, pageId: id, breedId })),
        }),
      ]),
      ...(dto.collectionIds.length === 0 ? [] : [
        this.prisma.db.pageCollection.createMany({
          data: dto.collectionIds.map((collectionId) => ({ siteId, pageId: id, collectionId })),
        }),
      ]),
    ]);

    return this.get(id);
  }

  // ── зміна ─────────────────────────────────────────────────────────────────

  async create(dto: AdminPageCreateDto, authorId: string): Promise<AdminPageDto> {
    const taken = await this.prisma.db.page.findFirst({
      where: { locale: 'UK', slug: dto.slug },
      select: { id: true },
    });
    if (taken) throw new ConflictException({ code: ErrorCode.CONFLICT, message: 'Сторінка з такою адресою вже є' });

    // `siteId` пишеться явно, хоча розширення підставило б його й саме.
    //
    // Причина в типах: розширення працює в рантаймі й не змінює того, що
    // вимагає компілятор. І це на краще. Створення рядка — єдине місце, де
    // питання «якому сайту він належить» справді має ставитися свідомо;
    // читання й зміни розширення закриває само, а створення лишається
    // видимим у коді. Вкладене створення версії інакше й не збереться.
    const siteId = requireSiteId();

    const page = await this.prisma.db.page.create({
      data: {
        siteId,
        slug: dto.slug, kind: dto.kind, locale: 'UK', isSystem: false,
        versions: {
          create: {
            siteId,
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
    const page = await this.prisma.db.page.findUnique({
      where: { id }, select: { id: true, slug: true, kind: true, isSystem: true },
    });
    if (!page) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Сторінку не знайдено' });

    if (dto.slug !== undefined && dto.slug !== page.slug) {
      if (page.isSystem) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Це системна сторінка: на її адресу посилаються код і документи, змінювати не можна',
        });
      }
      const taken = await this.prisma.db.page.findFirst({
        where: { locale: 'UK', slug: dto.slug }, select: { id: true },
      });
      if (taken) throw new ConflictException({ code: ErrorCode.CONFLICT, message: 'Сторінка з такою адресою вже є' });

      await this.prisma.db.$transaction([
        this.prisma.db.redirect.updateMany({ where: { toSlug: page.slug }, data: { toSlug: dto.slug } }),
        this.prisma.db.redirect.deleteMany({ where: { locale: 'UK', fromSlug: dto.slug } }),
        this.prisma.db.redirect.create({
          data: { siteId: requireSiteId(), locale: 'UK', fromSlug: page.slug, toSlug: dto.slug },
        }),
        this.prisma.db.page.update({ where: { id }, data: { slug: dto.slug } }),
      ]);
    }

    if (dto.position !== undefined) {
      await this.prisma.db.page.update({ where: { id }, data: { position: dto.position } });
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
    const page = await this.prisma.db.page.findUnique({
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
      await this.prisma.db.pageVersion.update({ where: { id: draft.id }, data });
    } else {
      const next = Math.max(0, ...page.versions.map((v: { number: number }) => v.number)) + 1;
      await this.prisma.db.pageVersion.create({
        data: { ...data, siteId: requireSiteId(), pageId: id, number: next, status: 'DRAFT' },
      });
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
    const page = await this.prisma.db.page.findUnique({
      where: { id },
      select: { id: true, slug: true, kind: true, publishedAt: true, versions: { select: { id: true, status: true } } },
    });
    if (!page) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Сторінку не знайдено' });

    const draft = page.versions.find((v: { status: string }) => v.status === 'DRAFT');
    if (!draft) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Публікувати нема чого: змін після останньої публікації немає',
      });
    }

    await this.prisma.db.$transaction([
      this.prisma.db.pageVersion.updateMany({
        where: { pageId: id, status: 'PUBLISHED' }, data: { status: 'ARCHIVED' },
      }),
      this.prisma.db.pageVersion.update({ where: { id: draft.id }, data: { status: 'PUBLISHED' } }),
      this.prisma.db.page.update({
        where: { id },
        data: { publishedAt: page.publishedAt ?? new Date() },
      }),
    ]);

    await this.refreshCache(id, page.slug, page.kind);
    return this.get(id);
  }

  /** Зняти з публікації. Системну сторінку — ніколи. */
  async unpublish(id: string): Promise<AdminPageDto> {
    const page = await this.prisma.db.page.findUnique({
      where: { id }, select: { id: true, slug: true, kind: true, isSystem: true },
    });
    if (!page) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Сторінку не знайдено' });
    if (page.isSystem) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Системну сторінку не можна прибрати з сайту',
      });
    }
    await this.prisma.db.pageVersion.updateMany({
      where: { pageId: id, status: 'PUBLISHED' }, data: { status: 'ARCHIVED' },
    });
    await this.refreshCache(id, page.slug, page.kind);
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
    const version = await this.prisma.db.pageVersion.findFirst({
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

  /**
   * Чернетка так, як її побачить відвідувач: із підставленими токенами.
   *
   * Це і є причина окремого методу. Редактор мусить показувати `{{phone}}`,
   * бо це те, що людина написала й буде правити. Перегляд мусить показувати
   * номер, бо це те, що надрукується на сайті. Одна відповідь на два різні
   * питання не буває правильною.
   */
  async preview(id: string): Promise<AdminPreviewDto> {
    const page = await this.prisma.db.page.findUnique({
      where: { id },
      select: {
        slug: true,
        versions: {
          where: { status: { in: ['DRAFT', 'PUBLISHED'] } },
          select: { status: true, title: true, blocks: true },
        },
      },
    });
    if (!page) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Сторінку не знайдено' });

    const rows = page.versions as Array<{ status: string; title: string; blocks: unknown }>;
    const version = rows.find((v) => v.status === 'DRAFT') ?? rows.find((v) => v.status === 'PUBLISHED');
    if (!version) return { isDraft: false, title: page.slug, blocks: [] };

    const parsed = BlockList.safeParse(version.blocks);
    const tokens = await this.settings.tokens();
    const render = (text: string): string => substituteTokens(text, tokens);

    const deep = <T,>(value: T): T => {
      if (typeof value === 'string') return render(value) as unknown as T;
      if (Array.isArray(value)) return value.map(deep) as unknown as T;
      if (value !== null && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) out[k] = deep(v);
        return out as T;
      }
      return value;
    };

    return {
      isDraft: version.status === 'DRAFT',
      title: render(version.title),
      blocks: parsed.success ? deep(parsed.data) : [],
    };
  }

  async remove(id: string): Promise<{ ok: true }> {
    const page = await this.prisma.db.page.findUnique({
      where: { id }, select: { slug: true, kind: true, isSystem: true },
    });
    if (!page) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Сторінку не знайдено' });
    if (page.isSystem) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Системну сторінку видалити не можна',
      });
    }
    await this.prisma.db.page.delete({ where: { id } });
    await this.revalidate.revalidate(this.pathsFor(page.slug, page.kind));
    return { ok: true };
  }

  /**
   * Які адреси перечитати після зміни сторінки.
   *
   * Матеріал живе під `/statti/<адреса>`, і крім самої статті треба скинути
   * стрічку — інакше нова стаття є за прямим посиланням, але її немає в
   * списку, звідки на неї ведуть. Породні сторінки теж показують матеріали,
   * але їх ISR оновить сам за пʼять хвилин; ганяти скидання по всіх
   * привʼязках заради цього не варто.
   */
  private pathsFor(slug: string, kind: string): string[] {
    return kind === 'ARTICLE'
      ? [`/statti/${slug}`, '/statti', '/sitemap.xml']
      : [`/${slug}`, '/sitemap.xml'];
  }

  /** Скидання кешу разом із записом результату — щоб мовчазної невдачі не було. */
  private async refreshCache(id: string, slug: string, kind: string): Promise<void> {
    const error = await this.revalidate.revalidate(this.pathsFor(slug, kind));
    await this.prisma.db.page.update({
      where: { id },
      data: {
        revalidateError: error,
        ...(error === '' ? { revalidatedAt: new Date() } : {}),
      },
    });
  }
}
