import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ErrorCode, type MediaAssetDto, type MediaCreateDto, type MediaListDto, type MediaUpdateDto,
} from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { requireSiteId } from '../common/site-context';

interface AssetRow {
  id: string; url: string; pathname: string; filename: string;
  mimeType: string; bytes: number; alt: string; createdAt: Date;
}

/**
 * Реєстр картинок.
 *
 * Файли лежать у Vercel Blob — туди їх кладе вебзастосунок, бо токен
 * сховища виданий тільки йому. Сюди приходить уже завантажений файл, щоб
 * його можна було знайти й вставити повторно.
 */
@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(row: AssetRow): MediaAssetDto {
    return {
      id: row.id, url: row.url, pathname: row.pathname, filename: row.filename,
      mimeType: row.mimeType, bytes: row.bytes, alt: row.alt,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(page: number, perPage: number): Promise<MediaListDto> {
    const [rows, total] = await Promise.all([
      this.prisma.db.mediaAsset.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.db.mediaAsset.count(),
    ]);
    return { items: (rows as AssetRow[]).map((r) => this.toDto(r)), total };
  }

  async create(dto: MediaCreateDto, uploadedById: string): Promise<MediaAssetDto> {
    // Той самий `pathname` двічі означав би два рядки на один файл: видалили
    // один — другий лишився з мертвим посиланням.
    // findFirst, а не findUnique: унікальність `pathname` тепер у межах
    // сайту, і складений ключ вимагав би передати `siteId` руками — тобто
    // обійти той самий механізм, заради якого він існує.
    const existing = await this.prisma.db.mediaAsset.findFirst({ where: { pathname: dto.pathname } });
    if (existing) {
      throw new ConflictException({ code: ErrorCode.CONFLICT, message: 'Такий файл уже зареєстрований' });
    }
    const row = await this.prisma.db.mediaAsset.create({
      data: { ...dto, siteId: requireSiteId(), uploadedById },
    });
    return this.toDto(row as AssetRow);
  }

  async update(id: string, dto: MediaUpdateDto): Promise<MediaAssetDto> {
    const exists = await this.prisma.db.mediaAsset.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Картинку не знайдено' });
    const row = await this.prisma.db.mediaAsset.update({ where: { id }, data: { alt: dto.alt } });
    return this.toDto(row as AssetRow);
  }

  /**
   * Видаляє рядок і повертає `pathname`, щоб вебзастосунок прибрав файл.
   *
   * Порядок саме такий: спершу зникає запис, потім файл. Якщо зробити
   * навпаки й видалення рядка не вдасться, у медіатеці лишиться картка з
   * мертвим посиланням — а це гірше за файл-сироту, який нікому не заважає.
   */
  async remove(id: string): Promise<{ pathname: string }> {
    const row = await this.prisma.db.mediaAsset.findUnique({ where: { id }, select: { pathname: true } });
    if (!row) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Картинку не знайдено' });
    await this.prisma.db.mediaAsset.delete({ where: { id } });
    return { pathname: row.pathname };
  }
}
