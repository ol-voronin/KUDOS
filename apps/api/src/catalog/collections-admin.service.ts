import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminCollectionCreateDto, AdminCollectionDto, AdminCollectionListDto,
  AdminCollectionReorderDto, AdminCollectionUpdateDto,
} from '@dt/contracts';
import { ErrorCode } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';

/** Один select на всі відповіді — форма й список бачать однакову форму даних. */
const COLLECTION_SELECT = {
  id: true, slug: true, title: true, description: true,
  position: true, isPublished: true, createdAt: true, updatedAt: true,
  prints: {
    select: {
      print: { select: { id: true, slug: true, title: true, previewUrl: true, isPublished: true } },
    },
    orderBy: { print: { createdAt: 'desc' as const } },
  },
  colourExclusions: { select: { colourId: true } },
} as const satisfies Prisma.CollectionSelect;

type CollectionRow = Prisma.CollectionGetPayload<{ select: typeof COLLECTION_SELECT }>;

function toDto(row: CollectionRow): AdminCollectionDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? '',
    position: row.position,
    isPublished: row.isPublished,
    prints: row.prints.map((p) => p.print),
    excludedColourIds: row.colourExclusions.map((e) => e.colourId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Адмінка «Колекції».
 *
 * Принти привʼязуються прямо тут, а не лише у формі принта: колекцію збирають
 * як ціле. Звʼязок той самий (`PrintCollection`) — просто двері з двох боків.
 *
 * Видалення дозволене тільки порожній колекції: колекція з принтами — це
 * жива полиця вітрини, і зникнути вона має усвідомлено (спершу зняти
 * принти або перенести їх), а не одним кліком.
 */
@Injectable()
export class CollectionsAdminService {
  private readonly logger = new Logger(CollectionsAdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminCollectionListDto> {
    const rows = await this.prisma.db.collection.findMany({
      select: COLLECTION_SELECT,
      orderBy: { position: 'asc' },
    });
    return { items: rows.map(toDto) };
  }

  async get(id: string): Promise<AdminCollectionDto> {
    const row = await this.prisma.db.collection.findUnique({ where: { id }, select: COLLECTION_SELECT });
    if (!row) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Колекцію не знайдено' });
    return toDto(row);
  }

  async create(dto: AdminCollectionCreateDto): Promise<AdminCollectionDto> {
    await this.assertSlugFree(dto.slug, null);
    // Нова колекція стає в кінець: позиція — максимум плюс крок.
    const last = await this.prisma.db.collection.findFirst({
      select: { position: true },
      orderBy: { position: 'desc' },
    });
    const row = await this.prisma.db.collection.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        description: dto.description,
        isPublished: dto.isPublished,
        position: (last?.position ?? 0) + 10,
        colourExclusions: { create: dto.excludedColourIds.map((colourId) => ({ colourId })) },
      },
      select: COLLECTION_SELECT,
    });
    this.logger.log(`collection.created id=${row.id} slug=${row.slug}`);
    return toDto(row);
  }

  async update(id: string, dto: AdminCollectionUpdateDto): Promise<AdminCollectionDto> {
    if (dto.slug !== undefined) await this.assertSlugFree(dto.slug, id);
    const exists = await this.prisma.db.collection.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Колекцію не знайдено' });

    const row = await this.prisma.db.$transaction(async (tx) => {
      // Заборони кольорів — повний список: приводимо таблицю до нього.
      if (dto.excludedColourIds !== undefined) {
        await tx.collectionColourExclusion.deleteMany({ where: { collectionId: id } });
        await tx.collectionColourExclusion.createMany({
          data: dto.excludedColourIds.map((colourId) => ({ collectionId: id, colourId })),
          skipDuplicates: true,
        });
      }
      return tx.collection.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
        },
        select: COLLECTION_SELECT,
      });
    });
    this.logger.log(`collection.updated id=${id}`);
    return toDto(row);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const row = await this.prisma.db.collection.findUnique({
      where: { id },
      select: { id: true, _count: { select: { prints: true } } },
    });
    if (!row) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Колекцію не знайдено' });
    if (row._count.prints > 0) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: `У колекції ${row._count.prints} принт(и). Спершу приберіть їх — або зніміть колекцію з публікації.`,
      });
    }
    await this.prisma.db.collection.delete({ where: { id } });
    this.logger.log(`collection.deleted id=${id}`);
    return { ok: true };
  }

  /** Повний список id у новому порядку. Позиції розставляються кроком 10. */
  async reorder(dto: AdminCollectionReorderDto): Promise<AdminCollectionListDto> {
    await this.prisma.db.$transaction(async (tx) => {
      const owned = await tx.collection.findMany({ select: { id: true } });
      const ownedIds = new Set(owned.map((c) => c.id));
      if (dto.ids.length !== owned.length || dto.ids.some((cid) => !ownedIds.has(cid))) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Список колекцій не збігається з тим, що є зараз. Оновіть сторінку.',
        });
      }
      await Promise.all(
        dto.ids.map((cid, i) => tx.collection.update({ where: { id: cid }, data: { position: (i + 1) * 10 } })),
      );
    });
    this.logger.log('collection.reordered');
    return this.list();
  }

  async addPrints(id: string, printIds: readonly string[]): Promise<AdminCollectionDto> {
    const collection = await this.prisma.db.collection.findUnique({ where: { id }, select: { id: true } });
    if (!collection) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Колекцію не знайдено' });

    // Додаємо тільки принти, які існують: сітка в адмінці могла застаріти,
    // поки хтось видаляв принт у сусідній вкладці. Зниклий — не привід
    // відмовити всій пачці.
    const existing = await this.prisma.db.print.findMany({
      where: { id: { in: [...printIds] } },
      select: { id: true },
    });
    if (existing.length === 0) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Жодного з цих принтів не знайдено' });
    }

    // Повторне додавання — не помилка, а подвійний клік.
    await this.prisma.db.printCollection.createMany({
      data: existing.map((p) => ({ printId: p.id, collectionId: id })),
      skipDuplicates: true,
    });
    this.logger.log(`collection.prints.added collectionId=${id} count=${existing.length}`);
    return this.get(id);
  }

  async removePrint(id: string, printId: string): Promise<AdminCollectionDto> {
    await this.prisma.db.printCollection.deleteMany({ where: { collectionId: id, printId } });
    this.logger.log(`collection.print.removed collectionId=${id} printId=${printId}`);
    return this.get(id);
  }

  private async assertSlugFree(slug: string, exceptId: string | null): Promise<void> {
    const clash = await this.prisma.db.collection.findUnique({ where: { slug }, select: { id: true } });
    if (clash && clash.id !== exceptId) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'Колекція з такою адресою вже існує',
      });
    }
  }
}
