import {
  BadGatewayException, BadRequestException, ConflictException, Injectable, Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { del, put } from '@vercel/blob';
import type {
  AdminBreedCreateDto, AdminPrintCreateDto, AdminPrintDto, AdminPrintImageQueryDto,
  AdminPrintImageReorderDto, AdminPrintListDto, AdminPrintListQueryDto, AdminPrintUpdateDto,
  CatalogOptionDto,
} from '@dt/contracts';
import { ErrorCode, MAX_PRINT_IMAGES, MAX_UPLOAD_BYTES, PRINT_IMAGE_CONTENT_TYPES } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';

/** Один select на всі відповіді — щоб форма й таблиця бачили однакову форму даних. */
const PRINT_SELECT = {
  id: true, slug: true, title: true, sizeTier: true, previewUrl: true,
  artworkKey: true, isPublished: true, createdAt: true, updatedAt: true,
  images: {
    select: { id: true, url: true, pathname: true, alt: true, position: true },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  },
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
    images: row.images,
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

    // Опублікований принт без жодного фото — порожня картка в каталозі.
    // Раніше це стримувалось тим, що посилання було обовʼязковим полем форми;
    // тепер обкладинка береться з фото, тож перевірка потрібна тут.
    if (dto.isPublished === true) {
      const withImage = await this.prisma.printImage.count({ where: { printId: id } });
      if (withImage === 0) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Не можна опублікувати принт без жодного фото',
        });
      }
    }

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

  // ── Фото ────────────────────────────────────────────────────────────────
  //
  // Файл летить у сховище напряму з браузера (у Vercel ліміт тіла запиту
  // 4.5 МБ — фото на 6 МБ через наш сервер не доїхало б). Сюди приходить уже
  // результат: адреса й ключ. Тому «завантаження» тут — це вставка рядка.

  async addImage(
    printId: string,
    file: Buffer,
    contentType: string,
    query: AdminPrintImageQueryDto,
  ): Promise<AdminPrintDto> {
    if (!PRINT_IMAGE_CONTENT_TYPES.includes(contentType as never)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: `Формат ${contentType} не приймаємо. Потрібен JPEG, PNG, WebP або AVIF.`,
      });
    }
    if (file.length === 0) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_FAILED, message: 'Порожній файл' });
    }
    if (file.length > MAX_UPLOAD_BYTES) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: `Файл завеликий: ${(file.length / 1024 / 1024).toFixed(1)} МБ.`,
      });
    }

    const print = await this.prisma.print.findUnique({
      where: { id: printId },
      select: { id: true, slug: true },
    });
    if (!print) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Принт не знайдено' });

    const count = await this.prisma.printImage.count({ where: { printId } });
    if (count >= MAX_PRINT_IMAGES) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: `Більше ${MAX_PRINT_IMAGES} фото на принт не можна. Видаліть зайве.`,
      });
    }

    // Заливаємо ДО транзакції: мережевий виклик усередині транзакції тримав
    // би зʼєднання з базою відкритим на весь час завантаження.
    const uploaded = await this.uploadBlob(print.slug, query.filename, contentType, file);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.printImage.findMany({
        where: { printId },
        select: { id: true, position: true },
        orderBy: { position: 'asc' },
      });
      // Read committed не захищає від двох одночасних вставок: обидві можуть
      // побачити по чотири. Для адмінки, де працює одна людина й браузер
      // вантажить файли послідовно, цього досить; блокувати рядок принта
      // заради цього дорожче, ніж зрідка отримати шосте фото.
      if (existing.length >= MAX_PRINT_IMAGES) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: `Більше ${MAX_PRINT_IMAGES} фото на принт не можна. Видаліть зайве.`,
        });
      }

      const nextPosition = existing.reduce((max, img) => Math.max(max, img.position), -1) + 1;
      await tx.printImage.create({
        data: {
          printId,
          url: uploaded.url,
          pathname: uploaded.pathname,
          alt: query.alt,
          position: nextPosition,
        },
      });

      // Перше фото стає обкладинкою. Далі обкладинку міняє тільки порядок.
      if (existing.length === 0) {
        await tx.print.update({ where: { id: printId }, data: { previewUrl: uploaded.url } });
      }
    });

    this.logger.log(`print.image.added printId=${printId}`);
    return this.get(printId);
  }

  /**
   * Видалення фото прибирає і рядок, і файл.
   *
   * Порядок навмисний: спершу база, потім сховище. Якщо впаде видалення файлу,
   * лишиться осиротілий блоб — це коштує копійки й видно в консолі Vercel.
   * Зворотний порядок дав би картку з битим зображенням, що бачить покупець.
   */
  async removeImage(printId: string, imageId: string): Promise<AdminPrintDto> {
    const image = await this.prisma.printImage.findFirst({
      where: { id: imageId, printId },
      select: { id: true, pathname: true },
    });
    if (!image) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Фото не знайдено' });

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.printImage.delete({ where: { id: imageId } });
      await this.syncCover(tx, printId);
    });

    await this.deleteBlob(image.pathname);
    this.logger.log(`print.image.removed printId=${printId} imageId=${imageId}`);
    return this.get(printId);
  }

  /** Перетягування в адмінці. Перший у списку стає обкладинкою. */
  async reorderImages(printId: string, dto: AdminPrintImageReorderDto): Promise<AdminPrintDto> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const owned = await tx.printImage.findMany({ where: { printId }, select: { id: true } });
      const ownedIds = new Set(owned.map((img) => img.id));

      if (dto.ids.length !== owned.length || dto.ids.some((id) => !ownedIds.has(id))) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Список фото не збігається з тим, що зараз у принта. Оновіть сторінку.',
        });
      }

      await Promise.all(
        dto.ids.map((id, position) => tx.printImage.update({ where: { id }, data: { position } })),
      );
      await this.syncCover(tx, printId);
    });

    this.logger.log(`print.image.reordered printId=${printId}`);
    return this.get(printId);
  }

  /**
   * Обкладинка = перше фото.
   *
   * `previewUrl` дублює url першого зображення свідомо: усі читальні шляхи
   * каталогу беруть його одним полем без join-а, а картка принта рендериться
   * у чотирьох різних сітках. Ціна цього дублювання — оцей один метод,
   * який мусить викликатись після будь-якої зміни набору фото.
   */
  private async syncCover(tx: Prisma.TransactionClient, printId: string): Promise<void> {
    const first = await tx.printImage.findFirst({
      where: { printId },
      select: { url: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    const cover = first?.url ?? '';
    await tx.print.update({
      where: { id: printId },
      data: {
        previewUrl: cover,
        // Принт без обкладинки не має висіти в каталозі порожньою карткою:
        // видалили останнє фото — принт сам іде в чернетки.
        ...(cover === '' ? { isPublished: false } : {}),
      },
    });
  }

  /**
   * Заливка у сховище.
   *
   * Перша версія вантажила файл із браузера напряму, щоб обійти ліміт тіла
   * запиту 4.5 МБ. Виявилось, що браузер до Blob API не пускають: preflight
   * не отримує CORS-заголовків, PUT падає з 400. Тому файл іде через нас —
   * а щоб він вліз у ліміт, браузер стискає його перед відправкою.
   *
   * Токен передаємо, лише якщо він є: без нього SDK автентифікується через
   * OIDC, як і роблять проєкти, підключені до сховища у Vercel.
   */
  private async uploadBlob(
    slug: string,
    filename: string,
    contentType: string,
    file: Buffer,
  ): Promise<{ url: string; pathname: string }> {
    const token = process.env['BLOB_READ_WRITE_TOKEN'];
    const safeName = filename.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'photo';

    try {
      const blob = await put(`prints/${slug}/${safeName}`, file, {
        access: 'public',
        contentType,
        // Двоє фото можуть називатись «photo.jpg» — без суфікса друге
        // перезаписало б перше.
        addRandomSuffix: true,
        ...(token ? { token } : {}),
      });
      return { url: blob.url, pathname: blob.pathname };
    } catch (error) {
      this.logger.error(`blob.put.failed slug=${slug} name=${safeName}: ${String(error)}`);
      throw new BadGatewayException({
        code: ErrorCode.INTERNAL,
        message: 'Сховище не прийняло файл. Перевірте, чи підключене Blob-сховище до проєкту.',
      });
    }
  }

  /**
   * Видалення файлу зі сховища.
   *
   * Токен передаємо, тільки якщо він є. Без нього SDK сам іде через OIDC —
   * так автентифікуються проєкти, підключені до сховища у Vercel, і окремий
   * read-write токен їм не потрібен (потрібен лише `BLOB_STORE_ID`, який
   * Vercel виставляє при підключенні).
   */
  private async deleteBlob(pathname: string): Promise<void> {
    const token = process.env['BLOB_READ_WRITE_TOKEN'];
    try {
      await del(pathname, token ? { token } : {});
    } catch (error) {
      // Не валимо запит: рядок уже видалено, картка в адмінці має оновитись.
      // Осиротілий файл коштує копійки й видно тут, у логах.
      this.logger.error(`blob.delete.failed pathname=${pathname}: ${String(error)}`);
    }
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
