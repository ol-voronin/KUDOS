import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminBreedCreateDto, AdminPrintCreateDto, AdminPrintDto, AdminPrintListDto,
  AdminPrintListQueryDto, AdminPrintUpdateDto, CatalogOptionDto,
} from '@dt/contracts';
import { ErrorCode } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';

/** Один select на всі відповіді — щоб форма й таблиця бачили однакову форму даних. */
const PRINT_SELECT = {
  id: true, slug: true, title: true, sizeTier: true, previewUrl: true,
  artworkKey: true, isPublished: true, createdAt: true, updatedAt: true,
  breeds: { select: { breed: { select: { id: true, slug: true, name: true } } } },
  collections: { select: { collection: { select: { id: true, slug: true, title: true } } } },
} satisfies Prisma.PrintSelect;

type PrintRow = Prisma.PrintGetPayload<{ select: typeof PRINT_SELECT }>;

function toDto(row: PrintRow): AdminPrintDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    sizeTier: row.sizeTier,
    previewUrl: row.previewUrl,
    artworkKey: row.artworkKey,
    isPublished: row.isPublished,
    breeds: row.breeds.map((b) => b.breed),
    collections: row.collections.map((c) => ({
      id: c.collection.id, slug: c.collection.slug, name: c.collection.title,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrintsAdminService {
  private readonly logger = new Logger(PrintsAdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminPrintListQueryDto): Promise<AdminPrintListDto> {
    const where: Prisma.PrintWhereInput = {
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.published ? { isPublished: query.published === 'true' } : {}),
      ...(query.breedId ? { breeds: { some: { breedId: query.breedId } } } : {}),
    };

    // Сторінка й лічильник — однією транзакцією: інакше на активній базі
    // «показано 20 з 19» стає реальністю.
    const [items, total] = await this.prisma.$transaction([
      this.prisma.print.findMany({
        where,
        select: PRINT_SELECT,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.print.count({ where }),
    ]);

    return { items: items.map(toDto), total, page: query.page, perPage: query.perPage };
  }

  async get(id: string): Promise<AdminPrintDto> {
    const row = await this.prisma.print.findUnique({ where: { id }, select: PRINT_SELECT });
    if (!row) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Принт не знайдено' });
    return toDto(row);
  }

  async create(dto: AdminPrintCreateDto): Promise<AdminPrintDto> {
    await this.assertSlugFree(dto.slug, null);
    const row = await this.prisma.print.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        sizeTier: dto.sizeTier,
        previewUrl: dto.previewUrl,
        artworkKey: dto.artworkKey,
        isPublished: dto.isPublished,
        breeds: { create: dto.breedIds.map((breedId) => ({ breedId })) },
        collections: { create: dto.collectionIds.map((collectionId) => ({ collectionId })) },
      },
      select: PRINT_SELECT,
    });
    this.logger.log(`print.created id=${row.id} slug=${row.slug} published=${row.isPublished}`);
    return toDto(row);
  }

  async update(id: string, dto: AdminPrintUpdateDto): Promise<AdminPrintDto> {
    if (dto.slug !== undefined) await this.assertSlugFree(dto.slug, id);

    const row = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const exists = await tx.print.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Принт не знайдено' });

      // Звʼязки перезаписуємо цілком, а не diff-ом: набір маленький, а
      // часткове оновлення тут дає більше способів помилитись, ніж економить.
      if (dto.breedIds !== undefined) {
        await tx.printBreed.deleteMany({ where: { printId: id } });
        await tx.printBreed.createMany({ data: dto.breedIds.map((breedId) => ({ printId: id, breedId })) });
      }
      if (dto.collectionIds !== undefined) {
        await tx.printCollection.deleteMany({ where: { printId: id } });
        await tx.printCollection.createMany({
          data: dto.collectionIds.map((collectionId) => ({ printId: id, collectionId })),
        });
      }

      return tx.print.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
          ...(dto.sizeTier !== undefined ? { sizeTier: dto.sizeTier } : {}),
          ...(dto.previewUrl !== undefined ? { previewUrl: dto.previewUrl } : {}),
          ...(dto.artworkKey !== undefined ? { artworkKey: dto.artworkKey } : {}),
          ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
        },
        select: PRINT_SELECT,
      });
    });

    this.logger.log(`print.updated id=${id}`);
    return toDto(row);
  }

  /**
   * Видалення заборонене, якщо принт уже продавався: OrderItem посилається на
   * нього, і замовлення без назви принта — це втрачена історія. Знімайте з
   * публікації замість видалення.
   */
  async remove(id: string): Promise<{ ok: true }> {
    const sold = await this.prisma.orderItem.count({ where: { printId: id } });
    if (sold > 0) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: `Принт уже в ${sold} замовленні(ях). Зніміть з публікації замість видалення.`,
      });
    }
    await this.prisma.print.delete({ where: { id } }).catch(() => {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Принт не знайдено' });
    });
    this.logger.log(`print.deleted id=${id}`);
    return { ok: true };
  }

  async options(): Promise<{ breeds: CatalogOptionDto[]; collections: CatalogOptionDto[] }> {
    const [breeds, collections] = await this.prisma.$transaction([
      this.prisma.breed.findMany({ select: { id: true, slug: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.collection.findMany({ select: { id: true, slug: true, title: true }, orderBy: { position: 'asc' } }),
    ]);
    return {
      breeds,
      collections: collections.map((c) => ({ id: c.id, slug: c.slug, name: c.title })),
    };
  }

  async createBreed(dto: AdminBreedCreateDto): Promise<CatalogOptionDto> {
    const clash = await this.prisma.breed.findUnique({ where: { slug: dto.slug }, select: { id: true } });
    if (clash) {
      throw new ConflictException({ code: ErrorCode.CONFLICT, message: 'Порода з такою адресою вже є' });
    }
    const breed = await this.prisma.breed.create({
      data: { slug: dto.slug, name: dto.name, synonyms: [] },
      select: { id: true, slug: true, name: true },
    });
    this.logger.log(`breed.created id=${breed.id} slug=${breed.slug}`);
    return breed;
  }

  private async assertSlugFree(slug: string, exceptId: string | null): Promise<void> {
    const clash = await this.prisma.print.findUnique({ where: { slug }, select: { id: true } });
    if (clash && clash.id !== exceptId) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'Принт із такою адресою вже існує',
      });
    }
  }
}
